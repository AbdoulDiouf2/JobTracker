"""Téléchargements privés des CV et lettres stockés sur Cloudinary."""

import pytest
from fastapi.responses import Response

from routes import documents

pytestmark = pytest.mark.anyio


async def test_document_download_is_owner_scoped_and_uses_private_proxy(api, db, monkeypatch):
    doc_id = "doc-download"
    await db.documents.insert_one({
        "id": doc_id,
        "user_id": api.users["a"],
        "name": "CV",
        "document_type": "cv",
        "cloudinary_url": "https://res.cloudinary.com/example/raw/upload/cv.pdf",
        "cloudinary_public_id": "jobtracker/user-a/cv.pdf",
        "cloudinary_resource_type": "raw",
        "cloudinary_delivery_type": "upload",
        "mime_type": "application/pdf",
        "original_filename": "mon-cv.pdf",
    })
    calls = []

    async def fake_response(public_id, filename, media_type, resource_type, delivery_type, asset_format):
        calls.append((public_id, filename, media_type, resource_type, delivery_type, asset_format))
        return Response(
            b"%PDF-test",
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=mon-cv.pdf"},
        )

    monkeypatch.setattr(documents, "_cloudinary_file_response", fake_response)
    own = await api.get(
        f"/api/documents/{doc_id}/download",
        headers=api.headers_for("a"),
    )
    assert own.status_code == 200 and own.content == b"%PDF-test"
    assert "attachment" in own.headers["content-disposition"]
    assert calls == [(
        "jobtracker/user-a/cv.pdf", "mon-cv.pdf", "application/pdf", "raw", "upload", None,
    )]

    other = await api.get(
        f"/api/documents/{doc_id}/download",
        headers=api.headers_for("b"),
    )
    assert other.status_code == 404


async def test_cover_letter_list_hides_cloudinary_and_download_is_owner_scoped(api, db, monkeypatch):
    letter_id = "letter-download"
    await db.generated_cover_letters.insert_one({
        "id": letter_id,
        "user_id": api.users["a"],
        "entreprise": "MAADEC",
        "poste": "Data Engineer",
        "content": "Bonjour",
        "generated_by": "ai",
        "cloudinary_url": "https://res.cloudinary.com/example/raw/upload/letter.pdf",
        "cloudinary_public_id": "jobtracker/user-a/cover_letters/letter.pdf",
        "created_at": "2026-11-19T00:00:00+00:00",
    })

    listed = await api.get("/api/documents/cover-letters", headers=api.headers_for("a"))
    assert listed.status_code == 200
    item = listed.json()[0]
    assert item["download_url"] == f"/api/documents/cover-letters/{letter_id}/download"
    assert "cloudinary_url" not in item and "cloudinary_public_id" not in item

    async def fake_response(*args):
        return Response(b"%PDF-letter", media_type="application/pdf")

    monkeypatch.setattr(documents, "_cloudinary_file_response", fake_response)
    own = await api.get(
        f"/api/documents/cover-letters/{letter_id}/download",
        headers=api.headers_for("a"),
    )
    assert own.status_code == 200 and own.content == b"%PDF-letter"
    other = await api.get(
        f"/api/documents/cover-letters/{letter_id}/download",
        headers=api.headers_for("b"),
    )
    assert other.status_code == 404


async def test_cloudinary_proxy_uses_short_lived_signed_download(monkeypatch):
    signed = {}

    def fake_private_download(public_id, file_format, **options):
        signed.update(public_id=public_id, file_format=file_format, **options)
        return "https://api.cloudinary.test/download?signed=yes"

    class Upstream:
        content = b"%PDF-signed"
        headers = {"content-type": "application/pdf"}

        def raise_for_status(self):
            return None

    class Client:
        def __init__(self, **options):
            assert options["follow_redirects"] is True

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url):
            assert url == "https://api.cloudinary.test/download?signed=yes"
            return Upstream()

    monkeypatch.setattr(documents.cloudinary.utils, "private_download_url", fake_private_download)
    monkeypatch.setattr(documents.httpx, "AsyncClient", Client)
    response = await documents._cloudinary_file_response(
        "jobtracker/user/cv.pdf", "CV Abdoul.pdf", "application/pdf", "raw", "upload")
    assert response.body == b"%PDF-signed"
    assert response.headers["cache-control"] == "private, no-store"
    assert "filename*=UTF-8''CV%20Abdoul.pdf" in response.headers["content-disposition"]
    assert signed["resource_type"] == "raw"
    assert signed["type"] == "upload"
    assert signed["attachment"] is True
    assert signed["expires_at"] > 0


def test_legacy_resource_type_is_recovered_from_cloudinary_url():
    assert documents._resource_type({
        "cloudinary_url": "https://res.cloudinary.com/demo/image/upload/v1/cv.pdf",
    }) == "image"
    assert documents._resource_type({
        "cloudinary_url": "https://res.cloudinary.com/demo/raw/upload/v1/cv.pdf",
    }) == "raw"
