import asyncio
import json
import os
import re
import warnings
from functools import wraps
from typing import Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client

# Lazy imports for crews to speed up startup
# Crews are imported only when needed to reduce initial load time

from lib.tracer import traceable

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

# Initialize Flask app
app = Flask(__name__)

# Configure CORS - allow requests from localhost frontend
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",  # Vite dev server
            "http://localhost:3000",  # Alternative port
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://127.0.0.1:54321")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def require_auth(f):
    """
    Decorator to require authentication for endpoints.
    Validates the JWT token from the Authorization header.
    """
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return jsonify({"error": "Authorization header is required"}), 401

        # Extract token from "Bearer <token>" format
        try:
            token = auth_header.split(" ")[1] if " " in auth_header else auth_header
        except IndexError:
            return jsonify({"error": "Invalid authorization header format"}), 401

        try:
            # Verify the JWT token with Supabase
            user_response = supabase.auth.get_user(token)
            request.user = user_response.user
        except Exception as e:
            return jsonify({"error": f"Authentication failed: {str(e)}"}), 401

        return await f(*args, **kwargs)

    return decorated_function


async def get_user_context(user_id: str) -> Optional[str]:
    """
    Fetch user context from Supabase.

    Args:
        user_id: The user's UUID

    Returns:
        User context string or None if not found
    """
    try:
        # Fetch user context from the profiles table
        response = supabase.table("profiles").select("context").eq("id", user_id).single().execute()

        if response.data:
            return response.data.get("context", "")
        return None
    except Exception as e:
        print(f"Error fetching user context: {e}")
        return None


@traceable
async def generate_random_phrase(words: list[str], user_context: str):
    """
    Generate a random phrase using the RandomPhraseCrew.

    Args:
        words: List of words to use in the phrase
        user_context: User context to personalize the phrase

    Returns:
        PhraseOutput with phrase and words used
    """
    # Lazy import to speed up startup
    from crews.random_phrase_crew.crew import RandomPhraseCrew
    from crews.random_phrase_crew.schemas import PhraseOutput
    
    inputs = {
        'words': jsonify(words).get_data(as_text=True),
        'user_context': jsonify(user_context).get_data(as_text=True)
    }

    result = await RandomPhraseCrew().crew().kickoff_async(inputs=inputs)

    # CrewAI returns a result with a .pydantic attribute containing the Pydantic model
    if hasattr(result, 'pydantic'):
        return result.pydantic

    # Fallback - return a basic PhraseOutput
    return PhraseOutput(phrase=str(result), words=words)


@traceable
async def generate_example_sentences(word1: str, word2: str, user_context: str):
    """
    Generate example sentences using the ExampleSentencesCrew.

    Args:
        word1: First word from the word pair
        word2: Second word from the word pair
        user_context: User context to personalize the sentences

    Returns:
        ExampleSentencesOutput with sentences and words
    """
    # Lazy import to speed up startup
    from crews.example_sentences_crew.crew import ExampleSentencesCrew
    from crews.example_sentences_crew.schemas import ExampleSentencesOutput
    
    inputs = {
        'word1': word1,
        'word2': word2,
        'user_context': user_context or ""
    }

    result = await ExampleSentencesCrew().crew().kickoff_async(inputs=inputs)

    # CrewAI returns a result with a .pydantic attribute containing the Pydantic model
    if hasattr(result, 'pydantic'):
        return result.pydantic

    # Fallback - return a basic ExampleSentencesOutput
    return ExampleSentencesOutput(sentences=[str(result)], word1=word1, word2=word2)


@traceable
async def generate_words_game(words: list[str], user_context: str):
    """
    Generate text with placeholders for the words game.

    Args:
        words: List of 3 words to use in the game
        user_context: User context for personalization

    Returns:
        WordsGameOutput with text_with_placeholders and words_in_order
    """
    from crews.words_game_crew.crew import WordsGameCrew
    from crews.words_game_crew.schemas import WordsGameOutput

    import json
    inputs = {
        "words": json.dumps(words),
        "user_context": user_context or "",
    }

    result = await WordsGameCrew().crew().kickoff_async(inputs=inputs)

    if hasattr(result, "pydantic"):
        return result.pydantic

    return WordsGameOutput(
        text_with_placeholders=str(result),
        words_in_order=words,
    )


