"""
Tests purs (sans base) de la validation de la veille ChatGPT (Lot 2) :
run_id en heure de Paris (D5, §7.1), URL sûres (§5.7), normalisations, check_item (§5.2).
"""

from datetime import datetime, timedelta, timezone

import pytest

from models.watch import WatchPreferencesUpdate
from services.watch_preferences_service import DEFAULT_PREFERENCES
from utils.watch_validation import (
    RunIdError, UrlRejected, check_item, normalize_contract, normalize_country,
    normalize_seniority, paris_instants, parse_run_id, validate_watch_url,
)

UTC = timezone.utc
TIMES = ["08:00", "18:00"]


def utc(*args) -> datetime:
    return datetime(*args, tzinfo=UTC)


def parse(run_id, now, known=False, times=TIMES):
    return parse_run_id(
        run_id, now, known_run=known, schedule_times=times,
        past_hours=6, resume_hours=24, future_minutes=15,
    )


def code_of(run_id, now, known=False):
    with pytest.raises(RunIdError) as e:
        parse(run_id, now, known)
    return e.value.code


# ============================================
# run_id : format
# ============================================

@pytest.mark.parametrize("run_id", [
    "veille-20261009-0800",                 # format 1.1 sans type
    "veille-20261009-0800-manuel",          # manuel sans suffixe
    "veille-20261009-0800-manuel-abc",      # suffixe trop court
    "veille-20261009-0800-manuel-ABC123",   # majuscules
    "veille-20261009-0800-manuel-abc1234",  # suffixe trop long
    "veille-20261009-0800-auto",
    "veille-2026109-0800-prog",
    "3f2b5a8e-1c2d-4e5f-9a8b-7c6d5e4f3a2b",  # UUID
    "veille-20261009-0800-prog ",
    "",
    None,
    "veille-20261332-0800-prog",            # date impossible
    "veille-20261009-2400-prog",            # heure impossible
    "veille-20261009-0860-prog",
])
def test_run_id_invalid_format(run_id):
    assert code_of(run_id, utc(2026, 10, 9, 6, 5)) == "invalid_run_id"


def test_run_id_prog_and_manuel_accepted():
    now = utc(2026, 10, 9, 6, 5)  # 08:05 Paris (heure d'été)
    p = parse("veille-20261009-0800-prog", now)
    assert p.kind == "prog" and p.scheduled_for == utc(2026, 10, 9, 6, 0)
    assert p.quota_day == "2026-10-09" and p.warnings == ()

    m = parse("veille-20261009-0803-manuel-k3x9q2", now)
    assert m.kind == "manuel" and m.scheduled_for == utc(2026, 10, 9, 6, 3)


def test_two_manual_runs_same_minute_are_distinct_ids():
    now = utc(2026, 10, 9, 12, 32, 30)
    a = parse("veille-20261009-1432-manuel-a81kzq", now)
    b = parse("veille-20261009-1432-manuel-p0d7m4", now)
    assert a.run_id != b.run_id
    assert a.scheduled_for == b.scheduled_for == utc(2026, 10, 9, 12, 32)


def test_prog_outside_schedule_is_accepted_with_warning():
    p = parse("veille-20261009-0900-prog", utc(2026, 10, 9, 7, 2))
    assert p.warnings == ("slot_not_in_schedule",)
    assert parse("veille-20261009-0900-manuel-aaaaaa", utc(2026, 10, 9, 7, 2)).warnings == ()


# ============================================
# run_id : fenêtre de validité (tâches retardées, reprises)
# ============================================

def test_delayed_scheduled_task_is_accepted():
    slot = utc(2026, 10, 9, 6, 0)
    for delay in (timedelta(minutes=4), timedelta(hours=1), timedelta(hours=6)):
        assert parse("veille-20261009-0800-prog", slot + delay).scheduled_for == slot


def test_new_run_beyond_6h_is_refused():
    slot = utc(2026, 10, 9, 6, 0)
    assert code_of("veille-20261009-0800-prog", slot + timedelta(hours=6, minutes=1)) == "run_id_out_of_window"


