from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.room import RoomCreate, RoomUpdate
from app.services.room_service import RoomService
from conftest import FakeSession


class TestRoomService:
    """Validate room service normalization and duplicate-name conflict handling."""

    def test_create_uppercases_room_name_before_persisting(self):
        # Arrange
        db = FakeSession()
        service = RoomService(db)
        service.repo = SimpleNamespace(create=lambda room: room)

        # Act
        created = service.create(RoomCreate(name=" hm-301 ", capacity=60))

        # Assert
        assert created.name == "HM-301"
        assert created.capacity == 60
        assert db.commit_calls == 1

    def test_get_raises_not_found_for_missing_room(self):
        # Arrange
        service = RoomService(FakeSession())
        service.repo = SimpleNamespace(get=lambda _room_id: None)

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.get(uuid4())
        assert exc.value.status_code == 404
        assert exc.value.detail == "Room not found"

    def test_update_rolls_back_and_raises_conflict_on_duplicate_name(self):
        # Arrange
        db = FakeSession()
        existing = SimpleNamespace(id=uuid4(), name="HM-301", capacity=40)
        service = RoomService(db)
        service.repo = SimpleNamespace(get=lambda _room_id: existing)

        def raise_on_flush():
            raise IntegrityError("dup", None, None)

        db.flush = raise_on_flush

        # Act / Assert
        with pytest.raises(HTTPException) as exc:
            service.update(existing.id, RoomUpdate(name=" hm-302 ", capacity=80))
        assert exc.value.status_code == 409
        assert exc.value.detail == "Room name already exists"
        assert db.rollback_calls == 1
