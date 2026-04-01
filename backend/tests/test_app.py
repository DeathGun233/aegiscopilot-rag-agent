from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.main import app

client = TestClient(app)


def _login_as_admin() -> dict[str, str]:
    response = client.post(
        "/auth/login",
        json={"username": "admin", "password": settings.admin_password},
    )
    assert response.status_code == 200
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_document_and_chat_flow() -> None:
    headers = _login_as_admin()

    create_response = client.post(
        "/documents",
        json={
            "title": "员工请假制度",
            "content": "员工请假需要提前申请，年假需要主管审批。",
            "source_type": "text",
            "department": "hr",
            "version": "v1",
            "tags": ["请假"],
        },
        headers=headers,
    )
    assert create_response.status_code == 200
    document_id = create_response.json()["document"]["id"]

    index_response = client.post("/documents/index", json={"document_id": document_id}, headers=headers)
    assert index_response.status_code == 200
    assert index_response.json()["chunks_created"] >= 1

    chat_response = client.post("/chat", json={"query": "请假流程是什么？"}, headers=headers)
    assert chat_response.status_code == 200
    payload = chat_response.json()
    assert payload["task"]["intent"] == "knowledge_qa"
    assert "请假" in payload["reply"]["content"]