def test_resume_is_accepted_up_to_24h_even_across_midnight():
    slot = utc(2026, 10, 9, 16, 0)  # 18:00 Paris
    run_id = "veille-20261009-1800-prog"
    resumed = parse(run_id, slot + timedelta(hours=9), known=True)  # 03:00 Paris le lendemain
    assert resumed.quota_day == "2026-10-09"  # quota imputé au jour d'origine
    assert parse(run_id, slot + timedelta(hours=24), known=True)
    assert code_of(run_id, slot + timedelta(hours=24, minutes=1), known=True) == "run_id_out_of_window"
    # Le même délai pour une exécution INCONNUE est refusé
    assert code_of(run_id, slot + timedelta(hours=9)) == "run_id_out_of_window"


def test_future_tolerance_is_15_minutes():
    slot = utc(2026, 10, 9, 6, 0)
    assert parse("veille-20261009-0800-prog", slot - timedelta(minutes=15))
    assert code_of("veille-20261009-0800-prog", slot - timedelta(minutes=16)) == "run_id_out_of_window"
    assert code_of("veille-20261009-0800-prog", slot - timedelta(minutes=16), known=True) == "run_id_out_of_window"


def test_old_run_id_reuse_is_refused():
    assert code_of("veille-20261001-0800-prog", utc(2026, 10, 9, 6, 0)) == "run_id_out_of_window"
    assert code_of("veille-20261001-0800-prog", utc(2026, 10, 9, 6, 0), known=True) == "run_id_out_of_window"


# ============================================
# run_id : changements d'heure Europe/Paris (2026 : 29 mars et 25 octobre)
# ============================================

@pytest.mark.parametrize("day, hhmm, expected_utc", [
    ((2026, 3, 28), "0800", utc(2026, 3, 28, 7, 0)),   # hiver
    ((2026, 3, 29), "0800", utc(2026, 3, 29, 6, 0)),   # jour de bascule -> été
    ((2026, 3, 29), "1800", utc(2026, 3, 29, 16, 0)),
    ((2026, 10, 24), "0800", utc(2026, 10, 24, 6, 0)),  # été
    ((2026, 10, 25), "0800", utc(2026, 10, 25, 7, 0)),  # jour de bascule -> hiver
    ((2026, 10, 25), "1800", utc(2026, 10, 25, 17, 0)),
    ((2026, 12, 15), "1800", utc(2026, 12, 15, 17, 0)),
])
def test_slots_follow_paris_local_time(day, hhmm, expected_utc):
    run_id = f"veille-{day[0]:04d}{day[1]:02d}{day[2]:02d}-{hhmm}-prog"
    p = parse(run_id, expected_utc + timedelta(minutes=3))
    assert p.scheduled_for == expected_utc
    assert p.warnings == ()


def test_nonexistent_local_time_is_refused():
    # 02:30 n'existe pas à Paris le 29 mars 2026
    assert paris_instants(datetime(2026, 3, 29, 2, 30)) == []
    assert code_of("veille-20260329-0230-manuel-abcdef", utc(2026, 3, 29, 1, 0)) == "invalid_run_id"


def test_ambiguous_local_time_accepts_either_occurrence():
    # 02:30 existe deux fois le 25 octobre 2026 : 00:30 UTC (été) et 01:30 UTC (hiver)
    assert paris_instants(datetime(2026, 10, 25, 2, 30)) == [utc(2026, 10, 25, 0, 30), utc(2026, 10, 25, 1, 30)]
    run_id = "veille-20261025-0230-manuel-abcdef"
    assert parse(run_id, utc(2026, 10, 25, 0, 31)).scheduled_for == utc(2026, 10, 25, 0, 30)
    assert parse(run_id, utc(2026, 10, 25, 1, 31)).scheduled_for in (utc(2026, 10, 25, 0, 30), utc(2026, 10, 25, 1, 30))
    assert parse(run_id, utc(2026, 10, 25, 1, 31)).quota_day == "2026-10-25"


# ============================================
# URL (§5.7)
# ============================================

@pytest.mark.parametrize("url", [
    "https://careers.orange.com/jobs/12345",
    "https://www.welcometothejungle.com/fr/companies/x/jobs/data-engineer",
    "https://jobs.example-company.ch/offre?id=42",
    "https://careers.company.com:443/jobs/1",
    "https://www.linkedin.com/jobs/view/123?refId=abc",
    "https://boards.greenhouse.io/acme/jobs/1?next=/jobs/2",  # redirection relative : même site
    "https://jobs.acme.com/apply?url=https://jobs.acme.com/offer/9",  # même domaine
])
def test_safe_urls_are_accepted(url):
    checked = validate_watch_url(url)
    assert checked.url_normalized.startswith("https://")
    assert checked.uncertain is False


