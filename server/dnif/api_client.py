"""
DNIF API Client — Phase 2.

Three-step flow:
  1. Invoke  — POST /wrk/api/job/invoke           → task_id
  2. Poll    — GET  /wrk/api/dispatcher/task/state/{task_id}
  3. Results — GET  /wrk/api/dispatcher/task/result/{task_id}
"""

import asyncio
import httpx
from config.settings import settings


class DNIFAPIClient:

    def __init__(self):
        self.enabled = settings.dnif_api_enabled
        self.base = f"https://{settings.dnif_console_domain}/{settings.dnif_cluster_id}"
        self.token = settings.dnif_api_token
        self.scope_id = settings.dnif_scope_id
        self.timezone = settings.dnif_timezone
        self.poll_interval = settings.dnif_poll_interval
        self.max_wait_time = settings.dnif_max_wait_time

    def _headers(self) -> dict:
        return {"Token": self.token, "Content-Type": "application/json"}

    async def execute_dql(self, query: str) -> dict:
        if not self.enabled:
            return self._stub_response(query)
        return await self._execute_real(query)

    def _stub_response(self, query: str) -> dict:
        return {
            "status": "stub",
            "message": "DNIF API integration is disabled (set DNIF_API_ENABLED=true).",
            "query": query,
            "results": [],
            "total_records": 0,
        }

    async def _execute_real(self, query: str) -> dict:
        async with httpx.AsyncClient(timeout=300) as client:
            # Step 1: Invoke
            task_id = await self._invoke(client, query)

            # Step 2: Poll until done
            await self._poll(client, task_id)

            # Step 3: Fetch results
            return await self._get_results(client, task_id, query)

    async def _invoke(self, client: httpx.AsyncClient, query: str) -> str:
        response = await client.post(
            f"{self.base}/wrk/api/job/invoke",
            headers=self._headers(),
            json={
                "query_timezone": self.timezone,
                "scope_id": self.scope_id,
                "job_type": "dql",
                "job_execution": "on-demand",
                "query": query,
            },
        )
        response.raise_for_status()
        data = response.json()
        if data.get("status") != "success":
            raise RuntimeError(f"Invoke failed: {data.get('message', 'unknown error')}")
        task_id = data.get("data", [{}])[0].get("id")
        if not task_id:
            raise RuntimeError("No task_id returned from invoke")
        return task_id

    async def _poll(self, client: httpx.AsyncClient, task_id: str) -> None:
        max_checks = self.max_wait_time // self.poll_interval
        for _ in range(max_checks):
            response = await client.get(
                f"{self.base}/wrk/api/dispatcher/task/state/{task_id}",
                headers={"Token": self.token},
            )
            response.raise_for_status()
            data = response.json()
            state = data.get("task_state")
            if state == "SUCCESS":
                return
            if state in ("FAILED", "QUERY_WORKERS_DOWN"):
                raise RuntimeError(f"Query failed: task_state={state}, stage={data.get('task_stage')}")
            await asyncio.sleep(self.poll_interval)
        raise RuntimeError(f"Query timed out after {self.max_wait_time}s (task_id={task_id})")

    async def _get_results(self, client: httpx.AsyncClient, task_id: str, query: str) -> dict:
        response = await client.get(
            f"{self.base}/wrk/api/dispatcher/task/result/{task_id}",
            headers={"Token": self.token},
            params={"pagesize": 100, "pageno": 1},
        )
        response.raise_for_status()
        data = response.json()
        if data.get("status") != "success":
            raise RuntimeError(f"Results fetch failed: {data.get('message', 'unknown error')}")

        results = (
            data.get("result")
            or data.get("documents")
            or data.get("data")
            or []
        )
        if not isinstance(results, list):
            results = []

        return {
            "status": "success",
            "query": query,
            "results": results,
            "total_records": data.get("total_count", len(results)),
        }
