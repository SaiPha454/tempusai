from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4


class FakeQueryResult:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def all(self) -> list[Any]:
        return self._rows


@dataclass
class FakeSession:
    execute_rows_queue: list[list[Any]] = field(default_factory=list)
    scalar_queue: list[Any] = field(default_factory=list)
    scalars_queue: list[Iterable[Any]] = field(default_factory=list)
    get_map: dict[tuple[type[Any], Any], Any] = field(default_factory=dict)

    added: list[Any] = field(default_factory=list)
    deleted: list[Any] = field(default_factory=list)
    commit_calls: int = 0
    flush_calls: int = 0
    rollback_calls: int = 0
    refresh_calls: int = 0

    def execute(self, _stmt: Any) -> FakeQueryResult:
        rows = self.execute_rows_queue.pop(0) if self.execute_rows_queue else []
        return FakeQueryResult(rows)

    def scalar(self, _stmt: Any) -> Any:
        return self.scalar_queue.pop(0) if self.scalar_queue else None

    def scalars(self, _stmt: Any) -> Iterable[Any]:
        return self.scalars_queue.pop(0) if self.scalars_queue else []

    def get(self, model: type[Any], key: Any) -> Any:
        return self.get_map.get((model, key))

    def add(self, value: Any) -> None:
        self.added.append(value)

    def delete(self, value: Any) -> None:
        self.deleted.append(value)

    def flush(self) -> None:
        self.flush_calls += 1
        for value in self.added:
            if getattr(value, "id", None) is None:
                value.id = uuid4()

    def commit(self) -> None:
        self.commit_calls += 1

    def rollback(self) -> None:
        self.rollback_calls += 1

    def refresh(self, _value: Any) -> None:
        self.refresh_calls += 1
