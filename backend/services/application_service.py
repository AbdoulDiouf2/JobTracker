"""
JobTracker SaaS - Service Application (candidatures)

Logique métier de création des candidatures et règles de transition du statut
`to_apply`. Utilisée par la route POST /applications et par la conversion
Opportunity → Application.
"""

from datetime import datetime
from typing import Optional

from models import ApplicationStatus, JobApplication, JobApplicationCreate


class ApplicationTransitionError(ValueError):
    """Transition de statut refusée (ex: sortie de to_apply sans vraie date d'envoi)."""


def _enum_value(value):
    return value.value if hasattr(value, "value") else value


def application_to_document(application: JobApplication) -> dict:
    """Sérialise une candidature pour MongoDB (dates ISO, enums en valeurs)."""
    app_dict = application.model_dump()
    app_dict["date_candidature"] = app_dict["date_candidature"].isoformat() if app_dict["date_candidature"] else None
    app_dict["created_at"] = app_dict["created_at"].isoformat()
    app_dict["updated_at"] = app_dict["updated_at"].isoformat()
    if app_dict.get("date_reponse"):
        app_dict["date_reponse"] = app_dict["date_reponse"].isoformat()

    app_dict["reponse"] = _enum_value(app_dict["reponse"])
    app_dict["type_poste"] = _enum_value(app_dict["type_poste"])
    if app_dict.get("moyen"):
        app_dict["moyen"] = _enum_value(app_dict["moyen"])
    return app_dict


async def create_application_record(
    db,
    user_id: str,
    app_data: JobApplicationCreate,
    *,
    default_source: str = "webapp",
    reponse: ApplicationStatus = ApplicationStatus.PENDING,
    application_id: Optional[str] = None,
) -> JobApplication:
    """
    Crée et insère une candidature.

    - `default_source` : utilisée si le payload n'a pas de source ;
    - `reponse` : statut initial (pending par défaut, to_apply pour une conversion) ;
    - `application_id` : identifiant imposé (réservation idempotente de la conversion).
      Une collision lève pymongo.errors.DuplicateKeyError (index unique sur `id`).
    """
    app_dict_data = app_data.model_dump()
    if not app_dict_data.get("source"):
        app_dict_data["source"] = default_source

    extra = {"id": application_id} if application_id else {}
    application = JobApplication(**app_dict_data, user_id=user_id, reponse=reponse, **extra)

    await db.applications.insert_one(application_to_document(application))
    return application


def check_to_apply_exit(old_status: Optional[str], new_status: Optional[str], explicit_date: Optional[datetime]) -> None:
    """
    Règle de sortie du statut to_apply.

    Une candidature to_apply n'a pas été envoyée : sa date_candidature n'est
    qu'une valeur technique. Quitter to_apply vers un statut « envoyé » exige
    donc la VRAIE date d'envoi, fournie explicitement. On n'invente jamais de
    date (ni « maintenant », ni la date technique).

    Les transitions vers to_apply et celles qui ne touchent pas to_apply sont
    inchangées.
    """
    old_status = _enum_value(old_status) or ApplicationStatus.PENDING.value
    new_status = _enum_value(new_status)
    if (
        old_status == ApplicationStatus.TO_APPLY.value
        and new_status is not None
        and new_status != ApplicationStatus.TO_APPLY.value
        and explicit_date is None
    ):
        raise ApplicationTransitionError(
            "Indiquez la date réelle d'envoi (date_candidature) pour sortir du statut « À postuler »."
        )
