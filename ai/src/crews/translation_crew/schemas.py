from pydantic import BaseModel, Field


class TranslationOutput(BaseModel):
    """Schema for translation output."""
    
    source_word: str = Field(..., description="The word in the source language")
    translated_word: str = Field(..., description="The translation in the target language")
    source_language: str = Field(..., description="The source language name")
    target_language: str = Field(..., description="The target language name")
    explanation: str = Field(..., description="Brief explanation or context about the translation")
