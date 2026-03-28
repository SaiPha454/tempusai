from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class TimeslotCreate(BaseModel):
    day: str = Field(min_length=1, max_length=16)
    label: str = Field(min_length=1, max_length=64)

    model_config = {
        "json_schema_extra": {
            "example": {
                "day": "Mon",
                "label": "9:00 AM - 12:00 PM",
            }
        }
    }


class TimeslotUpdate(BaseModel):
    day: str = Field(min_length=1, max_length=16)
    label: str = Field(min_length=1, max_length=64)

    model_config = {
        "json_schema_extra": {
            "example": {
                "day": "Tue",
                "label": "1:00 PM - 4:00 PM",
            }
        }
    }


class TimeslotRead(ORMModel):
    id: UUID
    day: str
    label: str

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "86a6f1f8-d04b-43d8-9d34-4f0f9c3a5edf",
                "day": "Mon",
                "label": "9:00 AM - 12:00 PM",
            }
        },
    }
