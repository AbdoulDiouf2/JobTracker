"""
Tests du statut `to_apply` (candidature pas encore envoyée).

Principe : toute métrique basée sur l'envoi doit être STRICTEMENT identique
avant et après l'ajout d'une candidature to_apply.
"""

import uuid
from datetime import datetime, timezone, timedelta

import pytest
from fastapi import HTTPException
from pydantic import BaseModel

from models import ApplicationStatus, BulkUpdateRequest, JobApplicationUpdate, sent_applications_filter
from routes import statistics as stats
from routes.tracking import get_pending_reminders
from routes.ai import get_user_context
from routes.applications import update_application, bulk_update_applications

pytestmark = pytest.mark.anyio

USER = "user-to-apply-" + uuid.uuid4().hex[:6]
CURRENT_USER = {"user_id": USER, "source": "webapp"}


def _iso(days_ago: float = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


async def seed_app(db, reponse: str, days_ago: float = 0, **extra) -> str:
    app_id = str(uuid.uuid4())
    doc = {
        "id": app_id,
        "user_id": USER,
        "entreprise": "Orange",
        "poste": "Data Engineer",
        "type_poste": "cdi",
        "moyen": "linkedin",
        "lien": "https://company.com/jobs/1",
        "date_candidature": _iso(days_ago),
        "reponse": reponse,
        "date_reponse": None,
        "is_favorite": True,
        "days_before_reminder": 7,
        "followup_count": 0,
        "history": [],
        "source": "webapp",
        "created_at": _iso(days_ago),
        "updated_at": _iso(days_ago),
    }
    doc.update(extra)
    await db.applications.insert_one(doc)
    return app_id


def dump(value):
    """Normalise pour comparaison. Les listes de dicts sont triées : MongoDB ne
    garantit pas l'ordre des ex-aequo dans un $sort (ex: by_status)."""
    if isinstance(value, BaseModel):
        return dump(value.model_dump())
    if isinstance(value, list):
        items = [dump(v) for v in value]
        if items and all(isinstance(i, dict) for i in items):
            items = sorted(items, key=repr)
        return items
    if isinstance(value, dict):
        return {k: dump(v) for k, v in value.items()}
    return value


async def snapshot_metrics(db) -> dict:
    return {
        "dashboard": dump(await stats.get_dashboard_stats(current_user=CURRENT_USER, db=db)),
        "timeline": dump(await stats.get_timeline_stats(current_user=CURRENT_USER, db=db)),
        "by_status": dump(await stats.get_status_distribution(current_user=CURRENT_USER, db=db)),
        "by_type": dump(await stats.get_type_distribution(current_user=CURRENT_USER, db=db)),
        "by_method": dump(await stats.get_method_distribution(current_user=CURRENT_USER, db=db)),
        "response_rate": dump(await stats.get_response_rate_stats(current_user=CURRENT_USER, db=db)),
        "method_effectiveness": dump(await stats.get_method_effectiveness(
            current_user=CURRENT_USER, db=db, date_from=None, date_to=None)),
        "overview": dump(await stats.get_statistics_overview(
            current_user=CURRENT_USER, db=db, date_from=None, date_to=None)),
        "dashboard_v2": dump(await stats.get_dashboard_v2(
            current_user=CURRENT_USER, db=db, date_from=None, date_to=None)),
        "pending_reminders": dump(await get_pending_reminders(current_user=CURRENT_USER, db=db)),
    }


async def seed_sent_applications(db):
    # Envoyées : en attente depuis 20 j (relance recommandée), positive, négative, sans réponse
    await seed_app(db, "pending", days_ago=20)
    await seed_app(db, "positive", days_ago=10, date_reponse=_iso(3))
    await seed_app(db, "negative", days_ago=2, date_reponse=_iso(1))
    await seed_app(db, "no_response", days_ago=1, moyen="indeed")
    await seed_app(db, "pending", days_ago=0, moyen="linkedin")


def test_to_apply_is_a_valid_status():
    assert ApplicationStatus("to_apply") is ApplicationStatus.TO_APPLY
    assert ApplicationStatus.TO_APPLY.label_fr.endswith("À postuler")


def test_sent_filter_excludes_to_apply():
    assert sent_applications_filter("u1") == {"user_id": "u1", "reponse": {"$nin": ["to_apply"]}}


async def test_to_apply_does_not_change_any_sent_metric(db):
    await seed_sent_applications(db)
    before = await snapshot_metrics(db)

    # Candidatures to_apply : récentes, anciennes, favorites, sur plusieurs plateformes
    await seed_app(db, "to_apply", days_ago=0)
    await seed_app(db, "to_apply", days_ago=20)
    await seed_app(db, "to_apply", days_ago=40, moyen="indeed", type_poste="stage")

    after = await snapshot_metrics(db)
    for key in before:
        assert after[key] == before[key], f"La métrique '{key}' est impactée par to_apply"


async def test_metrics_snapshot_is_sensitive(db):
    """Garde-fou : le snapshot détecte bien l'ajout d'une vraie candidature."""
    await seed_sent_applications(db)
    before = await snapshot_metrics(db)
    await seed_app(db, "pending", days_ago=0)
    after = await snapshot_metrics(db)
    assert after["dashboard"]["total_applications"] == before["dashboard"]["total_applications"] + 1
    assert after["dashboard_v2"] != before["dashboard_v2"]


async def test_ai_context_counts_only_sent_applications(db):
    await seed_app(db, "pending")
    await seed_app(db, "positive")
    await seed_app(db, "to_apply")
    context = await get_user_context(USER, db)
    assert "Total candidatures: 2" in context


async def test_to_apply_never_needs_followup(db):
    await seed_app(db, "to_apply", days_ago=20)
    reminders = await get_pending_reminders(current_user=CURRENT_USER, db=db)
    assert reminders == {"count": 0, "applications": []}
    v2 = await stats.get_dashboard_v2(current_user=CURRENT_USER, db=db, date_from=None, date_to=None)
    assert all(a.type != "needs_followup" for a in v2.priority_actions)


# ============================================
# Transition to_apply -> autre statut
# Règle : jamais de date d'envoi inventée. Sortir de to_apply exige la vraie
# date_candidature, fournie explicitement.
# ============================================

@pytest.mark.parametrize("target", [
    ApplicationStatus.PENDING, ApplicationStatus.CONTACTED, ApplicationStatus.POSITIVE,
    ApplicationStatus.NEGATIVE, ApplicationStatus.NO_RESPONSE, ApplicationStatus.CANCELLED,
])
async def test_leaving_to_apply_without_date_is_rejected(db, target):
    app_id = await seed_app(db, "to_apply", days_ago=10)
    before = await db.applications.find_one({"id": app_id}, {"_id": 0})

    with pytest.raises(HTTPException) as exc:
        await update_application(
            application_id=app_id,
            app_update=JobApplicationUpdate(reponse=target),
            current_user=CURRENT_USER, db=db,
        )
    assert exc.value.status_code == 422
    assert "date" in exc.value.detail.lower()
    # Rien n'a changé : ni statut, ni date, ni historique
    assert await db.applications.find_one({"id": app_id}, {"_id": 0}) == before


async def test_leaving_to_apply_with_explicit_date(db):
    app_id = await seed_app(db, "to_apply", days_ago=10)
    sent_at = datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc)

    result = await update_application(
        application_id=app_id,
        app_update=JobApplicationUpdate(reponse=ApplicationStatus.PENDING, date_candidature=sent_at),
        current_user=CURRENT_USER, db=db,
    )
    assert datetime.fromisoformat(result["date_candidature"]) == sent_at
    assert result["reponse"] == "pending"
    assert result["history"][-1]["old_value"] == "to_apply"
    assert result["history"][-1]["new_value"] == "pending"


