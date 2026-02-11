from pydantic import BaseModel, Field
from typing import List


class WordsGameOutput(BaseModel):
    """Schema for the words game output."""

    text_with_placeholders: str = Field(
        ...,
        description="The generated text with ___ placeholders where the words should go"
    )
    words_in_order: List[str] = Field(
        ...,
        description="List of words in the order they appear in the text (first placeholder = first word, etc)"
    )