def _parse_tool_results(result) -> list:
    """
    Parse tool execution results from CrewAI response.
    Extracts save_word_pair confirmations.
    
    Args:
        result: CrewAI result object
        
    Returns:
        List of save_confirmation objects
    """
    import re
    tool_results = []
    text_to_search = ""
    
    # Collect all text from result
    if hasattr(result, 'raw'):
        text_to_search += str(result.raw) + "\n"
    
    if hasattr(result, 'tasks_output') and result.tasks_output:
        for task_output in result.tasks_output:
            if isinstance(task_output, str):
                text_to_search += task_output + "\n"
            elif hasattr(task_output, '__str__'):
                text_to_search += str(task_output) + "\n"
    
    # Look for save confirmation patterns
    # Pattern 1: "Successfully saved 'word → translation' to your flashcard deck."
    pattern1 = r"Successfully saved ['\"]([^'\"]+)['\"] to your flashcard deck"
    matches1 = re.findall(pattern1, text_to_search, re.IGNORECASE)
    for match in matches1:
        tool_results.append({
            "response_type": "save_confirmation",
            "message": f"Successfully saved '{match}' to your flashcard deck."
        })
    
    # Pattern 2: "Word pair 'word → translation' already exists"
    pattern2 = r"Word pair ['\"]([^'\"]+)['\"] already exists"
    matches2 = re.findall(pattern2, text_to_search, re.IGNORECASE)
    for match in matches2:
        tool_results.append({
            "response_type": "save_confirmation",
            "message": f"Word pair '{match}' already exists in your flashcard deck."
        })
    
    # Pattern 3: Generic "saved" and "flashcard deck" in same sentence
    if not tool_results:
        lines = text_to_search.split('\n')
        for line in lines:
            line_lower = line.lower()
            if ('saved' in line_lower or 'save' in line_lower) and 'flashcard' in line_lower:
                # Extract a meaningful message
                clean_line = line.strip()
                if clean_line and len(clean_line) > 10:
                    tool_results.append({
                        "response_type": "save_confirmation",
                        "message": clean_line
                    })
                    break
    
    return tool_results


@traceable
async def run_translation(
    message: str,
    history: list,
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    user_id: str = "",
    user_context: str = ""
) -> dict:
    """
    Run translation crew with save_word_pair tool support.
    
    Args:
        message: User's message requesting translation
        history: Conversation history
        source_language: Source language (optional)
        target_language: Target language (optional)
        user_id: User's UUID (required for tool)
        user_context: User context string
        
    Returns:
        Structured response: { response_type: "text", content: "...", tool_results: [...] }
    """
    from crews.translation_crew.crew import TranslationCrew
    
    # Initialize crew with user_id for tool access
    crew_instance = TranslationCrew(user_id=user_id)
    
    # Format history for crew inputs
    history_str = json.dumps(history) if history else "[]"
    
    inputs = {
        "message": message,
        "history": history_str,
        "source_language": source_language or "English",
        "target_language": target_language or "English",
        "user_context": user_context or ""
    }
    
    result = await crew_instance.crew().kickoff_async(inputs=inputs)
    
    # Extract main content - get readable text from agent response
    content = ""
    raw_response = None
    
    # Check if we have a Pydantic model (structured output)
    if hasattr(result, 'pydantic'):
        pydantic_obj = result.pydantic
        raw_response = pydantic_obj.model_dump_json(indent=2)
        
        # Format as readable text for user
        if hasattr(pydantic_obj, 'explanation'):
            # Translation output
            explanation = pydantic_obj.explanation
            # Remove lines about saving to flashcard deck (more precise regex)
            # Remove sentences that contain "Would you like me to save" or "I can save" followed by "flashcard deck"
            explanation = re.sub(r'\s*(?:Would you like me to save|I can save).*?flashcard deck.*?[.!?]?\s*', ' ', explanation, flags=re.IGNORECASE)
            explanation = re.sub(r'\s*(?:Would you like me to save|I can save).*?flashcard deck.*?$', '', explanation, flags=re.IGNORECASE | re.MULTILINE)
            explanation = explanation.strip()
            content = f"{pydantic_obj.source_word} → {pydantic_obj.translated_word}\n\n{explanation}"
        else:
            # Other structured output - convert to readable format
            content = str(pydantic_obj)
    elif hasattr(result, 'raw'):
        # Raw text response from agent
        raw_text = str(result.raw)
        raw_response = raw_text
        
        # Check if it's JSON-like (agent returned structured data as string)
        if raw_text.strip().startswith('{') and ('source_word' in raw_text or 'source_language' in raw_text):
            # Try to parse and format
            try:
                parsed = json.loads(raw_text)
                if 'explanation' in parsed:
                    source = parsed.get('source_word', parsed.get('source_language', ''))
                    trans = parsed.get('translated_word', parsed.get('target_language', ''))
                    explanation = parsed.get('explanation', '')
                    # Remove lines about saving to flashcard deck (more precise regex)
                    # Remove sentences that contain "Would you like me to save" or "I can save" followed by "flashcard deck"
                    explanation = re.sub(r'\s*(?:Would you like me to save|I can save).*?flashcard deck.*?[.!?]?\s*', ' ', explanation, flags=re.IGNORECASE)
                    explanation = re.sub(r'\s*(?:Would you like me to save|I can save).*?flashcard deck.*?$', '', explanation, flags=re.IGNORECASE | re.MULTILINE)
                    explanation = explanation.strip()
                    if source and trans:
                        content = f"{source} → {trans}\n\n{explanation}"
                    else:
                        content = explanation
                else:
                    content = raw_text
            except (json.JSONDecodeError, Exception):
                content = raw_text
        else:
            # Regular text response
            content = raw_text
    else:
        content = str(result)
        raw_response = content
    
    # Parse tool results
    tool_results = _parse_tool_results(result)
    
    # Return structured response with raw JSON for "View JSON" button
    response = {
        "response_type": "text",
        "content": content
    }
    
    # Include raw response if it's different from content (for JSON viewing)
    if raw_response and raw_response != content:
        response["raw"] = raw_response
    
    if tool_results:
        response["tool_results"] = tool_results
    
    return response


