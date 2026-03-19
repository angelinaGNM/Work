from typing import AsyncIterator
from openai import AsyncOpenAI

from server.llm.base import LLMClient
from config.settings import settings


class OpenAIClient(LLMClient):

    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_model

    async def stream_complete(self, system: str, messages: list[dict]) -> AsyncIterator[str]:
        full_messages = [{"role": "system", "content": system}] + messages
        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=full_messages,
            stream=True,
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content

    async def complete(self, system: str, messages: list[dict]) -> str:
        full_messages = [{"role": "system", "content": system}] + messages
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=full_messages,
        )
        return response.choices[0].message.content
