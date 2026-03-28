from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    capacity: int = Field(gt=0)

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "HM-301",
                "capacity": 60,
            }
        }
    }


class RoomUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    capacity: int = Field(gt=0)

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "HM-302",
                "capacity": 70,
            }
        }
    }


class RoomRead(ORMModel):
    id: UUID
    name: str
    capacity: int

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "6a4f11dd-8052-41a6-b5d8-f8f474f92c9b",
                "name": "HM-301",
                "capacity": 60,
            }
        },
    }
