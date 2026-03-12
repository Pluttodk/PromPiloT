"""Main entry point for the Prom-Pilot Python SDK."""

from __future__ import annotations

import asyncio
from typing import Any, Coroutine, TypeVar

import httpx

from prom_pilot.resources.datasets import DatasetsResource
from prom_pilot.resources.evaluations import EvaluationsResource
from prom_pilot.resources.flows import FlowsResource
from prom_pilot.resources.prompts import PromptsResource
from prom_pilot.resources.traces import TracesResource

_T = TypeVar("_T")


class PromPilotClient:
    """Async-first client for the Prom-Pilot API.

    Instantiate once and reuse.  Use as an async context manager to ensure
    the underlying HTTP connection pool is properly closed::

        async with PromPilotClient(base_url="http://localhost:8000",
                                   project_id="<id>") as client:
            flows = await client.flows.list()

    For scripts that do not use ``async``/``await``, use :meth:`run_sync`::

        result = client.run_sync(client.flows.execute(flow_id, inputs={"q": "Hi"}))

    Args:
        base_url: Base URL of the Prom-Pilot backend (no trailing slash needed).
        project_id: Default project ID sent with every request.  Can be
            overridden per-call on each resource method.
        timeout: HTTP request timeout in seconds (default 30.0).
        api_key: Optional Bearer token for future authentication support.
    """

    def __init__(
        self,
        base_url: str,
        project_id: str,
        timeout: float = 30.0,
        api_key: str | None = None,
    ) -> None:
        headers: dict[str, str] = {"Accept": "application/json", "Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        self._http_client = httpx.AsyncClient(
            base_url=base_url,
            headers=headers,
            timeout=timeout,
        )
        self._project_id = project_id

        self.flows = FlowsResource(self._http_client, project_id)
        self.prompts = PromptsResource(self._http_client, project_id)
        self.datasets = DatasetsResource(self._http_client, project_id)
        self.evaluations = EvaluationsResource(self._http_client, project_id)
        self.traces = TracesResource(self._http_client, project_id)

    async def close(self) -> None:
        """Close the underlying HTTP connection pool.

        Call this when you are done with the client and are not using it as
        an async context manager.
        """
        await self._http_client.aclose()

    async def __aenter__(self) -> "PromPilotClient":
        """Enter async context manager.

        Returns:
            The client instance.
        """
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Exit async context manager and close the HTTP client.

        Args:
            *args: Exception type, value, and traceback (ignored).
        """
        await self.close()

    def run_sync(self, coro: Coroutine[Any, Any, _T]) -> _T:
        """Run a coroutine synchronously using ``asyncio.run``.

        Convenience method for scripts that do not have an existing event loop::

            result = client.run_sync(client.flows.execute(flow_id, inputs={}))

        Args:
            coro: Coroutine to execute.

        Returns:
            The value returned by the coroutine.
        """
        return asyncio.run(coro)
