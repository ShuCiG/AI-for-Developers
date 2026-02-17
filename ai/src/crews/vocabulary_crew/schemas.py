from pydantic import BaseModel, Field
from typing import Optional


class WordCardOutput(BaseModel):
    """Schema for a suggested word to learn (for UI card)."""

    word: str = Field(..., description="The word in the target language")
    translation: str = Field(..., description="Translation in user's language")
    example_sentence: str = Field(
        ...,
        description="Example sentence using the word in the target language",
    )
    definition: Optional[str] = Field(
        None,
        description="Short definition or usage note",
    )
