from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class StudentCreate(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    study_program: str = Field(min_length=1, max_length=120)
    year: int = Field(ge=1, le=4)

    model_config = {
        "json_schema_extra": {
            "example": {
                "student_id": "66070001",
                "name": "Alice Chai",
                "study_program": "computer-engineering",
                "year": 2,
            }
        }
    }


class StudentUpdate(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    study_program: str = Field(min_length=1, max_length=120)
    year: int = Field(ge=1, le=4)

    model_config = {
        "json_schema_extra": {
            "example": {
                "student_id": "66070001",
                "name": "Alice Chai Updated",
                "study_program": "computer-engineering",
                "year": 3,
            }
        }
    }


class StudentRead(ORMModel):
    id: UUID
    student_id: str
    name: str
    study_program: str
    year: int

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "46369eb7-66dc-4f53-bf21-3f127635a44f",
                "student_id": "66070001",
                "name": "Alice Chai",
                "study_program": "computer-engineering",
                "year": 2,
            }
        },
    }
