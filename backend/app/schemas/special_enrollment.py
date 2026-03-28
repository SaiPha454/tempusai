from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class SpecialEnrollmentCreate(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    course_codes: list[str] = Field(min_length=1)

    model_config = {
        "json_schema_extra": {
            "example": {
                "student_id": "66070001",
                "course_codes": ["CE1101", "CE1104"],
            }
        }
    }


class SpecialEnrollmentUpdate(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    course_codes: list[str] = Field(min_length=1)

    model_config = {
        "json_schema_extra": {
            "example": {
                "student_id": "66070001",
                "course_codes": ["CE1101"],
            }
        }
    }


class SpecialEnrollmentRead(ORMModel):
    id: UUID
    student_id: str
    course_codes: list[str]

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "1f5de6c8-fae4-4cb7-839a-6f0939ea6ccb",
                "student_id": "66070001",
                "course_codes": ["CE1101", "CE1104"],
            }
        },
    }
