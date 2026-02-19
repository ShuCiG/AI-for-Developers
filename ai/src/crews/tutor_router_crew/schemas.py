from pydantic import BaseModel, Field
from typing import Optional


class RouterOutput(BaseModel):
    """Schema for the tutor router intent classification."""

    intent: str = Field(
        ...,
        description="One of: translation, new_word, grammar, example_sentences, practice, save_word, cultural, off_topic",
    )
    reasoning: str = Field(
        ...,
        description="Brief explanation of why this intent was chosen",
    )
    source_language: Optional[str] = Field(
        None,
        description="User's native language if detectable (e.g. 'English')",
    )
    target_language: Optional[str] = Field(
        None,
        description="Target language for learning (e.g. 'Polish')",
    )
