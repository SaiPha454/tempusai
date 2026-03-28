from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ProfessorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    available_slot_ids: list[UUID | str] = Field(default_factory=list)

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "Prof. Anan Chaiyasit",
                "available_slot_ids": ["any-time"],
            }
        }
    }


class ProfessorUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    available_slot_ids: list[UUID | str] = Field(default_factory=list)

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "Prof. Narin Rattanakul",
                "available_slot_ids": ["86a6f1f8-d04b-43d8-9d34-4f0f9c3a5edf"],
            }
        }
    }


class ProfessorRead(ORMModel):
    id: UUID
    name: str
    available_slot_ids: list[str]

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "900f0b87-bd31-4bd7-bf5b-44430c3ad359",
                "name": "Prof. Anan Chaiyasit",
                "available_slot_ids": ["any-time"],
            }
        },
    }