async def test_atypical_exit_with_explicit_date_is_allowed(db):
    app_id = await seed_app(db, "to_apply", days_ago=10)
    sent_at = datetime(2026, 9, 2, tzinfo=timezone.utc)
    result = await update_application(
        application_id=app_id,
        app_update=JobApplicationUpdate(reponse=ApplicationStatus.POSITIVE, date_candidature=sent_at),
        current_user=CURRENT_USER, db=db,
    )
    assert result["reponse"] == "positive"
    assert datetime.fromisoformat(result["date_candidature"]) == sent_at


async def test_to_apply_other_fields_update_without_date(db):
    app_id = await seed_app(db, "to_apply", days_ago=10)
    original = (await db.applications.find_one({"id": app_id}))["date_candidature"]
    result = await update_application(
        application_id=app_id,
        app_update=JobApplicationUpdate(commentaire="Relire l'offre"),
        current_user=CURRENT_USER, db=db,
    )
    assert result["reponse"] == "to_apply"
    assert result["date_candidature"] == original


async def test_back_to_to_apply_is_allowed_and_keeps_date(db):
    app_id = await seed_app(db, "pending", days_ago=10)
    original = (await db.applications.find_one({"id": app_id}))["date_candidature"]
    result = await update_application(
        application_id=app_id,
        app_update=JobApplicationUpdate(reponse=ApplicationStatus.TO_APPLY),
        current_user=CURRENT_USER, db=db,
    )
    assert result["reponse"] == "to_apply"
    assert result["date_candidature"] == original