@traceable
async def run_vocabulary(
    message: str,
    history: list,
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    user_id: str = "",
    user_context: str = ""
) -> dict:
    """
    Run vocabulary crew with save_word_pair tool support.
    
    Args:
        message: User's message requesting new vocabulary
        history: Conversation history
        source_language: Source language (optional)
        target_language: Target language (optional)
        user_id: User's UUID (required for tool)
        user_context: User context string
        
    Returns:
        Structured response: { response_type: "word_card", payload: {...}, tool_results: [...] }
    """
    from crews.vocabulary_crew.crew import VocabularyCrew
    from crews.vocabulary_crew.schemas import VocabularyOutput
    
    # Initialize crew with user_id for tool access
    crew_instance = VocabularyCrew(user_id=user_id)
    
    # Get list of already used words from user's words table and word_pairs table
    # Store both individual words and pairs to avoid duplicates
    # Use service role key to bypass RLS and access user's data
    used_words = set()
    used_pairs = set()  # Store normalized pairs to check both directions
    try:
        if user_id:
            # Use service role key to bypass RLS
            supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
            if supabase_service_key:
                supabase_admin = create_client(SUPABASE_URL, supabase_service_key)
                
                # Get individual words from words table (user-specific words)
                used_words_response = supabase_admin.table("words").select("word").eq("user_id", user_id).execute()
                if used_words_response.data:
                    for word_data in used_words_response.data:
                        word = (word_data.get("word") or "").strip().lower()
                        if word:
                            used_words.add(word)
                
                # Get word pairs from word_pairs table
                used_pairs_response = supabase_admin.table("word_pairs").select("word1, word2").eq("user_id", user_id).execute()
                if used_pairs_response.data:
                    for pair in used_pairs_response.data:
                        word1 = (pair.get("word1") or "").strip().lower()
                        word2 = (pair.get("word2") or "").strip().lower()
                        if word1:
                            used_words.add(word1)
                        if word2:
                            used_words.add(word2)
                        # Also store pairs in both directions for exact match checking
                        if word1 and word2:
                            used_pairs.add(f"{word1}:{word2}")
                            used_pairs.add(f"{word2}:{word1}")
            else:
                # Fallback to anon key (may fail due to RLS)
                print("WARNING: SUPABASE_SERVICE_ROLE_KEY not set, using anon key (may fail due to RLS)")
                # Try to get words from words table
                try:
                    used_words_response = supabase.table("words").select("word").eq("user_id", user_id).execute()
                    if used_words_response.data:
                        for word_data in used_words_response.data:
                            word = (word_data.get("word") or "").strip().lower()
                            if word:
                                used_words.add(word)
                except Exception as e:
                    print(f"Warning: Could not fetch words from words table: {e}")
                
                # Try to get word pairs
                try:
                    used_pairs_response = supabase.table("word_pairs").select("word1, word2").eq("user_id", user_id).execute()
                    if used_pairs_response.data:
                        for pair in used_pairs_response.data:
                            word1 = (pair.get("word1") or "").strip().lower()
                            word2 = (pair.get("word2") or "").strip().lower()
                            if word1:
                                used_words.add(word1)
                            if word2:
                                used_words.add(word2)
                            if word1 and word2:
                                used_pairs.add(f"{word1}:{word2}")
                                used_pairs.add(f"{word2}:{word1}")
                except Exception as e:
                    print(f"Warning: Could not fetch word pairs: {e}")
    except Exception as e:
        print(f"Error fetching used words: {e}")
        import traceback
        traceback.print_exc()
    
    # Also check history for recently suggested words (in current chat session)
    # Extract words from word_card responses in history
    history_words = set()
    history_pairs = set()
    if history:
        for item in history:
            if isinstance(item, dict) and item.get("role") == "assistant":
                content = item.get("content", "")
                
                # Check for text format: "Word: {word}, Translation: {translation}"
                if isinstance(content, str):
                    # Pattern: "Word: perspicacious, Translation: ..."
                    word_match = re.search(r'Word:\s*([^,]+)', content, re.IGNORECASE)
                    translation_match = re.search(r'Translation:\s*(.+)', content, re.IGNORECASE)
                    if word_match:
                        word = word_match.group(1).strip().lower()
                        history_words.add(word)
                        if translation_match:
                            translation = translation_match.group(1).strip().lower()
                            history_pairs.add(f"{word}:{translation}")
                            history_pairs.add(f"{translation}:{word}")
                
                # Also try parsing as JSON (for structured responses)
                try:
                    if isinstance(content, str) and content.strip().startswith('{'):
                        parsed = json.loads(content)
                    else:
                        parsed = content if isinstance(content, dict) else None
                    
                    if parsed and isinstance(parsed, dict):
                        # Check for word_card payload structure
                        if "payload" in parsed and isinstance(parsed["payload"], dict):
                            word = parsed["payload"].get("word", "").strip().lower()
                            translation = parsed["payload"].get("translation", "").strip().lower()
                            if word:
                                history_words.add(word)
                            if word and translation:
                                history_pairs.add(f"{word}:{translation}")
                                history_pairs.add(f"{translation}:{word}")
                        # Check for direct word/translation fields
                        elif "word" in parsed:
                            word = parsed.get("word", "").strip().lower()
                            translation = parsed.get("translation", "").strip().lower()
                            if word:
                                history_words.add(word)
                            if word and translation:
                                history_pairs.add(f"{word}:{translation}")
                                history_pairs.add(f"{translation}:{word}")
                except (json.JSONDecodeError, Exception):
                    pass
    
    # Combine database words with history words
    all_used_words = used_words.union(history_words)
    all_used_pairs = used_pairs.union(history_pairs)
    
    # Log used words for debugging
    print(f"DEBUG: Used words count: {len(all_used_words)}")
    print(f"DEBUG: Used pairs count: {len(all_used_pairs)}")
    if len(all_used_words) > 0:
        print(f"DEBUG: Sample used words: {list(all_used_words)[:5]}")
    if len(all_used_pairs) > 0:
        print(f"DEBUG: Sample used pairs: {list(all_used_pairs)[:5]}")
    
    # Format history for crew inputs
    history_str = json.dumps(history) if history else "[]"
    
    # Update used_words_str with combined data
    used_words_str = json.dumps({
        "words": list(all_used_words),
        "pairs": list(all_used_pairs)
    })
    
    inputs = {
        "message": message,
        "history": history_str,
        "source_language": source_language or "English",
        "target_language": target_language or "English",
        "user_context": user_context or "",
        "used_words": used_words_str
    }
    
    result = await crew_instance.crew().kickoff_async(inputs=inputs)
    
    # Get Pydantic model if available
    vocab_output = None
    raw_response = None
    
    if hasattr(result, 'pydantic'):
        vocab_output = result.pydantic
        raw_response = vocab_output.model_dump_json(indent=2)
    else:
        # Fallback - try to extract from raw
        if hasattr(result, 'raw'):
            raw_text = str(result.raw)
            raw_response = raw_text
            # Try to parse JSON if it's structured
            try:
                parsed = json.loads(raw_text)
                if 'word' in parsed or 'translation' in parsed:
                    vocab_output = VocabularyOutput(
                        word=parsed.get('word', ''),
                        translation=parsed.get('translation', ''),
                        example_sentence=parsed.get('example_sentence', ''),
                        definition=parsed.get('definition', '')
                    )
            except (json.JSONDecodeError, Exception):
                pass
        
        if not vocab_output:
            vocab_output = VocabularyOutput(
                word="",
                translation="",
                example_sentence="",
                definition=""
            )
    
    # Parse tool results
    tool_results = _parse_tool_results(result)
    
    # Validate that the suggested word is not a duplicate
    suggested_word_normalized = vocab_output.word.strip().lower()
    suggested_translation_normalized = vocab_output.translation.strip().lower()
    suggested_pair = f"{suggested_word_normalized}:{suggested_translation_normalized}"
    suggested_pair_reverse = f"{suggested_translation_normalized}:{suggested_word_normalized}"
    
    # Log suggested word for debugging
    print(f"DEBUG: Agent suggested word: '{vocab_output.word}' (normalized: '{suggested_word_normalized}')")
    
    # Check against all used words and pairs
    is_duplicate = (
        suggested_word_normalized in all_used_words or
        suggested_pair in all_used_pairs or
        suggested_pair_reverse in all_used_pairs
    )
    
    if is_duplicate:
        # Log warning
        print(f"WARNING: Agent suggested duplicate word: {vocab_output.word}")
        print(f"Used words count: {len(all_used_words)}, Used pairs count: {len(all_used_pairs)}")
        if len(all_used_words) > 0:
            print(f"Used words sample: {list(all_used_words)[:10]}")
        if len(all_used_pairs) > 0:
            print(f"Used pairs sample: {list(all_used_pairs)[:10]}")
        
        # Return error response asking user to try again
        return {
            "response_type": "text",
            "content": f"I apologize, but the word '{vocab_output.word}' was already suggested in this conversation. Please ask for another word.",
            "error": "duplicate_word",
            "suggested_word": vocab_output.word
        }
    
    # Return structured response
    response = {
        "response_type": "word_card",
        "payload": {
            "word": vocab_output.word,
            "translation": vocab_output.translation,
            "example_sentence": vocab_output.example_sentence,
            "definition": vocab_output.definition
        }
    }
    
    if raw_response:
        response["raw"] = raw_response
    
    if tool_results:
        response["tool_results"] = tool_results
    
    return response


