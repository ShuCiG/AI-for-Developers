from pydantic import BaseModel, Field


class VocabularyOutput(BaseModel):
    """Schema for vocabulary/word card output."""
    
    word: str = Field(..., description="The new word to learn")
    translation: str = Field(..., description="The translation or meaning")
    example_sentence: str = Field(..., description="An example sentence using the word")
    definition: str = Field(..., description="A brief definition or explanation")
