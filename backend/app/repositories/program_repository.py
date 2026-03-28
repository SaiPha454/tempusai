from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resource import Program


class ProgramRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self) -> list[Program]:
        return list(self.db.scalars(select(Program).order_by(Program.label.asc())))

    def get(self, program_id: UUID) -> Program | None:
        return self.db.get(Program, program_id)

    def get_by_value(self, value: str) -> Program | None:
        return self.db.scalar(select(Program).where(Program.value == value))

    def create(self, program: Program) -> Program:
        self.db.add(program)
        self.db.flush()
        self.db.refresh(program)
        return program

    def delete(self, program: Program) -> None:
        self.db.delete(program)
