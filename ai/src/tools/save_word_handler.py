"""
Handler function for saving individual words to Supabase.
This function is called by the save_word tool.
"""
import os
from typing import Dict, Any
from supabase import create_client, Client


async def save_word_handler(
    user_id: str,
    word: str
) -> Dict[str, Any]:
    """
    Save a single word to the user's word list in Supabase.
    
    Args:
        user_id: The user's UUID
        word: The word to save
        
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
        
        # Normalize word for duplicate checking (case-insensitive)
        word_normalized = word.strip().lower()
        word_trimmed = word.strip()
        
        # Check for duplicate word (case-insensitive)
        # Get all words for this user
        existing_words = supabase_admin.table("words").select("word").eq("user_id", user_id).execute()
        
        # Check if word already exists for this user (case-insensitive)
        if existing_words.data:
            for existing_word_data in existing_words.data:
                existing_word = existing_word_data.get("word", "").strip().lower()
                if existing_word == word_normalized:
                    return {
                        "success": False,
                        "message": f"Word '{word_trimmed}' already exists in your word list."
                    }
        
        # Insert new word
        insert_data = {
            "user_id": user_id,
            "word": word_trimmed  # Store with original case
        }
        
        result = supabase_admin.table("words").insert(insert_data).execute()
        
        if result.data:
            return {
                "success": True,
                "message": f"Successfully saved '{word}' to your word list."
            }
        else:
            return {
                "success": False,
                "message": "Failed to save word. Please try again."
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"Error saving word: {str(e)}"
        }
