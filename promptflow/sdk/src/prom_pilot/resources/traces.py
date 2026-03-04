"""Traces resource — retrieve execution traces."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from prom_pilot.exceptions import NotFoundError, PromPilotError
from prom_pilot.models import TraceListItem, TraceResponse


class TracesResource:
    """Provides operations on the /traces API endpoint.

    Args:
        http_client: Shared ``httpx.AsyncClient`` from the parent client.
        default_project_id: Project ID set on the parent client.
    """

    def __init__(self, http_client: httpx.AsyncClient, default_project_id: str) -> None:
        self._client = http_client
        self._default_project_id = default_project_id

    def _project(self, project_id: str | None) -> str:
        """Resolve effective project ID.

        Args:
            project_id: Per-call override, or ``None`` to use default.

        Returns:
            Resolved project ID string.
        """
        return project_id or self._default_project_id

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> Any:
        """Send an HTTP request and return parsed JSON.

        Args:
            method: HTTP method.
            path: URL path relative to base_url.
            params: Query parameters.

        Returns:
            Parsed JSON response body.

        Raises:
            NotFoundError: On HTTP 404.
            PromPilotError: On any other 4xx/5xx response.
        """
        response = await self._client.request(method, path, params=params)
        if response.status_code == 404:
            detail = response.json().get("detail", "Not found")
            raise NotFoundError(detail)
        if response.is_error:
            detail = response.json().get("detail", response.text)
            raise PromPilotError(detail=detail, status_code=response.status_code)
        return response.json()

    async def get(self, trace_id: str, *, project_id: str | None = None) -> TraceResponse:
        """Retrieve a single trace by ID.

        Args:
            trace_id: Trace identifier.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.TraceResponse` with full node-level detail.

        Raises:
            NotFoundError: If the trace does not exist.
        """
        data = await self._request(
            "GET",
            f"/api/v1/traces/{trace_id}",
            params={"project_id": self._project(project_id)},
        )
        return TraceResponse.model_validate(data)

    async def list(
        self,
        *,
        flow_id: str | None = None,
        eval_run_id: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 50,
        project_id: str | None = None,
    ) -> list[TraceListItem]:
        """List traces in a project with optional filters.

        Args:
            flow_id: Filter to traces produced by this flow.
            eval_run_id: Filter to traces produced by this evaluation run.
                Pass an empty string (``""``) to list only non-eval traces.
            date_from: Return traces created at or after this datetime.
            date_to: Return traces created at or before this datetime.
            limit: Maximum number of traces to return (1–200, default 50).
            project_id: Project ID override; uses client default when omitted.

        Returns:
            List of :class:`~prom_pilot.models.TraceListItem` objects sorted newest first.
        """
        params: dict[str, Any] = {
            "project_id": self._project(project_id),
            "limit": limit,
        }
        if flow_id is not None:
            params["flow_id"] = flow_id
        if eval_run_id is not None:
            params["eval_run_id"] = eval_run_id
        if date_from is not None:
            params["date_from"] = date_from.isoformat()
        if date_to is not None:
            params["date_to"] = date_to.isoformat()

        data = await self._request("GET", "/api/v1/traces/", params=params)
        return [TraceListItem.model_validate(item) for item in data]