@traceable
async def classify_difficulty(word1: str, word2: str, user_context: str):
    """
    Classify word difficulty using the DifficultyClassifierCrew.

    Args:
        word1: First word from the word pair
        word2: Second word from the word pair
        user_context: User context to personalize the classification

    Returns:
        DifficultyClassificationOutput with difficulty levels and reasoning
    """
    # Lazy import to speed up startup
    from crews.difficulty_classifier_crew.crew import DifficultyClassifierCrew
    from crews.difficulty_classifier_crew.schemas import DifficultyClassificationOutput
    
    inputs = {
        'word1': word1,
        'word2': word2,
        'user_context': user_context or ""
    }

    result = await DifficultyClassifierCrew().crew().kickoff_async(inputs=inputs)

    # CrewAI returns a result with a .pydantic attribute containing the Pydantic model
    if hasattr(result, 'pydantic'):
        return result.pydantic

    # Fallback - return a basic DifficultyClassificationOutput
    return DifficultyClassificationOutput(
        word1=word1,
        word2=word2,
        difficulty1="intermediate",
        difficulty2="intermediate",
        reasoning1="Unable to classify",
        reasoning2="Unable to classify"
    )


@traceable
async def run_router(
    message: str,
    history: list
):
    """
    Run router crew to classify user intent.
    
    Args:
        message: User's message
        history: Conversation history
        
    Returns:
        RouterOutput (Pydantic model) with intent, reasoning, source_language, target_language
    """
    from crews.tutor_router_crew.crew import TutorRouterCrew
    from crews.tutor_router_crew.schemas import RouterOutput
    
    # Initialize crew
    crew_instance = TutorRouterCrew()
    
    # Format history for crew inputs
    history_str = json.dumps(history) if history else "[]"
    
    inputs = {
        "message": message,
        "history": history_str
    }
    
    result = await crew_instance.crew().kickoff_async(inputs=inputs)
    
    # Extract RouterOutput from result
    if hasattr(result, 'pydantic'):
        router_output = result.pydantic
    else:
        # Fallback - try to parse from raw
        if hasattr(result, 'raw'):
            try:
                raw_text = str(result.raw)
                parsed = json.loads(raw_text)
                router_output = RouterOutput(
                    intent=parsed.get('intent', 'translation'),
                    reasoning=parsed.get('reasoning', ''),
                    source_language=parsed.get('source_language'),
                    target_language=parsed.get('target_language')
                )
            except (json.JSONDecodeError, Exception):
                # Default fallback
                router_output = RouterOutput(
                    intent='translation',
                    reasoning='Unable to classify intent',
                    source_language=None,
                    target_language=None
                )
        else:
            router_output = RouterOutput(
                intent='translation',
                reasoning='Unable to classify intent',
                source_language=None,
                target_language=None
            )
    
    return router_output


