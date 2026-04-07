from __future__ import annotations

import importlib.util
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.schemas.course import CourseRead
from app.schemas.professor import ProfessorRead
from app.schemas.room import RoomRead
from app.services.course_service import CourseService
from app.services.professor_service import ProfessorService
from app.services.room_service import RoomService


def load_router_module(relative_path: str, module_name: str):
    module_path = Path(__file__).resolve().parents[3] / relative_path
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load route module: {relative_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.router


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(
        load_router_module("app/api/routes/resources_routes/courses.py", "courses_route_module"),
        prefix="/api/v1/resources/courses",
    )
    app.include_router(
        load_router_module("app/api/routes/resources_routes/rooms.py", "rooms_route_module"),
        prefix="/api/v1/resources/rooms",
    )
    app.include_router(
        load_router_module("app/api/routes/resources_routes/professors.py", "professors_route_module"),
        prefix="/api/v1/resources/professors",
    )
    return TestClient(app)


class TestManageSchedulingResourcesRoutes:
    """TS-05: Functional API tests for scheduling resource management routes."""

    def test_tc_05_01_add_new_course_successfully(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        # Arrange
        def stub_create(self, payload):
            return CourseRead(id=uuid4(), code=payload.code, name=payload.name, study_program=payload.study_program)

        monkeypatch.setattr(CourseService, "create", stub_create)

        # Act
        response = client.post(
            "/api/v1/resources/courses",
            json={"code": "CS250", "name": "Software Engineering", "study_program": "software-engineering"},
        )

        # Assert
        assert response.status_code == 201
        assert response.json()["code"] == "CS250"

    def test_tc_05_02_edit_existing_course_successfully(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        # Arrange
        course_id = uuid4()

        def stub_update(self, incoming_course_id, payload):
            assert incoming_course_id == course_id
            return CourseRead(id=incoming_course_id, code=payload.code, name=payload.name, study_program=payload.study_program)

        monkeypatch.setattr(CourseService, "update", stub_update)

        # Act
        response = client.put(
            f"/api/v1/resources/courses/{course_id}",
            json={"code": "CS251", "name": "Advanced Software Engineering", "study_program": "software-engineering"},
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["code"] == "CS251"

    def test_tc_05_03_delete_existing_course_successfully(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        # Arrange
        course_id = uuid4()
        calls: list[UUID] = []

        def stub_delete(self, incoming_course_id):
            calls.append(incoming_course_id)

        monkeypatch.setattr(CourseService, "delete", stub_delete)

        # Act
        response = client.delete(f"/api/v1/resources/courses/{course_id}")

        # Assert
        assert response.status_code == 204
        assert calls == [course_id]

    def test_tc_05_04_add_new_room_successfully(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        # Arrange
        def stub_create(self, payload):
            return RoomRead(id=uuid4(), name=payload.name.strip().upper(), capacity=payload.capacity)

        monkeypatch.setattr(RoomService, "create", stub_create)

        # Act
        response = client.post("/api/v1/resources/rooms", json={"name": "hm-301", "capacity": 60})

        # Assert
        assert response.status_code == 201
        assert response.json()["name"] == "HM-301"

    def test_tc_05_05_edit_existing_room_successfully(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        # Arrange
        room_id = uuid4()

        def stub_update(self, incoming_room_id, payload):
            assert incoming_room_id == room_id
            return RoomRead(id=incoming_room_id, name=payload.name.strip().upper(), capacity=payload.capacity)

        monkeypatch.setattr(RoomService, "update", stub_update)

        # Act
        response = client.put(f"/api/v1/resources/rooms/{room_id}", json={"name": "hm-302", "capacity": 80})

        # Assert
        assert response.status_code == 200
        assert response.json()["name"] == "HM-302"

    def test_tc_05_06_delete_existing_room_successfully(self, client: TestClient, monkeypatch: pytest.MonkeyPatch):
        # Arrange
        room_id = uuid4()
        calls: list[UUID] = []

        def stub_delete(self, incoming_room_id):
            calls.append(incoming_room_id)

        monkeypatch.setattr(RoomService, "delete", stub_delete)

        # Act
        response = client.delete(f"/api/v1/resources/rooms/{room_id}")

        # Assert
        assert response.status_code == 204
        assert calls == [room_id]

    def test_tc_05_07_add_professor_preferred_slots_successfully(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        # Arrange
        preferred_slot_id = str(uuid4())

        def stub_create(self, payload):
            return ProfessorRead(id=uuid4(), name=payload.name, available_slot_ids=[str(x) for x in payload.available_slot_ids])

        monkeypatch.setattr(ProfessorService, "create", stub_create)

        # Act
        response = client.post(
            "/api/v1/resources/professors",
            json={"name": "Prof A", "available_slot_ids": [preferred_slot_id]},
        )

        # Assert
        assert response.status_code == 201
        assert response.json()["available_slot_ids"] == [preferred_slot_id]

    def test_tc_05_08_edit_professor_preferred_slots_successfully(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        # Arrange
        professor_id = uuid4()
        updated_slot_id = str(uuid4())

        def stub_update(self, incoming_professor_id, payload):
            assert incoming_professor_id == professor_id
            return ProfessorRead(
                id=incoming_professor_id,
                name=payload.name,
                available_slot_ids=[str(x) for x in payload.available_slot_ids],
            )

        monkeypatch.setattr(ProfessorService, "update", stub_update)

        # Act
        response = client.put(
            f"/api/v1/resources/professors/{professor_id}",
            json={"name": "Prof A", "available_slot_ids": [updated_slot_id]},
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["available_slot_ids"] == [updated_slot_id]

    def test_tc_05_09_delete_professor_preferred_slots_successfully(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ):
        # Arrange
        professor_id = uuid4()
        calls: list[UUID] = []

        def stub_delete(self, incoming_professor_id):
            calls.append(incoming_professor_id)

        monkeypatch.setattr(ProfessorService, "delete", stub_delete)

        # Act
        response = client.delete(f"/api/v1/resources/professors/{professor_id}")

        # Assert
        assert response.status_code == 204
        assert calls == [professor_id]

    @pytest.mark.parametrize(
        "method,path,payload",
        [
            ("post", "/api/v1/resources/courses", {"name": "No Code", "study_program": "software-engineering"}),
            ("put", f"/api/v1/resources/rooms/{uuid4()}", {"capacity": 50}),
            ("post", "/api/v1/resources/professors", {"available_slot_ids": []}),
        ],
    )
    def test_tc_05_10_validate_required_fields_during_create_or_update(
        self,
        client: TestClient,
        method: str,
        path: str,
        payload: dict,
    ):
        # Act
        response = getattr(client, method)(path, json=payload)

        # Assert
        assert response.status_code == 422
