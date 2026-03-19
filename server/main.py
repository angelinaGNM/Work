from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from server import orchestrator
from server.kb.loader import reload_kb
from server.guardrails import reload_guardrails, get_guardrails_status
from server.dnif.api_client import DNIFAPIClient
from server.speech.transcriber import transcribe_audio
import server.mcp  # noqa: F401 — registers all tools, resources, prompts
from server.mcp.server import mcp, get_asgi_app as _mcp_asgi_app


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the MCP session manager (required for Streamable HTTP transport)
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="BLOO Copilot API", version="0.1.0", lifespan=lifespan)

# Mount MCP server at /mcp (Streamable HTTP transport)
app.mount("/mcp", _mcp_asgi_app())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_SKILLS = {
    "translate_to_dql", "explain_signal", "suggest_investigation",
    "suggest_visualization", "threat_hunt", "incident_response",
    "platform_faq", "executive_summary",
    # Module integrations (Phase 3+)
    "b_epm", "b_ueba", "b_nbad",
}

VALID_PROVIDERS = {"anthropic", "openai"}


class ChatRequest(BaseModel):
    query: str
    skill: str | None = None
    context: dict | None = None
    provider: str | None = None

    @property
    def resolved_skill(self) -> str | None:
        if self.skill and self.skill in VALID_SKILLS:
            return self.skill
        return None

    @property
    def resolved_provider(self) -> str | None:
        if self.provider and self.provider in VALID_PROVIDERS:
            return self.provider
        return None


@app.post("/copilot/chat")
async def chat(request: ChatRequest):
    async def event_stream():
        async for event in orchestrator.run(
            query=request.query,
            skill=request.resolved_skill,
            context=request.context,
            provider=request.resolved_provider,
        ):
            yield event.to_sse()

    return EventSourceResponse(event_stream())


@app.post("/copilot/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    text = await transcribe_audio(audio_bytes, audio.filename or "audio.webm")
    return {"text": text}


@app.post("/copilot/kb/reload")
async def reload_knowledge_base():
    reload_kb()
    return {"status": "ok", "message": "Knowledge base reloaded."}


@app.get("/copilot/guardrails/status")
async def guardrails_status():
    return get_guardrails_status()


@app.post("/copilot/guardrails/reload")
async def guardrails_reload():
    total = reload_guardrails()
    return {"status": "ok", "total_active": total}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/dnif/test")
async def dnif_test():
    """Test DNIF API connectivity with a minimal DQL query."""
    client = DNIFAPIClient()
    if not client.enabled:
        return {"status": "disabled", "message": "Set DNIF_API_ENABLED=true in .env"}
    try:
        result = await client.execute_dql("stream=firewall | limit 1")
        return {"status": "ok", "total_records": result.get("total_records"), "sample": result.get("results", [])[:1]}
    except Exception as e:
        return {"status": "error", "message": str(e)}
