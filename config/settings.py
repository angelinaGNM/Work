from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # LLM
    llm_provider: str = "anthropic"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1"

    # DNIF API
    dnif_api_enabled: bool = False
    dnif_console_domain: str = ""
    dnif_cluster_id: str = ""
    dnif_api_token: str = ""
    dnif_scope_id: str = "training"
    dnif_timezone: str = "Asia/Kolkata"
    dnif_poll_interval: int = 5
    dnif_max_wait_time: int = 180

    # Speech
    whisper_model: str = "whisper-1"

    # MCP server
    mcp_api_key: str = ""   # set to require X-API-Key header on /mcp

    # Guardrails — Layer 1.5 LLM classifier + auto-promote
    guardrail_auto_promote: bool = True
    guardrail_auto_promote_threshold: float = 0.95
    guardrail_classifier_model: str = "claude-haiku-4-5-20251001"

    # Paths
    kb_path: str = "kb"
    prompts_path: str = "prompts"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def kb_dir(self) -> Path:
        return Path(__file__).parent.parent / self.kb_path

    @property
    def prompts_dir(self) -> Path:
        return Path(__file__).parent.parent / self.prompts_path


settings = Settings()