@pytest.mark.parametrize("url, code", [
    ("http://careers.orange.com/jobs/1", "invalid_url"),
    ("ftp://careers.orange.com/jobs/1", "invalid_url"),
    ("javascript:alert(1)", "invalid_url"),
    ("https://", "invalid_url"),
    ("https://careers.orange.com/jobs/ 1", "invalid_url"),
    ("https://careers.orange.com/\x00", "invalid_url"),
    ("https://" + "a" * 1990 + ".com/", "invalid_url"),
    (None, "invalid_url"),
    ("https://user:pass@careers.orange.com/jobs/1", "url_userinfo_forbidden"),
    ("https://user@careers.orange.com/jobs/1", "url_userinfo_forbidden"),
    ("https://careers.orange.com:8443/jobs/1", "url_port_forbidden"),
    ("https://careers.orange.com:80/jobs/1", "url_port_forbidden"),
    ("https://127.0.0.1/jobs/1", "url_host_forbidden"),
    ("https://10.0.0.5/jobs/1", "url_host_forbidden"),
    ("https://[::1]/jobs/1", "url_host_forbidden"),
    ("https://2130706433/jobs/1", "url_host_forbidden"),
    ("https://0x7f000001/jobs/1", "url_host_forbidden"),
    ("https://localhost/jobs/1", "url_host_forbidden"),
    ("https://api.localhost/jobs/1", "url_host_forbidden"),
    ("https://printer.local/jobs/1", "url_host_forbidden"),
    ("https://hr.internal/jobs/1", "url_host_forbidden"),
    ("https://nas.lan/jobs/1", "url_host_forbidden"),
    ("https://intranet/jobs/1", "url_host_forbidden"),
    ("https://jobs.company.123/jobs/1", "url_host_forbidden"),
    ("https://bit.ly/3abcd", "url_redirector_forbidden"),
    ("https://www.bit.ly/3abcd", "url_redirector_forbidden"),
    ("https://t.co/abc", "url_redirector_forbidden"),
    ("https://lnkd.in/abc", "url_redirector_forbidden"),
    ("https://tinyurl.com/abc", "url_redirector_forbidden"),
    ("https://l.facebook.com/l.php?u=https://evil.com", "url_redirector_forbidden"),
    ("https://www.google.com/url?q=https://evil.com", "url_redirector_forbidden"),
    ("https://jobs.acme.com/go?url=https://evil.com/phish", "url_redirector_forbidden"),
    ("https://jobs.acme.com/go?redirect=https%3A%2F%2Fevil.com", "url_redirector_forbidden"),
    ("https://jobs.acme.com/go?dest=//evil.com/x", "url_redirector_forbidden"),
])
def test_dangerous_urls_are_refused(url, code):
    with pytest.raises(UrlRejected) as e:
        validate_watch_url(url)
    assert e.value.code == code


# --- Public Suffix List (domaine enregistrable = eTLD+1) ---

@pytest.mark.parametrize("host, expected", [
    ("jobs.orange.com", "orange.com"),
    ("careers.acme.co.uk", "acme.co.uk"),
    ("a.co.uk", "a.co.uk"),
    ("www.emploi.gouv.fr", "emploi.gouv.fr"),  # gouv.fr est un suffixe public de la liste
    ("jobs.company.com.au", "company.com.au"),
    ("team.github.io", "team.github.io"),  # suffixe PRIVÉ de la liste
    ("JOBS.Orange.COM.", "orange.com"),
    ("co.uk", None), ("github.io", None), ("com", None),  # l'hôte est un suffixe public
    ("jobs.company.notatld", None), ("", None),
])
def test_registrable_domain_uses_public_suffix_list(host, expected):
    from utils.watch_validation import registrable_domain
    assert registrable_domain(host) == expected


@pytest.mark.parametrize("url", [
    "https://co.uk/jobs/1",
    "https://github.io/jobs/1",
    "https://com/jobs/1",
    "https://jobs.company.notatld/jobs/1",
])
def test_public_suffix_or_unknown_suffix_host_is_refused(url):
    with pytest.raises(UrlRejected) as e:
        validate_watch_url(url)
    assert e.value.code == "url_host_forbidden"