@traceable
async def run_general_tutor(
    message: str,
    history: list,
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    user_context: str = ""
) -> dict:
    """
    Run general tutor crew for grammar, examples, practice, cultural context, etc.
    
    Args:
        message: User's message
        history: Conversation history
        source_language: Source language (optional)
        target_language: Target language (optional)
        user_context: User context string
        
    Returns:
        Structured response: { response_type: "text", content: "..." }
    """
    from crews.general_tutor_crew.crew import GeneralTutorCrew
    
    # Initialize crew
    crew_instance = GeneralTutorCrew()
    
    # Format history for crew inputs
    history_str = json.dumps(history) if history else "[]"
    
    inputs = {
        "message": message,
        "history": history_str,
        "source_language": source_language or "English",
        "target_language": target_language or "English",
        "user_context": user_context or ""
    }
    
    result = await crew_instance.crew().kickoff_async(inputs=inputs)
    
    # Extract content from result
    content = ""
    raw_response = None
    
    if hasattr(result, 'pydantic'):
        tutor_output = result.pydantic
        content = tutor_output.content
        raw_response = tutor_output.model_dump_json(indent=2)
    elif hasattr(result, 'raw'):
        content = str(result.raw)
        raw_response = content
    else:
        content = str(result)
        raw_response = content
    
    # Return structured response
    response = {
        "response_type": "text",
        "content": content
    }
    
    if raw_response and raw_response != content:
        response["raw"] = raw_response
    
    return response


