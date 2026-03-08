"""WordPan Voice Word Game Agent

A LiveKit voice agent that quizzes users on their word pair translations.
The agent fetches word pairs from Supabase and runs an interactive voice game.
"""

import asyncio
import os
import random
import logging

from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.plugins import cartesia, groq, silero
from supabase import create_client

load_dotenv()

logger = logging.getLogger("wordpan-voice-agent")
logger.setLevel(logging.INFO)


async def fetch_word_pairs(user_id: str) -> list[dict]:
    """Fetch the user's word pairs from Supabase using the service role key."""
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not supabase_key:
        logger.warning("Supabase credentials not configured — using demo word pairs")
        return [
            {"word1": "cat", "word2": "gato"},
            {"word1": "dog", "word2": "cachorro"},
            {"word1": "house", "word2": "casa"},
            {"word1": "water", "word2": "água"},
            {"word1": "book", "word2": "livro"},
        ]

    try:
        client = create_client(supabase_url, supabase_key)
        result = (
            client.table("word_pairs")
            .select("word1,word2")
            .eq("user_id", user_id)
            .execute()
        )
        pairs = result.data or []
        if not pairs:
            logger.info(f"No word pairs found for user {user_id}, using demo pairs")
            return [
                {"word1": "cat", "word2": "gato"},
                {"word1": "dog", "word2": "cachorro"},
                {"word1": "house", "word2": "casa"},
            ]
        logger.info(f"Loaded {len(pairs)} word pairs for user {user_id}")
        return pairs
    except Exception as e:
        logger.error(f"Error fetching word pairs: {e}")
        return []


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # The user_id is passed as participant metadata via the LiveKit token (.with_metadata)
    # ctx.room.metadata is the room metadata (empty); participant metadata holds the user_id
    user_id = ""
    # Try immediately (participant is usually already in the room)
    for participant in ctx.room.remote_participants.values():
        if participant.metadata:
            user_id = participant.metadata
            break
    # If not yet present, wait briefly for the participant to join
    if not user_id:
        for _ in range(10):
            await asyncio.sleep(0.5)
            for participant in ctx.room.remote_participants.values():
                if participant.metadata:
                    user_id = participant.metadata
                    break
            if user_id:
                break
    logger.info(f"Session started for user_id={user_id!r}")

    word_pairs = await fetch_word_pairs(user_id)

    if not word_pairs:
        # No words — agent will explain and exit gracefully
        system_prompt = (
            "Ты пьяный пират-капитан Борода, который говорит только по-русски. "
            "У игрока нет сохранённых слов. Скажи ему об этом в пиратском стиле — "
            "пусть добавит слова в раздел Word Pairs и возвращается. Коротко, по-пиратски."
        )
    else:
        # Shuffle for variety
        random.shuffle(word_pairs)
        words_list = "\n".join(
            f"- {p['word1']} → {p['word2']}" for p in word_pairs
        )
        system_prompt = f"""Ты — пьяный пират-капитан Борода. Ты говоришь ТОЛЬКО по-русски, с пиратскими словечками ("Йо-хо-хо!", "Арр!", "Ха-ха!", "Клянусь якорем!"), немного заплетающимся языком — как будто выпил рому. Ты ведёшь игру по переводу слов.

Слова игрока (word1 — вопрос на русском, word2 — правильный ответ на английском):
{words_list}

Правила игры:
1. Поприветствуй игрока по-пиратски и объясни игру одной фразой.
2. Спрашивай: "Как будет '[word1]' по-английски?" — по очереди, возвращаясь к началу.
3. Жди ответа игрока.
4. Оцени ответ:
   - ПРАВИЛЬНО если совпадает с word2 (принимай варианты произношения и небольшие ошибки).
   - НЕПРАВИЛЬНО в остальных случаях.
5. Если правильно: коротко похвали по-пиратски ("Йо-хо-хо, правильно, морской волк!") и сразу следующее слово.
6. Если неправильно: скажи ответ ("Арр, неверно! '[word1]' — это '[word2]'.") и следующее слово.
7. Все ответы КОРОТКИЕ — максимум 2 предложения. Говори с огнём и пиратским задором.
8. Если игрок говорит "стоп", "хватит", "выход" или "всё": поздравь его и заверши сессию.
9. НИКОГДА не раскрывай ответ до того, как игрок ответил.
10. Считай очки в уме и назови итог в конце."""

    session = AgentSession(
        vad=silero.VAD.load(),
        # detect_language=True handles both Russian (stop commands) and English (answers)
        stt=groq.STT(model="whisper-large-v3-turbo", detect_language=True),
        llm=groq.LLM(model="llama-3.3-70b-versatile"),
        tts=cartesia.TTS(
            # Ronald - Thinker: deep, intense masculine voice
            voice="5ee9feff-1265-424a-9d7f-8e4d431a12c7",
            model="sonic-2",
            language="ru",
            word_timestamps=False,
        ),
        min_endpointing_delay=0.2,
        max_endpointing_delay=2.0,
        min_interruption_duration=0.8,  # prevent accidental interruptions from background noise
        aec_warmup_duration=0,          # disable 3s AEC warmup — causes "deaf" window after greeting
    )

    await session.start(
        agent=Agent(instructions=system_prompt),
        room=ctx.room,
    )

    if word_pairs:
        first_word = word_pairs[0]["word1"]
        await session.say(
            f"Арр! Как будет '{first_word}' по-английски?",
            allow_interruptions=True,
        )
    else:
        await session.say(
            "Арр! У тебя нет слов в трюме. Добавь слова и возвращайся, юнга!",
            allow_interruptions=False,
        )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