@pytest.mark.parametrize("url", [
    "https://jobs.a.co.uk/go?url=https://b.co.uk/x",            # même suffixe public, autre site
    "https://jobs.acme.com.au/go?redirect=https://evil.com.au/x",
    "https://team.github.io/go?url=https://attacker.github.io/x",  # suffixe privé
    "https://jobs.acme.com/go?url=https://jobs.acme.notatld/x",  # cible indéterminable
    "https://go.bit.ly/abc",                                     # sous-domaine d'un raccourcisseur
])
def test_cross_site_redirects_follow_public_suffix_list(url):
    with pytest.raises(UrlRejected) as e:
        validate_watch_url(url)
    assert e.value.code == "url_redirector_forbidden"


@pytest.mark.parametrize("url, site", [
    ("https://jobs.a.co.uk/go?url=https://careers.a.co.uk/offer/1", "a.co.uk"),  # autre sous-domaine, même site
    ("https://team.github.io/go?next=https://team.github.io/jobs/2", "team.github.io"),
])
def test_same_site_redirects_are_accepted(url, site):
    assert validate_watch_url(url).site == site


def test_site_is_exposed():
    assert validate_watch_url("https://careers.acme.co.uk/jobs/1").site == "acme.co.uk"


def test_idn_and_punycode_are_accepted_but_uncertain():
    assert validate_watch_url("https://xn--emploi-gva.fr/offre/1").uncertain is True
    assert validate_watch_url("https://emploi-é.fr/offre/1").uncertain is True


def test_url_normalization_reuses_lot1():
    a = validate_watch_url("https://WWW.Careers.Orange.com/jobs/1/?utm_source=x")
    b = validate_watch_url("https://careers.orange.com/jobs/1")
    assert a.url_normalized == b.url_normalized


# ============================================
# Normalisations
# ============================================

@pytest.mark.parametrize("value, expected", [
    ("CDI", "permanent"), ("cdi", "permanent"), ("Permanent", "permanent"),
    ("Contrat à durée indéterminée", "permanent"), ("unbefristet", "permanent"),
    ("Festanstellung", "permanent"), ("indefinite", "permanent"), ("Open-ended", "permanent"),
    ("Onbepaalde duur", "permanent"), ("CDD", "fixed_term"), ("befristet", "fixed_term"),
    ("Stage", "internship"), ("Praktikum", "internship"), ("Alternance", "apprenticeship"),
    ("Lehrstelle", "apprenticeship"), ("Freelance", "freelance"), ("Indépendant", "freelance"),
    ("Mi-temps", None), ("", None), (None, None),
])
def test_normalize_contract(value, expected):
    assert normalize_contract(value) == expected


@pytest.mark.parametrize("value, expected", [
    ("FR", "FR"), ("fr", "FR"), ("France", "FR"), ("Suisse", "CH"), ("Schweiz", "CH"),
    ("Switzerland", "CH"), ("Belgique", "BE"), ("België", "BE"), ("Belgien", "BE"),
    ("Luxembourg", "LU"), ("Luxemburg", "LU"), ("DE", "DE"), ("Allemagne", None), ("", None), (None, None),
])
def test_normalize_country(value, expected):
    assert normalize_country(value) == expected


@pytest.mark.parametrize("value, expected", [
    ("junior", "junior"), ("Junior", "junior"), ("Jeune diplômé", "graduate"), ("débutant", "entry_level"),
    ("Entry-level", "entry_level"), ("senior", None), ("Lead", None),
])
def test_normalize_seniority(value, expected):
    assert normalize_seniority(value) == expected


# ============================================
# check_item (§5.2)
# ============================================

PREFS = {**DEFAULT_PREFERENCES, "preferences_version": 3}
RUN = "veille-20261009-0800-prog"


def item(**overrides) -> dict:
    data = {
        "title": "Data Engineer Junior",
        "company": "Orange",
        "url": "https://careers.orange.com/jobs/12345",
        "country": "FR",
        "location": "Paris",
        "contract_type": "CDI",
        "seniority": "junior",
        "description": "Pipelines Spark",
        "external_id": "orange:12345",
        "relevance_score": 86,
        "relevance_reasons": ["CDI à Paris", "Poste junior explicite"],
        "source_evidence": {"url": "https://careers.orange.com/jobs/12345", "excerpt": "Jeune diplômé bienvenu"},
        "uncertain_fields": ["seniority"],
    }
    data.update(overrides)
    return {k: v for k, v in data.items() if v is not ...}


