import asyncio
import os
import warnings
from functools import wraps
from typing import Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client

from crews.random_phrase_crew.crew import RandomPhraseCrew
from crews.random_phrase_crew.schemas import PhraseOutput
from crews.example_sentences_crew.crew import ExampleSentencesCrew
from crews.example_sentences_crew.schemas import ExampleSentencesOutput
from crews.difficulty_classifier_crew.crew import DifficultyClassifierCrew
from crews.difficulty_classifier_crew.schemas import DifficultyClassificationOutput

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
async def generate_random_phrase(words: list[str], user_context: str) -> PhraseOutput:
    """
    Generate a random phrase using the RandomPhraseCrew.

    Args:
        words: List of words to use in the phrase
        user_context: User context to personalize the phrase

    Returns:
        PhraseOutput with phrase and words used
    """
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
async def generate_example_sentences(word1: str, word2: str, user_context: str) -> ExampleSentencesOutput:
    """
    Generate example sentences using the ExampleSentencesCrew.

    Args:
        word1: First word from the word pair
        word2: Second word from the word pair
        user_context: User context to personalize the sentences

    Returns:
        ExampleSentencesOutput with sentences and words
    """
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
async def classify_difficulty(word1: str, word2: str, user_context: str) -> DifficultyClassificationOutput:
    """
    Classify word difficulty using the DifficultyClassifierCrew.

    Args:
        word1: First word from the word pair
        word2: Second word from the word pair
        user_context: User context to personalize the classification

    Returns:
        DifficultyClassificationOutput with difficulty levels and reasoning
    """
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


if __name__ == "__main__":
    # Run the Flask app
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)
