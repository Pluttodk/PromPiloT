"""Flows resource — list, get, and execute flows."""

from __future__ import annotations

from typing import Any

import httpx

from prom_pilot.exceptions import ExecutionError, NotFoundError, PromPilotError
from prom_pilot.models import FlowExecuteResponse, FlowResponse


class FlowsResource:
    """Provides operations on the /flows API endpoint.

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
        json: Any = None,
    ) -> Any:
        """Send an HTTP request and return parsed JSON.

        Args:
            method: HTTP method (GET, POST, …).
            path: URL path relative to base_url.
            params: Query parameters.
            json: Request body serialised as JSON.

        Returns:
            Parsed JSON response body.

        Raises:
            NotFoundError: On HTTP 404.
            ExecutionError: On HTTP 500 during flow execution.
            PromPilotError: On any other 4xx/5xx response.
        """
        response = await self._client.request(method, path, params=params, json=json)
        if response.status_code == 404:
            detail = response.json().get("detail", "Not found")
            raise NotFoundError(detail)
        if response.status_code == 500:
            detail = response.json().get("detail", "Execution failed")
            raise ExecutionError(detail, status_code=500)
        if response.is_error:
            detail = response.json().get("detail", response.text)
            raise PromPilotError(detail=detail, status_code=response.status_code)
        return response.json()

    async def list(self, *, project_id: str | None = None) -> list[FlowResponse]:
        """List all flows in a project.

        Args:
            project_id: Project ID override; uses client default when omitted.

        Returns:
            List of :class:`~prom_pilot.models.FlowResponse` objects.
        """
        data = await self._request(
            "GET",
            "/api/v1/flows/",
            params={"project_id": self._project(project_id)},
        )
        return [FlowResponse.model_validate(item) for item in data]

    async def get(self, flow_id: str, *, project_id: str | None = None) -> FlowResponse:
        """Retrieve a single flow by ID.

        Args:
            flow_id: Flow identifier.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.FlowResponse` for the requested flow.

        Raises:
            NotFoundError: If no flow with the given ID exists.
        """
        data = await self._request(
            "GET",
            f"/api/v1/flows/{flow_id}",
            params={"project_id": self._project(project_id)},
        )
        return FlowResponse.model_validate(data)

    async def execute(
        self,
        flow_id: str,
        inputs: dict[str, Any],
        *,
        project_id: str | None = None,
    ) -> FlowExecuteResponse:
        """Execute a flow with the given inputs.

        Args:
            flow_id: Flow identifier to execute.
            inputs: Mapping of input node names to their values.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.FlowExecuteResponse` containing outputs and trace ID.

        Raises:
            NotFoundError: If the flow does not exist.
            ExecutionError: If the backend reports a 500 execution failure.
        """
        data = await self._request(
            "POST",
            f"/api/v1/flows/{flow_id}/execute",
            params={"project_id": self._project(project_id)},
            json={"inputs": inputs},
        )
        return FlowExecuteResponse.model_validate(data)
