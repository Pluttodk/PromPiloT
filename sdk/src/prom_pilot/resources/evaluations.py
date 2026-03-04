"""Evaluations resource — create eval runs, poll status, and retrieve results."""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx

from prom_pilot.exceptions import ExecutionError, NotFoundError, PromPilotError
from prom_pilot.models import EvalResultResponse, EvalRunResponse

_TERMINAL_STATUSES = frozenset({"completed", "failed"})


class EvaluationsResource:
    """Provides operations on the /evaluations API endpoint.

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
            method: HTTP method.
            path: URL path relative to base_url.
            params: Query parameters.
            json: JSON request body.

        Returns:
            Parsed JSON response body.

        Raises:
            NotFoundError: On HTTP 404.
            PromPilotError: On any other 4xx/5xx response.
        """
        response = await self._client.request(method, path, params=params, json=json)
        if response.status_code == 404:
            detail = response.json().get("detail", "Not found")
            raise NotFoundError(detail)
        if response.is_error:
            detail = response.json().get("detail", response.text)
            raise PromPilotError(detail=detail, status_code=response.status_code)
        return response.json()

    async def create(
        self,
        name: str,
        dataset_id: str,
        flow_id: str,
        *,
        auto_score: bool = False,
        judge_criteria: str | None = None,
        judge_model_config_id: str | None = None,
        item_limit: int | None = None,
        project_id: str | None = None,
    ) -> EvalRunResponse:
        """Create and start an evaluation run.

        The run executes asynchronously on the backend. Poll :meth:`get` for
        status, or use :meth:`run_and_wait` for a blocking convenience method.

        Args:
            name: Display name for the run.
            dataset_id: Dataset of test cases to evaluate.
            flow_id: Flow to run against each dataset item.
            auto_score: Enable LLM-as-judge automatic scoring.
            judge_criteria: Scoring criteria for the LLM judge (required when
                ``auto_score=True``).
            judge_model_config_id: Model config to use for judging.
            item_limit: Cap on the number of items evaluated.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.EvalRunResponse` with ``status=pending``.

        Raises:
            NotFoundError: If the dataset or flow does not exist.
            PromPilotError: If ``auto_score=True`` but ``judge_criteria`` is absent.
        """
        body: dict[str, Any] = {
            "name": name,
            "dataset_id": dataset_id,
            "flow_id": flow_id,
            "auto_score": auto_score,
        }
        if judge_criteria is not None:
            body["judge_criteria"] = judge_criteria
        if judge_model_config_id is not None:
            body["judge_model_config_id"] = judge_model_config_id
        if item_limit is not None:
            body["item_limit"] = item_limit

        data = await self._request(
            "POST",
            "/api/v1/evaluations/",
            params={"project_id": self._project(project_id)},
            json=body,
        )
        return EvalRunResponse.model_validate(data)

    async def get(self, run_id: str, *, project_id: str | None = None) -> EvalRunResponse:
        """Retrieve an evaluation run by ID.

        Args:
            run_id: Evaluation run identifier.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.EvalRunResponse`.

        Raises:
            NotFoundError: If the run does not exist.
        """
        data = await self._request(
            "GET",
            f"/api/v1/evaluations/{run_id}",
            params={"project_id": self._project(project_id)},
        )
        return EvalRunResponse.model_validate(data)

    async def list(
        self,
        *,
        dataset_id: str | None = None,
        project_id: str | None = None,
    ) -> list[EvalRunResponse]:
        """List evaluation runs in a project.

        Args:
            dataset_id: Optional dataset ID to filter results.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            List of :class:`~prom_pilot.models.EvalRunResponse` objects sorted newest first.
        """
        params: dict[str, Any] = {"project_id": self._project(project_id)}
        if dataset_id is not None:
            params["dataset_id"] = dataset_id

        data = await self._request("GET", "/api/v1/evaluations/", params=params)
        return [EvalRunResponse.model_validate(item) for item in data]

    async def get_results(
        self, run_id: str, *, project_id: str | None = None
    ) -> list[EvalResultResponse]:
        """Retrieve per-item results for an evaluation run.

        Args:
            run_id: Evaluation run identifier.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            List of :class:`~prom_pilot.models.EvalResultResponse` objects.

        Raises:
            NotFoundError: If the run does not exist.
        """
        data = await self._request(
            "GET",
            f"/api/v1/evaluations/{run_id}/results",
            params={"project_id": self._project(project_id)},
        )
        return [EvalResultResponse.model_validate(item) for item in data]

    async def run_and_wait(
        self,
        name: str,
        dataset_id: str,
        flow_id: str,
        *,
        poll_interval: float = 2.0,
        timeout: float = 600.0,
        auto_score: bool = False,
        judge_criteria: str | None = None,
        judge_model_config_id: str | None = None,
        item_limit: int | None = None,
        project_id: str | None = None,
    ) -> EvalRunResponse:
        """Create an evaluation run and block until it finishes.

        Polls ``GET /evaluations/{run_id}`` every ``poll_interval`` seconds until
        the run reaches a terminal status (``completed`` or ``failed``), or until
        ``timeout`` seconds have elapsed.

        Args:
            name: Display name for the run.
            dataset_id: Dataset of test cases to evaluate.
            flow_id: Flow to run against each dataset item.
            poll_interval: Seconds between status polls (default 2.0).
            timeout: Maximum seconds to wait before raising (default 600).
            auto_score: Enable LLM-as-judge automatic scoring.
            judge_criteria: Scoring criteria for the LLM judge.
            judge_model_config_id: Model config to use for judging.
            item_limit: Cap on the number of items evaluated.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            Completed :class:`~prom_pilot.models.EvalRunResponse`.

        Raises:
            ExecutionError: If the run status is ``failed`` or ``timeout`` is exceeded.
            NotFoundError: If the dataset or flow does not exist.
        """
        run = await self.create(
            name=name,
            dataset_id=dataset_id,
            flow_id=flow_id,
            auto_score=auto_score,
            judge_criteria=judge_criteria,
            judge_model_config_id=judge_model_config_id,
            item_limit=item_limit,
            project_id=project_id,
        )

        effective_project_id = self._project(project_id)
        deadline = time.monotonic() + timeout

        while run.status not in _TERMINAL_STATUSES:
            if time.monotonic() >= deadline:
                raise ExecutionError(
                    f"Evaluation run {run.run_id} timed out after {timeout}s "
                    f"(status={run.status})",
                    status_code=408,
                )
            await asyncio.sleep(poll_interval)
            run = await self.get(run.run_id, project_id=effective_project_id)

        if run.status == "failed":
            raise ExecutionError(
                f"Evaluation run {run.run_id} failed: {run.error_message or 'unknown error'}",
                status_code=500,
            )

        return run
