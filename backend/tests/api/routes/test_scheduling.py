from __future__ import annotations

from datetime import datetime, timezone
import importlib.util
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import exam_scheduling_service_dependency
from app.schemas.scheduling import ExamScheduleDraftRead


def load_scheduling_router():
    module_path = Path(__file__).resolve().parents[3] / "app" / "api" / "routes" / "scheduling.py"
    spec = importlib.util.spec_from_file_location("scheduling_route_module", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load scheduling route module for API tests")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.router


class StubExamSchedulingService:
    def __init__(self, response_snapshot_id: UUID) -> None:
        self.calls: list[tuple[UUID, str | None]] = []
        now = datetime.now(timezone.utc)
        self._response = ExamScheduleDraftRead(
            id=response_snapshot_id,
            job_name="Generated Exam",
            status="draft",
            constraints={},
            selected_room_names=[],
            exam_dates=[],
            program_values=["software-engineering"],
            entries=[],
            confirmed_occupancies=[],
            conflict_count=0,
            created_at=now,
            updated_at=now,
        )

    def make_exam_schedule_as_draft(self, snapshot_id: UUID, program_value: str | None = None) -> ExamScheduleDraftRead:
        self.calls.append((snapshot_id, program_value))
        return self._response


def build_client(stub_service: StubExamSchedulingService) -> TestClient:
    app = FastAPI()
    app.include_router(load_scheduling_router(), prefix="/api/v1/scheduling")
    app.dependency_overrides[exam_scheduling_service_dependency] = lambda: stub_service
    return TestClient(app)


class TestSchedulingRoutes:
    """Validate thin API routing for exam make-draft endpoint and query wiring."""

    def test_make_exam_schedule_as_draft_passes_program_value_query_to_service(self):
        # Arrange
        snapshot_id = uuid4()
        stub_service = StubExamSchedulingService(response_snapshot_id=uuid4())
        client = build_client(stub_service)

        # Act
        response = client.post(
            f"/api/v1/scheduling/exam/schedules/{snapshot_id}/make-draft",
            params={"program_value": "software-engineering"},
        )

        # Assert
        assert response.status_code == 200
        assert stub_service.calls == [(snapshot_id, "software-engineering")]

    def test_make_exam_schedule_as_draft_uses_none_when_program_value_not_provided(self):
        # Arrange
        snapshot_id = uuid4()
        stub_service = StubExamSchedulingService(response_snapshot_id=uuid4())
        client = build_client(stub_service)

        # Act
        response = client.post(f"/api/v1/scheduling/exam/schedules/{snapshot_id}/make-draft")

        # Assert
        assert response.status_code == 200
        assert stub_service.calls == [(snapshot_id, None)]
