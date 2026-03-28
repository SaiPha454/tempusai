from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CourseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=255)
    study_program: str | None = Field(default=None, max_length=120)

    model_config = {
        "json_schema_extra": {
            "example": {
                "code": "CE1101",
                "name": "Calculus for Engineers",
                "study_program": "computer-engineering",
            }
        }
    }


class CourseUpdate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=255)
    study_program: str | None = Field(default=None, max_length=120)

    model_config = {
        "json_schema_extra": {
            "example": {
                "code": "CE1102",
                "name": "Physics for Computer Engineering",
                "study_program": "computer-engineering",
            }
        }
    }


class CourseRead(ORMModel):
    id: UUID
    code: str
    name: str
    study_program: str | None

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "0f0a4ebb-b9ac-4289-b20e-f8a8cf816fbe",
                "code": "CE1101",
                "name": "Calculus for Engineers",
                "study_program": "computer-engineering",
            }
        },
    }