def test_valid_item():
    c = check_item(item(), PREFS, RUN, 3)
    assert c.ok and c.reasons == [] and c.item_key == "ext:orange:12345"
    assert c.opportunity["country"] == "FR" and c.opportunity["contract_type"] == "CDI"
    assert c.watch == {
        "run_id": RUN, "relevance_score": 86, "relevance_reasons": ["CDI à Paris", "Poste junior explicite"],
        "source_evidence": {"url": "https://careers.orange.com/jobs/12345", "excerpt": "Jeune diplômé bienvenu"},
        "uncertain_fields": ["seniority"], "preferences_version": 3,
        "contract_category": "permanent", "seniority": "junior",
    }


def test_item_key_falls_back_to_normalized_url():
    c = check_item(item(external_id=...), PREFS, RUN)
    assert c.item_key == "url:https://careers.orange.com/jobs/12345"


@pytest.mark.parametrize("overrides, reason", [
    ({"user_id": "victim"}, "forbidden_field"),
    ({"source": "manual"}, "forbidden_field"),
    ({"unexpected": 1}, "unknown_field"),
    ({"title": ...}, "missing_title"),
    ({"title": "x" * 201}, "invalid_title"),
    ({"company": "Ora\x07nge"}, "invalid_company"),
    ({"relevance_score": 101}, "invalid_relevance_score"),
    ({"relevance_score": "90"}, "invalid_relevance_score"),
    ({"relevance_score": True}, "invalid_relevance_score"),
    ({"relevance_reasons": []}, "invalid_relevance_reasons"),
    ({"relevance_reasons": ["a"] * 6}, "invalid_relevance_reasons"),
    ({"relevance_reasons": ["x" * 201]}, "invalid_relevance_reasons"),
    ({"url": "http://careers.orange.com/jobs/1"}, "invalid_url"),
    ({"url": "https://bit.ly/x"}, "url_redirector_forbidden"),
    ({"country": "DE"}, "country_not_targeted"),
    ({"country": "Allemagne"}, "invalid_country"),
    ({"contract_type": "CDD"}, "contract_not_targeted"),
    ({"contract_type": "Mi-temps"}, "contract_not_targeted"),
    ({"seniority": "senior"}, "seniority_not_targeted"),
    ({"relevance_score": 74}, "score_below_threshold"),
])
def test_rejections(overrides, reason):
    c = check_item(item(**overrides), PREFS, RUN)
    assert not c.ok and reason in c.reasons


def test_all_reasons_are_reported():
    c = check_item(item(country="DE", contract_type="CDD", relevance_score=10), PREFS, RUN)
    assert set(c.reasons) == {"country_not_targeted", "contract_not_targeted", "score_below_threshold"}


def test_rejection_reasons_never_echo_values():
    c = check_item(item(user_id="SECRET-VALUE", title="x" * 300), PREFS, RUN)
    assert "SECRET-VALUE" not in repr(c.reasons) and "xxx" not in repr(c.reasons)


def test_score_at_threshold_and_missing_seniority_are_accepted():
    assert check_item(item(relevance_score=75, seniority=...), PREFS, RUN).ok


def test_non_dict_item_is_rejected():
    assert check_item("not an object", PREFS, RUN).reasons == ["invalid_item"]


def test_description_truncated_with_warning():
    c = check_item(item(description="a" * 12000), PREFS, RUN)
    assert c.ok and len(c.opportunity["description"]) == 10000
    assert "description_truncated" in c.warnings


def test_description_beyond_hard_limit_is_rejected():
    assert "invalid_description" in check_item(item(description="a" * 50001), PREFS, RUN).reasons


@pytest.mark.parametrize("evidence", [
    "not a dict", {"url": "http://x.com/a"}, {"excerpt": "no url"}, {"url": "https://ok.com/a", "extra": 1},
    {"url": "https://ok.com/a", "excerpt": "x" * 501},
])
def test_invalid_source_evidence_is_ignored_with_warning(evidence):
    c = check_item(item(source_evidence=evidence), PREFS, RUN)
    assert c.ok and c.watch["source_evidence"] is None and "source_evidence_ignored" in c.warnings


