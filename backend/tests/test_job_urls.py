"""
Tests unitaires : validation, normalisation et détection de plateforme des URLs d'offres.
"""

import pytest

from utils.job_urls import normalize_job_url, validate_http_url, detect_platform


class TestNormalizeJobUrl:
    def test_utm_params_are_removed(self):
        assert normalize_job_url("https://company.com/jobs/123?utm_source=linkedin") == \
            normalize_job_url("https://company.com/jobs/123")

    def test_all_utm_variants_removed(self):
        url = ("https://company.com/jobs/123?utm_source=a&utm_medium=b&utm_campaign=c"
               "&utm_content=d&utm_term=e")
        assert normalize_job_url(url) == "https://company.com/jobs/123"

    def test_trailing_slash_and_fragment(self):
        assert normalize_job_url("https://company.com/jobs/123/#apply") == "https://company.com/jobs/123"

    def test_host_case_www_and_scheme(self):
        assert normalize_job_url("http://WWW.Company.com/jobs/123") == "https://company.com/jobs/123"

    def test_default_port_removed_custom_port_kept(self):
        assert normalize_job_url("https://company.com:443/jobs/1") == "https://company.com/jobs/1"
        assert normalize_job_url("https://company.com:8443/jobs/1") == "https://company.com:8443/jobs/1"

    def test_identifying_query_params_are_kept(self):
        a = normalize_job_url("https://fr.indeed.com/viewjob?jk=abc123&utm_source=x")
        b = normalize_job_url("https://fr.indeed.com/viewjob?jk=zzz999")
        assert a == "https://fr.indeed.com/viewjob?jk=abc123"
        assert a != b

    def test_query_param_order_is_irrelevant(self):
        assert normalize_job_url("https://ats.io/job?b=2&a=1") == normalize_job_url("https://ats.io/job?a=1&b=2")

    def test_linkedin_tracking_params_removed(self):
        url = "https://www.linkedin.com/jobs/view/4012345678/?trackingId=abc%3D%3D&refId=xyz&trk=public_jobs"
        assert normalize_job_url(url) == "https://linkedin.com/jobs/view/4012345678"

    def test_path_case_is_preserved(self):
        assert normalize_job_url("https://ats.io/Jobs/ABC") != normalize_job_url("https://ats.io/jobs/abc")


class TestValidateHttpUrl:
    @pytest.mark.parametrize("url", [
        "javascript:alert(1)",
        "ftp://company.com/job",
        "data:text/html,<script>",
        "https://",
        "company.com/jobs/1",
        "https://company.com/jo bs",
        "https://company.com:99999/job",
        "",
        "https://company.com/" + "a" * 2100,
    ], ids=["javascript", "ftp", "data", "no-host", "no-scheme", "whitespace", "bad-port", "empty", "too-long"])
    def test_rejects_invalid_urls(self, url):
        with pytest.raises(ValueError):
            validate_http_url(url)

    def test_accepts_http_and_https(self):
        assert validate_http_url("  https://company.com/jobs/1 ") == "https://company.com/jobs/1"
        assert validate_http_url("http://company.com/jobs/1") == "http://company.com/jobs/1"


class TestDetectPlatform:
    @pytest.mark.parametrize("url,expected", [
        ("https://www.linkedin.com/jobs/view/1", "linkedin"),
        ("https://fr.indeed.com/viewjob?jk=1", "indeed"),
        ("https://www.welcometothejungle.com/fr/companies/x/jobs/y", "welcome_to_jungle"),
        ("https://www.apec.fr/candidat/offre.html", "apec"),
        ("https://candidat.francetravail.fr/offres/1", "pole_emploi"),
        ("https://careers.company.com/1", "other"),
        (None, "other"),
    ])
    def test_detection(self, url, expected):
        assert detect_platform(url) == expected
