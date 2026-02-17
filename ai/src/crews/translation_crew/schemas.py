from pydantic import BaseModel, Field


class TranslationOutput(BaseModel):
    """Schema for translation response."""

    content: str = Field(
        ...,
        description="The assistant's translation response as plain text for the user",
    )
