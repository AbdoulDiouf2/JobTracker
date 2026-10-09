"""
Tests du service des préférences de veille (Lot 2) contre une MongoDB éphémère :
valeurs initiales (D12), versionnement, concurrence, isolation.
"""

import asyncio
import uuid

import pytest

from models.watch import WatchPreferencesUpdate
from services import watch_preferences_service as svc
from services.watch_preferences_service import VersionConflict

pytestmark = pytest.mark.anyio


def user() -> str:
    return f"user-{uuid.uuid4().hex[:8]}"


def update_payload(current, **overrides) -> WatchPreferencesUpdate:
    data = current.model_dump(exclude={"preferences_version", "updated_at"})
    data["expected_version"] = current.preferences_version
    data.update(overrides)
    return WatchPreferencesUpdate(**data)


async def test_defaults_on_first_access(db):
    p = await svc.get_or_create(db, user())
    assert p.preferences_version == 1 and p.active is True
    assert p.countries == ["FR", "CH", "BE", "LU"]
    assert p.schedule.timezone == "Europe/Paris" and p.schedule.times == ["08:00", "18:00"]
    assert p.min_score == 75 and p.max_per_run == 20 and p.contract_types == ["permanent"]
    assert p.seniority == ["junior", "entry_level", "graduate"]


async def test_concurrent_first_access_creates_a_single_document(db):
    u = user()
    results = await asyncio.gather(*[svc.get_or_create(db, u) for _ in range(10)])
    assert {r.preferences_version for r in results} == {1}
    assert await db[svc.COLLECTION].count_documents({"user_id": u}) == 1


async def test_update_increments_version(db):
    u = user()
    current = await svc.get_or_create(db, u)
    updated = await svc.update(db, u, update_payload(current, min_score=80, countries=["FR", "CH"]))
    assert updated.preferences_version == 2 and updated.min_score == 80 and updated.countries == ["FR", "CH"]
    assert (await svc.get_or_create(db, u)).min_score == 80


async def test_stale_version_is_refused(db):
    u = user()
    current = await svc.get_or_create(db, u)
    await svc.update(db, u, update_payload(current, min_score=80))
    with pytest.raises(VersionConflict) as e:
        await svc.update(db, u, update_payload(current, min_score=90))
    assert e.value.current_version == 2
    assert (await svc.get_or_create(db, u)).min_score == 80


async def test_concurrent_updates_only_one_wins(db):
    u = user()
    current = await svc.get_or_create(db, u)
    outcomes = await asyncio.gather(
        *[svc.update(db, u, update_payload(current, min_score=60 + i)) for i in range(10)],
        return_exceptions=True,
    )
    assert sum(not isinstance(o, Exception) for o in outcomes) == 1
    assert all(isinstance(o, VersionConflict) for o in outcomes if isinstance(o, Exception))
    assert (await svc.get_or_create(db, u)).preferences_version == 2


async def test_preferences_are_isolated(db):
    a, b = user(), user()
    current = await svc.get_or_create(db, a)
    await svc.update(db, a, update_payload(current, min_score=95))
    assert (await svc.get_or_create(db, b)).min_score == 75
    assert (await svc.get_or_create(db, b)).preferences_version == 1


async def test_user_id_is_not_exposed(db):
    p = await svc.get_or_create(db, user())
    assert "user_id" not in p.model_dump()