@traceable
async def handle_off_topic(
    message: str,
    history: list,
    user_context: str = ""
) -> dict:
    """
    Handle off-topic requests with a polite refusal.
    
    Args:
        message: User's message (off-topic)
        history: Conversation history
        user_context: User context string
        
    Returns:
        Structured response: { response_type: "text", content: "..." }
    """
    from crews.general_tutor_crew.crew import GeneralTutorCrew
    
    # Initialize crew
    crew_instance = GeneralTutorCrew()
    
    # Format history for crew inputs
    history_str = json.dumps(history) if history else "[]"
    
    # Create a special prompt for off-topic refusal
    # IMPORTANT: This is a REFUSAL, not a helpful response to the off-topic question
    off_topic_message = (
        "You are a language learning tutor. A user asked you a question that is NOT about language learning.\n\n"
        f"Their question was: \"{message}\"\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. DO NOT answer their question. DO NOT provide instructions, explanations, or information about cooking, recipes, or any non-language topics.\n"
        "2. Politely explain that you specialize ONLY in language learning.\n"
        "3. List what you CAN help with (translations, vocabulary, grammar, examples, practice, cultural context).\n"
        "4. Suggest language learning examples they could ask instead.\n"
        "5. Keep your response brief (2-3 sentences) and friendly.\n\n"
        "Example of what you should say:\n"
        "\"I'm sorry, but I specialize in language learning and can only help with translations, vocabulary, grammar, and language practice. "
        "For example, you could ask 'How do you say hello in Polish?' or 'Give me a new word to learn.'\"\n\n"
        "Now respond to the user's off-topic question with a polite refusal."
    )
    
    inputs = {
        "message": off_topic_message,
        "history": history_str,
        "source_language": "English",
        "target_language": "English",
        "user_context": user_context or ""
    }
    
    result = await crew_instance.crew().kickoff_async(inputs=inputs)
    
    # Extract content from result
    content = ""
    raw_response = None
    
    if hasattr(result, 'pydantic'):
        tutor_output = result.pydantic
        content = tutor_output.content
        raw_response = tutor_output.model_dump_json(indent=2)
    elif hasattr(result, 'raw'):
        content = str(result.raw)
        raw_response = content
    else:
        content = str(result)
        raw_response = content
    
    # Return structured response
    response = {
        "response_type": "text",
        "content": content
    }
    
    if raw_response and raw_response != content:
        response["raw"] = raw_response
    
    return response


@app.route("/health", methods=["GET"])
async def health():
    """Health check endpoint."""
    return jsonify({"status": "healthy"}), 200


@app.route("/api/random-phrase", methods=["POST"])
@require_auth
async def get_random_phrase():
    """
    Generate a random phrase based on provided words and user context.

    Request body:
        {
            "words": ["word1", "word2", ...]
        }

    Headers:
        Authorization: Bearer <jwt_token>

    Response:
        {
            "phrase": "generated phrase",
            "words_used": ["word1", "word2"]
        }
    """
    try:
        # Get words from request body
        data = request.get_json()

        if not data or "words" not in data:
            return jsonify({"error": "Request body must include 'words' array"}), 400

        words = data.get("words", [])

        if not isinstance(words, list) or len(words) == 0:
            return jsonify({"error": "'words' must be a non-empty array"}), 400

        # Get user context from Supabase
        user_id = request.user.id
        user_context = await get_user_context(user_id)

        # Generate the phrase
        result = await generate_random_phrase(words, user_context or "")
        
        # Import PhraseOutput for type checking
        from crews.random_phrase_crew.schemas import PhraseOutput

        return jsonify(result.model_dump()), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


