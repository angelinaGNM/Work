import io

from openai import AsyncOpenAI

from config.settings import settings


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    audio_io = io.BytesIO(audio_bytes)
    audio_io.name = filename

    result = await client.audio.transcriptions.create(
        model=settings.whisper_model,
        file=audio_io,
    )
    return result.text
