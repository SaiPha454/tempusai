from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ProgramCreate(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    value: str | None = Field(default=None, max_length=120)

    model_config = {
        "json_schema_extra": {
            "example": {
                "label": "Computer Engineering",
                "value": "computer-engineering",
            }
        }
    }


class ProgramUpdate(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    value: str | None = Field(default=None, max_length=120)

    model_config = {
        "json_schema_extra": {
            "example": {
                "label": "Software Engineering",
                "value": "software-engineering",
            }
        }
    }


class ProgramRead(ORMModel):
    id: UUID
    label: str
    value: str

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "5f281c78-34ea-4c07-a0ec-44bc5ec0e4c2",
                "label": "Computer Engineering",
                "value": "computer-engineering",
            }
        },
    }