@app.route("/api/example-sentences", methods=["POST"])
@require_auth
async def get_example_sentences():
    """
    Generate example sentences for a word pair based on user context.

    Request body:
        {
            "word1": "first word",
            "word2": "second word"
        }

    Headers:
        Authorization: Bearer <jwt_token>

    Response:
        {
            "sentences": ["sentence 1", "sentence 2", "sentence 3"],
            "word1": "first word",
            "word2": "second word"
        }
    """
    try:
        # Get words from request body
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body is required"}), 400

        word1 = data.get("word1")
        word2 = data.get("word2")

        if not word1 or not word2:
            return jsonify({"error": "Request body must include 'word1' and 'word2' fields"}), 400

        if not isinstance(word1, str) or not isinstance(word2, str):
            return jsonify({"error": "'word1' and 'word2' must be strings"}), 400

        # Get user context from Supabase
        user_id = request.user.id
        user_context = await get_user_context(user_id)

        # Generate the example sentences
        result = await generate_example_sentences(word1, word2, user_context or "")

        return jsonify(result.model_dump()), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


@app.route("/api/classify-difficulty", methods=["POST"])
@require_auth
async def get_difficulty_classification():
    """
    Classify difficulty level for a word pair based on user context.

    Request body:
        {
            "word1": "first word",
            "word2": "second word"
        }

    Headers:
        Authorization: Bearer <jwt_token>

    Response:
        {
            "word1": "first word",
            "word2": "second word",
            "difficulty1": "beginner|intermediate|advanced",
            "difficulty2": "beginner|intermediate|advanced",
            "reasoning1": "explanation for word1",
            "reasoning2": "explanation for word2"
        }
    """
    try:
        # Get words from request body
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body is required"}), 400

        word1 = data.get("word1")
        word2 = data.get("word2")

        if not word1 or not word2:
            return jsonify({"error": "Request body must include 'word1' and 'word2' fields"}), 400

        if not isinstance(word1, str) or not isinstance(word2, str):
            return jsonify({"error": "'word1' and 'word2' must be strings"}), 400

        # Get user context from Supabase
        user_id = request.user.id
        user_context = await get_user_context(user_id)

        # Classify the difficulty
        result = await classify_difficulty(word1, word2, user_context or "")

        return jsonify(result.model_dump()), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


