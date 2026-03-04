"""Datasets resource — create, manage, and query test datasets."""

from __future__ import annotations

from typing import Any

import httpx

from prom_pilot.exceptions import NotFoundError, PromPilotError
from prom_pilot.models import DatasetItemResponse, DatasetResponse


class DatasetsResource:
    """Provides operations on the /datasets API endpoint.

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
            Parsed JSON response body, or ``None`` for 204 responses.

        Raises:
            NotFoundError: On HTTP 404.
            PromPilotError: On any other 4xx/5xx response.
        """
        response = await self._client.request(method, path, params=params, json=json)
        if response.status_code == 204 or not response.content:
            return None
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
        description: str = "",
        *,
        project_id: str | None = None,
    ) -> DatasetResponse:
        """Create a new dataset.

        Args:
            name: Display name for the dataset.
            description: Optional description.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.DatasetResponse` for the new dataset.
        """
        data = await self._request(
            "POST",
            "/api/v1/datasets/",
            params={"project_id": self._project(project_id)},
            json={"name": name, "description": description},
        )
        return DatasetResponse.model_validate(data)

    async def list(self, *, project_id: str | None = None) -> list[DatasetResponse]:
        """List all datasets in a project.

        Args:
            project_id: Project ID override; uses client default when omitted.

        Returns:
            List of :class:`~prom_pilot.models.DatasetResponse` objects.
        """
        data = await self._request(
            "GET",
            "/api/v1/datasets/",
            params={"project_id": self._project(project_id)},
        )
        return [DatasetResponse.model_validate(item) for item in data]

    async def get(self, dataset_id: str, *, project_id: str | None = None) -> DatasetResponse:
        """Retrieve a dataset by ID.

        Args:
            dataset_id: Dataset identifier.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.DatasetResponse`.

        Raises:
            NotFoundError: If the dataset does not exist.
        """
        data = await self._request(
            "GET",
            f"/api/v1/datasets/{dataset_id}",
            params={"project_id": self._project(project_id)},
        )
        return DatasetResponse.model_validate(data)

    async def delete(self, dataset_id: str, *, project_id: str | None = None) -> None:
        """Delete a dataset and all its items.

        Args:
            dataset_id: Dataset identifier to delete.
            project_id: Project ID override; uses client default when omitted.

        Raises:
            NotFoundError: If the dataset does not exist.
        """
        await self._request(
            "DELETE",
            f"/api/v1/datasets/{dataset_id}",
            params={"project_id": self._project(project_id)},
        )

    async def add_item(
        self,
        dataset_id: str,
        input: str,
        expected_output: str | None = None,
        notes: str | None = None,
        *,
        project_id: str | None = None,
    ) -> DatasetItemResponse:
        """Add a single item to a dataset.

        Args:
            dataset_id: Dataset to add the item to.
            input: Input text for this test case.
            expected_output: Optional expected output for evaluation scoring.
            notes: Optional free-text notes.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.DatasetItemResponse` for the created item.

        Raises:
            NotFoundError: If the dataset does not exist.
        """
        body: dict[str, Any] = {"input": input}
        if expected_output is not None:
            body["expected_output"] = expected_output
        if notes is not None:
            body["notes"] = notes
        data = await self._request(
            "POST",
            f"/api/v1/datasets/{dataset_id}/items",
            params={"project_id": self._project(project_id)},
            json=body,
        )
        return DatasetItemResponse.model_validate(data)

    async def list_items(
        self,
        dataset_id: str,
        limit: int = 100,
        skip: int = 0,
        *,
        project_id: str | None = None,
    ) -> list[DatasetItemResponse]:
        """List items in a dataset with pagination.

        Args:
            dataset_id: Dataset identifier.
            limit: Maximum number of items to return (1–500).
            skip: Number of items to skip for pagination.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            List of :class:`~prom_pilot.models.DatasetItemResponse` objects.
        """
        data = await self._request(
            "GET",
            f"/api/v1/datasets/{dataset_id}/items",
            params={
                "project_id": self._project(project_id),
                "limit": limit,
                "skip": skip,
            },
        )
        return [DatasetItemResponse.model_validate(item) for item in data]

    async def delete_item(
        self,
        dataset_id: str,
        item_id: str,
        *,
        project_id: str | None = None,
    ) -> None:
        """Delete a dataset item.

        Args:
            dataset_id: Dataset identifier.
            item_id: Item identifier to delete.
            project_id: Project ID override; uses client default when omitted.

        Raises:
            NotFoundError: If the item does not exist.
        """
        await self._request(
            "DELETE",
            f"/api/v1/datasets/{dataset_id}/items/{item_id}",
            params={"project_id": self._project(project_id)},
        )
