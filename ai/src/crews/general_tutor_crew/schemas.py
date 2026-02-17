from pydantic import BaseModel, Field


class GeneralTutorOutput(BaseModel):
    """Schema for general tutor text response."""

    content: str = Field(
        ...,
        description="The assistant's reply as plain text",
    )