async def test_other_status_changes_keep_date(db):
    app_id = await seed_app(db, "pending", days_ago=10)
    original = (await db.applications.find_one({"id": app_id}))["date_candidature"]

    result = await update_application(
        application_id=app_id,
        app_update=JobApplicationUpdate(reponse=ApplicationStatus.POSITIVE),
        current_user=CURRENT_USER, db=db,
    )
    assert result["date_candidature"] == original


async def test_bulk_update_skips_to_apply(db):
    to_apply_id = await seed_app(db, "to_apply", days_ago=10)
    pending_id = await seed_app(db, "pending", days_ago=10)
    to_apply_before = await db.applications.find_one({"id": to_apply_id}, {"_id": 0})

    result = await bulk_update_applications(
        bulk_data=BulkUpdateRequest(application_ids=[to_apply_id, pending_id], reponse=ApplicationStatus.NO_RESPONSE),
        current_user=CURRENT_USER, db=db,
    )

    assert result["modified_count"] == 1
    assert result["skipped_to_apply"] == 1
    assert await db.applications.find_one({"id": to_apply_id}, {"_id": 0}) == to_apply_before
    assert (await db.applications.find_one({"id": pending_id}))["reponse"] == "no_response"


async def test_bulk_update_to_to_apply_keeps_dates(db):
    app_id = await seed_app(db, "pending", days_ago=10)
    original = (await db.applications.find_one({"id": app_id}))["date_candidature"]
    result = await bulk_update_applications(
        bulk_data=BulkUpdateRequest(application_ids=[app_id], reponse=ApplicationStatus.TO_APPLY),
        current_user=CURRENT_USER, db=db,
    )
    assert result["skipped_to_apply"] == 0
    doc = await db.applications.find_one({"id": app_id})
    assert doc["reponse"] == "to_apply" and doc["date_candidature"] == original


# ============================================
# Relances : jamais sur une candidature non envoyée (audit Étape 6)
# ============================================

async def test_followup_generation_refused_for_to_apply(db):
    from models import FollowupEmailRequest
    from routes.tracking import generate_followup_email

    app_id = await seed_app(db, "to_apply", days_ago=10)
    with pytest.raises(HTTPException) as exc:
        await generate_followup_email(
            application_id=app_id, request=FollowupEmailRequest(application_id=app_id),
            current_user=CURRENT_USER, db=db,
        )
    assert exc.value.status_code == 422


async def test_mark_reminder_sent_refused_for_to_apply(db):
    from routes.tracking import mark_reminder_sent

    app_id = await seed_app(db, "to_apply", days_ago=10)
    before = await db.applications.find_one({"id": app_id}, {"_id": 0})
    with pytest.raises(HTTPException) as exc:
        await mark_reminder_sent(application_id=app_id, current_user=CURRENT_USER, db=db)
    assert exc.value.status_code == 422
    assert await db.applications.find_one({"id": app_id}, {"_id": 0}) == before

    pending_id = await seed_app(db, "pending", days_ago=10)
    result = await mark_reminder_sent(application_id=pending_id, current_user=CURRENT_USER, db=db)
    assert result == {"message": "Rappel marqué comme envoyé"}
    assert (await db.applications.find_one({"id": pending_id}))["followup_count"] == 1


async def test_ai_context_labels_to_apply_as_not_sent(db):
    await seed_app(db, "to_apply")
    context = await get_user_context(USER, db)
    assert "À postuler (pas encore envoyée)" in context
