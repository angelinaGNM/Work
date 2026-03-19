from server.llm.base import LLMClient
from server.llm.anthropic_client import AnthropicClient
from server.llm.openai_client import OpenAIClient
from config.settings import settings


def get_llm_client(provider: str | None = None) -> LLMClient:
    """Return the LLM client for the given provider.

    Provider priority: request-level override → LLM_PROVIDER env var.
    """
    resolved = provider or settings.llm_provider
    if resolved == "openai":
        return OpenAIClient()
    return AnthropicClient()
