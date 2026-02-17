"""
Handler function for saving word pairs to Supabase.
This function is called by the save_word_pair tool.
"""
import os
from typing import Optional, Dict, Any
from supabase import create_client, Client


async def save_word_pair_handler(
    user_id: str,
    source_word: str,
    translated_word: str,
    context_sentence: Optional[str] = None
) -> Dict[str, Any]:
    """
    Save a word pair to the user's flashcard deck in Supabase.
    
    Args:
        user_id: The user's UUID
        source_word: The word in the user's native language
        translated_word: The translation in the target language
        context_sentence: Optional example sentence using the word
        
    Returns:
        Dictionary with 'success' (bool) and 'message' (str) keys
    """
    try:
        # Get Supabase credentials
        supabase_url = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        
        if not supabase_service_key:
            return {
                "success": False,
                "message": "Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set"
            }
        
        # Create Supabase client with service role key (bypasses RLS)
        supabase_admin: Client = create_client(supabase_url, supabase_service_key)
        
        # Check for duplicate word pair (both directions)
        # Check if (word1=source_word AND word2=translated_word) OR (word1=translated_word AND word2=source_word)
        # Use two separate queries and combine results
        existing1 = supabase_admin.table("word_pairs").select("id").eq("user_id", user_id).eq("word1", source_word).eq("word2", translated_word).execute()
        existing2 = supabase_admin.table("word_pairs").select("id").eq("user_id", user_id).eq("word1", translated_word).eq("word2", source_word).execute()
        
        if (existing1.data and len(existing1.data) > 0) or (existing2.data and len(existing2.data) > 0):
            return {
                "success": False,
                "message": f"Word pair '{source_word} → {translated_word}' already exists in your flashcard deck."
            }
        
        # Insert new word pair
        insert_data = {
            "user_id": user_id,
            "word1": source_word,
            "word2": translated_word,
            "description": context_sentence
        }
        
        result = supabase_admin.table("word_pairs").insert(insert_data).execute()
        
        if result.data:
            return {
                "success": True,
                "message": f"Successfully saved '{source_word} → {translated_word}' to your flashcard deck."
            }
        else:
            return {
                "success": False,
                "message": "Failed to save word pair. Please try again."
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Error saving word pair: {str(e)}"
        }
