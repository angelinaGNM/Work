from pathlib import Path
from functools import lru_cache
from config.settings import settings

# ── DDM filename overrides (where filename ≠ STREAMNAME_DDM) ─────────────────
_DDM_FILENAME_OVERRIDES: dict[str, str] = {
    "ep-config": "EP-CONFID_DDM",
}

@lru_cache(maxsize=None)
def load_stream_ddm(stream_name: str) -> str | None:
    """
    Load field names for a given stream from its DDM file in kb/ddm/.
    Returns a formatted string of field names, or None if no DDM file exists.
    Cached per stream name after first read.
    """
    filename = _DDM_FILENAME_OVERRIDES.get(
        stream_name.lower(),
        stream_name.upper() + "_DDM",
    )
    path = Path(settings.kb_dir) / "ddm" / filename
    if not path.exists():
        return None
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    fields = []
    for line in lines:
        parts = line.strip().split("\t")
        if len(parts) >= 2 and parts[1].strip():
            fields.append(parts[1].strip().lower())
    if not fields:
        return None
    return ", ".join(fields)


@lru_cache(maxsize=None)
def load_dql_kb() -> str:
    """Load the full DQL knowledge base. Cached after first read."""
    path = Path(settings.kb_dir) / "dql-kb.md"
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def load_dql_quick_ref() -> str:
    """Load the compact DQL quick reference for runtime LLM context."""
    path = Path(settings.kb_dir) / "dql-quick-ref.md"
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def load_system_prompt() -> str:
    """Load the master system prompt."""
    path = Path(settings.prompts_dir) / "system.md"
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def load_skill_prompt(skill_name: str) -> str:
    """Load a skill-specific prompt by name."""
    path = Path(settings.prompts_dir) / "skills" / f"{skill_name}.md"
    return path.read_text(encoding="utf-8")


@lru_cache(maxsize=None)
def load_platform_kb() -> str:
    """Load the Bloo platform knowledge base."""
    path = Path(settings.kb_dir) / "bloo-platform.md"
    return path.read_text(encoding="utf-8")


def reload_kb():
    """Clear KB cache to pick up pipeline-updated files."""
    load_dql_kb.cache_clear()
    load_dql_quick_ref.cache_clear()
    load_system_prompt.cache_clear()
    load_skill_prompt.cache_clear()
    load_platform_kb.cache_clear()
    load_stream_ddm.cache_clear()
