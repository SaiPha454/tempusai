from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.resource import Program
from app.repositories.program_repository import ProgramRepository
from app.schemas.program import ProgramCreate, ProgramUpdate
from app.services.errors import bad_request, conflict, not_found
from app.services.utils import to_slug


class ProgramService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ProgramRepository(db)

    def list(self) -> list[Program]:
        return self.repo.list()

    def get(self, program_id: UUID) -> Program:
        program = self.repo.get(program_id)
        if not program:
            raise not_found("Program")
        return program

    def create(self, payload: ProgramCreate) -> Program:
        label = payload.label.strip()
        value = payload.value.strip() if payload.value else to_slug(label)
        if not value:
            raise bad_request("Program value cannot be empty")

        program = Program(label=label, value=value)
        try:
            created = self.repo.create(program)
            self.db.commit()
            return created
        except IntegrityError:
            self.db.rollback()
            raise conflict("Program value or label already exists")

    def update(self, program_id: UUID, payload: ProgramUpdate) -> Program:
        program = self.get(program_id)
        program.label = payload.label.strip()
        program.value = payload.value.strip() if payload.value else to_slug(payload.label)

        if not program.value:
            raise bad_request("Program value cannot be empty")

        try:
            self.db.flush()
            self.db.commit()
            self.db.refresh(program)
            return program
        except IntegrityError:
            self.db.rollback()
            raise conflict("Program value or label already exists")

    def delete(self, program_id: UUID) -> None:
        program = self.get(program_id)
        try:
            self.repo.delete(program)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            raise conflict("Program is referenced by other resources")
