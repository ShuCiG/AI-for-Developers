from pydantic import BaseModel, Field


class DifficultyClassificationOutput(BaseModel):
    """Schema for the difficulty classification output."""

    word1: str = Field(
        ...,
        description="The first word from the word pair"
    )
    word2: str = Field(
        ...,
        description="The second word from the word pair"
    )
    difficulty1: str = Field(
        ...,
        description="Difficulty level for word1: beginner, intermediate, or advanced"
    )
    difficulty2: str = Field(
        ...,
        description="Difficulty level for word2: beginner, intermediate, or advanced"
    )
    reasoning1: str = Field(
        ...,
        description="Brief explanation for word1 classification"
    )
    reasoning2: str = Field(
        ...,
        description="Brief explanation for word2 classification"
    )