def test_evidence_on_other_domain_marks_url_uncertain():
    c = check_item(item(source_evidence={"url": "https://other-site.com/a"}), PREFS, RUN)
    assert c.ok and "url" in c.watch["uncertain_fields"]


@pytest.mark.parametrize("offer_url, evidence_url, uncertain", [
    ("https://jobs.a.co.uk/o/1", "https://b.co.uk/o/1", True),        # sites distincts sous co.uk
    ("https://jobs.a.co.uk/o/1", "https://careers.a.co.uk/o/1", False),  # même site
    ("https://team.github.io/o/1", "https://other.github.io/o/1", True),
])
def test_evidence_site_comparison_uses_public_suffix_list(offer_url, evidence_url, uncertain):
    c = check_item(item(url=offer_url, source_evidence={"url": evidence_url}), PREFS, RUN)
    assert c.ok and ("url" in c.watch["uncertain_fields"]) is uncertain


def test_unknown_uncertain_fields_are_filtered():
    c = check_item(item(uncertain_fields=["seniority", "salary", 3]), PREFS, RUN)
    assert c.watch["uncertain_fields"] == ["seniority"] and "uncertain_fields_filtered" in c.warnings


def test_idn_url_is_marked_uncertain():
    c = check_item(item(url="https://xn--emploi-gva.fr/o/1", source_evidence=...), PREFS, RUN)
    assert c.ok and "url" in c.watch["uncertain_fields"]


def test_rejected_item_key_is_stable_for_replays():
    a = check_item(item(relevance_score=10, external_id=..., url="ftp://x"), PREFS, RUN)
    b = check_item(item(relevance_score=10, external_id=..., url="ftp://x"), PREFS, RUN)
    assert a.item_key == b.item_key and a.item_key.startswith("raw:")


# ============================================
# Préférences (modèle)
# ============================================

def prefs_payload(**overrides) -> dict:
    data = {k: v for k, v in DEFAULT_PREFERENCES.items()}
    data["expected_version"] = 1
    data.update(overrides)
    return data


def test_default_preferences_are_valid():
    p = WatchPreferencesUpdate.model_validate(prefs_payload())
    assert p.schedule.times == ["08:00", "18:00"] and p.schedule.timezone == "Europe/Paris"


@pytest.mark.parametrize("overrides", [
    {"min_score": 49}, {"min_score": 101}, {"max_per_run": 0}, {"max_per_run": 21},
    {"countries": []}, {"countries": ["FRA"]}, {"countries": ["FR", "fr"]}, {"countries": ["F" + "R"] * 11},
    {"job_families": ["cooking"]}, {"seniority": ["senior"]}, {"contract_types": ["cdi"]},
    {"languages": ["fra"]}, {"title_keywords": ["x" * 61]}, {"exclusions": [""]},
    {"title_keywords": ["Data"] * 21}, {"scoring_rubric": "x" * 1501}, {"scoring_rubric": ""},
    {"schedule": {"timezone": "UTC", "times": ["08:00"]}},
    {"schedule": {"timezone": "Europe/Paris", "times": []}},
    {"schedule": {"timezone": "Europe/Paris", "times": ["8:00"]}},
    {"schedule": {"timezone": "Europe/Paris", "times": ["24:00"]}},
    {"schedule": {"timezone": "Europe/Paris", "times": ["08:00", "08:00"]}},
    {"schedule": {"timezone": "Europe/Paris", "times": ["01:00", "02:00", "03:00", "04:00", "05:00"]}},
    {"preferences_version": 9}, {"user_id": "other"}, {"expected_version": 0},
])
def test_invalid_preferences_are_refused(overrides):
    with pytest.raises(Exception):
        WatchPreferencesUpdate.model_validate(prefs_payload(**overrides))


def test_preferences_are_normalized():
    p = WatchPreferencesUpdate.model_validate(prefs_payload(
        countries=["fr", " ch "], languages=["FR"], schedule={"times": ["18:00", "08:00"]},
    ))
    assert p.countries == ["FR", "CH"] and p.languages == ["fr"] and p.schedule.times == ["08:00", "18:00"]