@app.route("/api/chat", methods=["POST"])
@require_auth
async def post_chat():
    """
    Chat endpoint for language tutor interactions.
    
    Request body:
        {
            "message": "User's message",
            "history": [{"role": "user", "content": "..."}, ...],
            "intent": "translation" | "vocabulary" | "grammar" | "example_sentences" | "practice" | "cultural" | "save_word" | "off_topic" | null
        }
    
    Headers:
        Authorization: Bearer <jwt_token>
    
    Response:
        {
            "response_type": "text" | "word_card" | "save_confirmation",
            "content": "...",  // for text
            "payload": {...},  // for word_card
            "message": "...",  // for save_confirmation
            "tool_results": [...]  // optional array of tool execution results
        }
    
    Note:
        If intent is not provided, the router crew will automatically classify the intent.
        Off-topic requests will receive a polite refusal explaining the tutor's specialization.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Request body is required"}), 400
        
        message = data.get("message")
        if not message or not isinstance(message, str):
            return jsonify({"error": "Request body must include 'message' field (string)"}), 400
        
        history = data.get("history", [])
        if not isinstance(history, list):
            return jsonify({"error": "'history' must be an array"}), 400
        
        intent = data.get("intent")  # Optional: can be null for auto-detection
        
        # Get user context
        user_id = request.user.id
        user_context = await get_user_context(user_id)
        
        # Pre-check for obvious off-topic patterns before router
        # This helps catch cases where router might misclassify
        message_lower = message.lower()
        off_topic_patterns = [
            "how to cook",
            "how to make",
            "recipe for",
            "recipe to",
            "how to prepare",
            "how to bake",
            "how to fry",
            "how to grill",
            "cooking instructions",
            "how to do",  # Generic how-to (not "how to say")
            "how to use",  # Generic how-to (not language-related)
        ]
        
        # Check if message contains off-topic patterns but NOT language learning patterns
        language_patterns = [
            "how to say",
            "how do you say",
            "translate",
            "translation",
            "in english",
            "in polish",
            "in spanish",
            "in french",
            "in german",
            "in italian",
            "in russian",
            "in japanese",
            "in chinese",
            "word for",
            "phrase for",
        ]
        
        is_off_topic_pattern = any(pattern in message_lower for pattern in off_topic_patterns)
        is_language_pattern = any(pattern in message_lower for pattern in language_patterns)
        
        # If intent not specified, use router to classify
        source_language = None
        target_language = None
        if not intent:
            router_output = await run_router(message, history)
            intent = router_output.intent
            source_language = router_output.source_language
            target_language = router_output.target_language
            
            # Override router classification if we detect obvious off-topic pattern
            # but router classified it as something else (except if it's clearly language-related)
            if is_off_topic_pattern and not is_language_pattern and intent != "off_topic":
                intent = "off_topic"
                print(f"DEBUG: Overriding router intent to 'off_topic' for message: {message[:50]}...")
        else:
            # Even if intent is explicitly provided, check for obvious off-topic patterns
            # and override if detected (unless it's clearly language-related)
            if is_off_topic_pattern and not is_language_pattern and intent != "off_topic":
                intent = "off_topic"
                print(f"DEBUG: Overriding explicit intent to 'off_topic' for message: {message[:50]}...")
        
        # Route to appropriate crew based on intent
        if intent == "off_topic":
            result = await handle_off_topic(
                message=message,
                history=history,
                user_context=user_context or ""
            )
        elif intent == "vocabulary" or intent == "new_word":
            result = await run_vocabulary(
                message=message,
                history=history,
                source_language=source_language,
                target_language=target_language,
                user_id=user_id,
                user_context=user_context or ""
            )
        elif intent == "translation":
            result = await run_translation(
                message=message,
                history=history,
                source_language=source_language,
                target_language=target_language,
                user_id=user_id,
                user_context=user_context or ""
            )
        else:
            # Handle other intents: grammar, example_sentences, practice, cultural, save_word
            # Use general tutor crew
            result = await run_general_tutor(
                message=message,
                history=history,
                source_language=source_language,
                target_language=target_language,
                user_context=user_context or ""
            )
        
        # Ensure response_type is set
        if not result.get("response_type"):
            if "payload" in result:
                result["response_type"] = "word_card"
            else:
                result["response_type"] = "text"
        
        return jsonify(result), 200
        
    except Exception as e:
        # Handle RateLimitError specifically for better error messages
        error_msg = str(e)
        if "RateLimitError" in error_msg or "rate_limit" in error_msg.lower():
            # Extract rate limit info if available
            if "Please try again in" in error_msg:
                # Try to extract the time from the error message
                import re
                time_match = re.search(r"Please try again in ([\d\.]+[smh])", error_msg)
                if time_match:
                    wait_time = time_match.group(1)
                    error_msg = f"Rate limit reached. Please try again in {wait_time}. {error_msg}"
        
        return jsonify({"error": f"An error occurred: {error_msg}"}), 500


@app.route("/api/words-game", methods=["POST"])
@require_auth
async def get_words_game():
    """
    Generate text with placeholders for the words game.

    Request body:
        {
            "words": ["word1", "word2", "word3"]
        }

    Headers:
        Authorization: Bearer <jwt_token>

    Response:
        {
            "text_with_placeholders": "The ___ jumped over the ___.",
            "words_in_order": ["word1", "word2", "word3"]
        }
    """
    try:
        data = request.get_json()

        if not data or "words" not in data:
            return jsonify({"error": "Request body must include 'words' array"}), 400

        words = data.get("words", [])

        if not isinstance(words, list) or len(words) != 3:
            return jsonify({"error": "'words' must be an array of exactly 3 strings"}), 400

        user_id = request.user.id
        user_context = await get_user_context(user_id)

        result = await generate_words_game(words, user_context or "")

        return jsonify(result.model_dump()), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


@app.route("/api/livekit/token", methods=["POST"])
@require_auth
async def get_livekit_token():
    """
    Generate a LiveKit access token for the voice word game.

    Headers:
        Authorization: Bearer <jwt_token>

    Response:
        {
            "token": "<livekit_jwt>",
            "url": "wss://your-project.livekit.cloud"
        }
    """
    import uuid
    from livekit.api import AccessToken, VideoGrants

    livekit_api_key = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET", "")
    livekit_url = os.getenv("LIVEKIT_URL", "")

    if not livekit_api_key or not livekit_api_secret or not livekit_url:
        return jsonify({"error": "LiveKit is not configured on the server"}), 503

    user_id = request.user.id
    room_name = f"wordpan-voice-{user_id}-{uuid.uuid4().hex[:8]}"

    token = (
        AccessToken(livekit_api_key, livekit_api_secret)
        .with_identity(user_id)
        .with_name("Player")
        .with_grants(VideoGrants(room_join=True, room=room_name))
        .with_metadata(user_id)
        .to_jwt()
    )

    return jsonify({"token": token, "url": livekit_url})


if __name__ == "__main__":
    # Run the Flask app
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
