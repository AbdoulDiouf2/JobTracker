"""The global reminder cron must be authorized before it reads user data."""

import pytest

from config import settings

pytestmark = pytest.mark.anyio


async def test_process_all_requires_strong_server_secret(api, monkeypatch):
    path = "/api/reminders/process-all"
    monkeypatch.setattr(settings, "CRON_SECRET", "")
    assert (await api.post(path)).status_code == 503

    secret = "Test-Cron-Secret-2026-October-Unique-7Q9x"
    monkeypatch.setattr(settings, "CRON_SECRET", secret)
    assert (await api.post(path)).status_code == 401
    assert (await api.post(path, headers=api.headers_for("a"))).status_code == 401
    assert (await api.post(path, headers={"Authorization": "Bearer wrong"})).status_code == 401

    accepted = await api.post(path, headers={"Authorization": f"Bearer {secret}"})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["users_processed"] == 0
