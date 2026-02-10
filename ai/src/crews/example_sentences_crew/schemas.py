from pydantic import BaseModel, Field
from typing import List


class ExampleSentencesOutput(BaseModel):
    """Schema for the example sentences generation output."""

    sentences: List[str] = Field(
        ...,
        description="List of 2-3 natural example sentences demonstrating how to use both words together"
    )
    word1: str = Field(
        ...,
        description="The first word from the word pair"
    )
    word2: str = Field(
        ...,
        description="The second word from the word pair"
    )