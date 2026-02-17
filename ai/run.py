import asyncio
import json
import os
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

# Optional service role client for server-side writes (chats, word_pairs)
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
supabase_admin: Optional[Client] = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_SERVICE_ROLE_KEY else None
)


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
        'words': json.dumps(words),
        'user_context': user_context or ""
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


def _format_history(history: list[dict[str, str]]) -> str:
    """Format conversation history for crew prompts."""
    if not history:
        return "(No previous messages)"
    lines = []
    for h in history[-10:]:  # last 10 turns
        role = h.get("role", "user")
        content = (h.get("content") or "").strip()
        if role == "user":
            lines.append(f"User: {content}")
        else:
            lines.append(f"Assistant: {content}")
    return "\n".join(lines)


OFF_TOPIC_REFUSAL = (
    "I appreciate your message! However, I'm your language tutor and can only help with "
    "language-related questions. I can help you with translations, new vocabulary, grammar, "
    "example sentences, or practice. What would you like to work on?"
)


@traceable
async def run_tutor_router(message: str, history: list[dict[str, str]]):
    """Run router crew and return RouterOutput."""
    from crews.tutor_router_crew.crew import TutorRouterCrew
    from crews.tutor_router_crew.schemas import RouterOutput

    history_str = _format_history(history)
    inputs = {
        "message": message,
        "history": history_str,
    }
    result = await TutorRouterCrew().crew().kickoff_async(inputs=inputs)
    if hasattr(result, "pydantic"):
        return result.pydantic
    return RouterOutput(intent="off_topic", reasoning="Fallback", source_language=None, target_language=None)


@traceable
async def run_translation(message: str, history: list[dict[str, str]], source_lang: Optional[str], target_lang: Optional[str]):
    """Run translation crew and return content."""
    from crews.translation_crew.crew import TranslationCrew
    from crews.translation_crew.schemas import TranslationOutput

    history_str = _format_history(history)
    inputs = {
        "message": message,
        "history": history_str,
        "source_language": source_lang or "unknown",
        "target_language": target_lang or "unknown",
    }
    result = await TranslationCrew().crew().kickoff_async(inputs=inputs)
    if hasattr(result, "pydantic"):
        return result.pydantic.content
    return str(result)


@traceable
async def run_vocabulary(message: str, history: list[dict[str, str]], source_lang: Optional[str], target_lang: Optional[str]):
    """Run vocabulary crew and return WordCardOutput."""
    from crews.vocabulary_crew.crew import VocabularyCrew
    from crews.vocabulary_crew.schemas import WordCardOutput

    history_str = _format_history(history)
    inputs = {
        "message": message,
        "history": history_str,
        "source_language": source_lang or "unknown",
        "target_language": target_lang or "unknown",
    }
    result = await VocabularyCrew().crew().kickoff_async(inputs=inputs)
    if hasattr(result, "pydantic"):
        return result.pydantic
    return WordCardOutput(word="", translation="", example_sentence="", definition=None)


@traceable
async def run_general_tutor(message: str, history: list[dict[str, str]], source_lang: Optional[str], target_lang: Optional[str]):
    """Run general tutor crew and return content."""
    from crews.general_tutor_crew.crew import GeneralTutorCrew
    from crews.general_tutor_crew.schemas import GeneralTutorOutput

    history_str = _format_history(history)
    inputs = {
        "message": message,
        "history": history_str,
        "source_language": source_lang or "unknown",
        "target_language": target_lang or "unknown",
    }
    result = await GeneralTutorCrew().crew().kickoff_async(inputs=inputs)
    if hasattr(result, "pydantic"):
        return result.pydantic.content
    return str(result)


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


@app.route("/health", methods=["GET"])
def health():
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


@app.route("/api/chat", methods=["POST"])
@require_auth
async def post_chat():
    """
    Handle chat message: route by intent, run specialist crew, return text or word_card.

    Body: { "chat_id": "uuid" (optional), "message": "user text", "history": [ { "role", "content" } ] }
    Returns: { "content": "..." } or { "response_type": "word_card", "payload": { "word", "translation", ... } }
    """
    try:
        data = request.get_json()
        if not data or "message" not in data:
            return jsonify({"error": "Request body must include 'message'"}), 400

        message = (data.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        history = data.get("history")
        if history is not None and not isinstance(history, list):
            return jsonify({"error": "'history' must be an array"}), 400
        history = history or []

        user_id = request.user.id
        chat_id = data.get("chat_id")

        # Optional: ensure chat belongs to user (if backend will persist)
        if chat_id and supabase_admin:
            try:
                r = supabase_admin.table("chats").select("id").eq("id", chat_id).eq("user_id", user_id).single().execute()
                if not r.data:
                    return jsonify({"error": "Chat not found or access denied"}), 404
            except Exception:
                return jsonify({"error": "Chat not found or access denied"}), 404

        # Run router
        router_out = await run_tutor_router(message, history)
        intent = (router_out.intent or "").strip().lower()
        source_lang = getattr(router_out, "source_language", None) or None
        target_lang = getattr(router_out, "target_language", None) or None

        # Dispatch by intent
        if intent == "off_topic":
            return jsonify({"content": OFF_TOPIC_REFUSAL}), 200

        if intent == "translation":
            content = await run_translation(message, history, source_lang, target_lang)
            return jsonify({"content": content}), 200

        if intent == "new_word":
            card = await run_vocabulary(message, history, source_lang, target_lang)
            payload = {
                "word": card.word,
                "translation": card.translation,
                "example_sentence": card.example_sentence,
                "definition": getattr(card, "definition", None),
            }
            return jsonify({"response_type": "word_card", "payload": payload}), 200

        # grammar, example_sentences, practice, cultural, save_word
        content = await run_general_tutor(message, history, source_lang, target_lang)
        return jsonify({"content": content}), 200

    except asyncio.TimeoutError:
        return jsonify({"error": "Request timed out"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat/save-word", methods=["POST"])
@require_auth
async def post_chat_save_word():
    """
    Save a word pair from chat (e.g. from word card "Add to my list").

    Body: { "word1": "...", "word2": "...", "description": "..." (optional) }
    Requires SUPABASE_SERVICE_ROLE_KEY for server-side insert; otherwise use frontend Supabase insert.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        word1 = data.get("word1") or ""
        word2 = data.get("word2") or ""
        description = data.get("description")

        if not word1.strip() or not word2.strip():
            return jsonify({"error": "word1 and word2 are required"}), 400

        user_id = request.user.id

        if not supabase_admin:
            return (
                jsonify(
                    {
                        "error": "Server-side save is not configured (SUPABASE_SERVICE_ROLE_KEY). "
                        "Use frontend Supabase to insert into word_pairs."
                    }
                ),
                503,
            )

        supabase_admin.table("word_pairs").insert(
            {
                "user_id": user_id,
                "word1": word1.strip(),
                "word2": word2.strip(),
                "description": (description or "").strip() or None,
            }
        ).execute()

        return jsonify({"ok": True}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Run the Flask app
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
