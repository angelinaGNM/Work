from typing import AsyncIterator
import anthropic

from server.llm.base import LLMClient
from config.settings import settings


class AnthropicClient(LLMClient):

    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.anthropic_model

    async def stream_complete(self, system: str, messages: list[dict]) -> AsyncIterator[str]:
        async with self._client.messages.stream(
            model=self._model,
            max_tokens=4096,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def complete(self, system: str, messages: list[dict]) -> str:
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=system,
            messages=messages,
        )
        return response.content[0].text
