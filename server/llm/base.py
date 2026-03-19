from abc import ABC, abstractmethod
from typing import AsyncIterator


class LLMClient(ABC):
    """Base interface for all LLM providers.

    New providers (Ollama, Azure OpenAI, private LLMs) must implement
    both methods to plug into the skill pipeline.
    """

    @abstractmethod
    async def stream_complete(
        self,
        system: str,
        messages: list[dict],
    ) -> AsyncIterator[str]:
        """Stream completion tokens one chunk at a time."""
        ...

    @abstractmethod
    async def complete(
        self,
        system: str,
        messages: list[dict],
    ) -> str:
        """Return full completion as a single string."""
        ...
