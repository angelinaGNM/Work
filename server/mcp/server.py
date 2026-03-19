"""
BLOO Copilot — MCP Server

Creates the shared FastMCP instance and exposes the ASGI app for mounting
in main.py at /mcp. Tools, resources, and prompts are registered by their
respective modules when server/mcp/__init__.py is imported.

Transport: Streamable HTTP (MCP spec 2025-03-26)
Registration: claude mcp add bloo-copilot http://localhost:8000/mcp
"""

from mcp.server.fastmcp import FastMCP
from config.settings import settings

mcp = FastMCP(
    name="BLOO Copilot",
    instructions=(
        "BLOO Copilot is a read-only AI security analytics assistant for DNIF Hypercloud. "
        "Use translate_to_dql to query security events using natural language. "
        "Use platform_faq to answer questions about the Bloo platform. "
        "All queries are capped at 20 records and 3 days duration."
    ),
    # Path / so when mounted at /mcp in FastAPI the endpoint is http://host/mcp/
    streamable_http_path="/",
    # Return JSON responses instead of SSE — required for Claude Code HTTP transport
    # compatibility (Claude Code does not send Accept: text/event-stream)
    json_response=True,
)


def get_asgi_app():
    """Return the ASGI app for the MCP server (Streamable HTTP transport)."""
    base_app = mcp.streamable_http_app()

    if not settings.mcp_api_key:
        return base_app

    # Wrap with API key auth when MCP_API_KEY is configured
    class _APIKeyMiddleware:
        def __init__(self, app):
            self._app = app

        async def __call__(self, scope, receive, send):
            if scope["type"] in ("http", "websocket"):
                headers = dict(scope.get("headers", []))
                provided = headers.get(b"x-api-key", b"").decode()
                if provided != settings.mcp_api_key:
                    async def _send_401(send):
                        await send({
                            "type": "http.response.start",
                            "status": 401,
                            "headers": [[b"content-type", b"text/plain"]],
                        })
                        await send({
                            "type": "http.response.body",
                            "body": b"Unauthorized: missing or invalid X-API-Key header",
                        })
                    await _send_401(send)
                    return
            await self._app(scope, receive, send)

    return _APIKeyMiddleware(base_app)
