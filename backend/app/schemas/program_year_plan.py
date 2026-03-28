from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ProgramYearCourseCreate(BaseModel):
    program_value: str = Field(min_length=1, max_length=120)
    year: int = Field(ge=1, le=4)
    course_code: str = Field(min_length=1, max_length=32)
    professor_name: str | None = Field(default=None, max_length=255)

    model_config = {
        "json_schema_extra": {
            "example": {
                "program_value": "computer-engineering",
                "year": 2,
                "course_code": "CE1101",
                "professor_name": "Prof. Anan Chaiyasit",
            }
        }
    }


class ProgramYearCourseUpdate(BaseModel):
    program_value: str = Field(min_length=1, max_length=120)
    year: int = Field(ge=1, le=4)
    course_code: str = Field(min_length=1, max_length=32)
    professor_name: str | None = Field(default=None, max_length=255)

    model_config = {
        "json_schema_extra": {
            "example": {
                "program_value": "computer-engineering",
                "year": 3,
                "course_code": "CE1104",
                "professor_name": "Prof. Narin Rattanakul",
            }
        }
    }


class ProgramYearCourseRead(ORMModel):
    id: UUID
    program_value: str
    year: int
    course_code: str
    course_name: str
    professor_name: str | None

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "a1f91a52-15fd-4f70-9869-8e4d6e99292a",
                "program_value": "computer-engineering",
                "year": 2,
                "course_code": "CE1101",
                "course_name": "Calculus for Engineers",
                "professor_name": "Prof. Anan Chaiyasit",
            }
        },
    }
