"""Prompts resource — full CRUD plus versioning operations."""

from __future__ import annotations

from typing import Any

import httpx

from prom_pilot.exceptions import ExecutionError, NotFoundError, PromPilotError
from prom_pilot.models import PromptResponse, PromptVersionResponse


class PromptsResource:
    """Provides operations on the /prompts API endpoint.

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
            project_id: Per-call override, or ``None`` to use the client default.

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
            method: HTTP method (GET, POST, PUT, DELETE).
            path: URL path relative to base_url.
            params: Query parameters.
            json: Request body serialised as JSON.

        Returns:
            Parsed JSON response body.

        Raises:
            NotFoundError: On HTTP 404.
            ExecutionError: On HTTP 500.
            PromPilotError: On any other 4xx/5xx response.
        """
        response = await self._client.request(method, path, params=params, json=json)
        if response.status_code == 404:
            detail = response.json().get("detail", "Not found")
            raise NotFoundError(detail)
        if response.status_code == 500:
            detail = response.json().get("detail", "Server error")
            raise ExecutionError(detail, status_code=500)
        if response.is_error:
            detail = response.json().get("detail", response.text)
            raise PromPilotError(detail=detail, status_code=response.status_code)
        return response.json()

    async def list(self, *, project_id: str | None = None) -> list[PromptResponse]:
        """List all prompts in a project.

        Args:
            project_id: Project ID override; uses client default when omitted.

        Returns:
            List of :class:`~prom_pilot.models.PromptResponse` objects.
        """
        data = await self._request(
            "GET",
            "/api/v1/prompts/",
            params={"project_id": self._project(project_id)},
        )
        return [PromptResponse.model_validate(item) for item in data]

    async def create(
        self,
        name: str,
        template: str,
        *,
        system_prompt: str = "",
        description: str = "",
        project_id: str | None = None,
    ) -> PromptResponse:
        """Create a new prompt.

        Args:
            name: Display name for the prompt.
            template: Jinja2 template string.
            system_prompt: Optional system-level instructions.
            description: Optional description.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.PromptResponse` for the new prompt.
        """
        data = await self._request(
            "POST",
            "/api/v1/prompts/",
            params={"project_id": self._project(project_id)},
            json={
                "name": name,
                "template": template,
                "system_prompt": system_prompt,
                "description": description,
            },
        )
        return PromptResponse.model_validate(data)

    async def get(self, prompt_id: str, *, project_id: str | None = None) -> PromptResponse:
        """Retrieve a single prompt by ID.

        Args:
            prompt_id: Prompt identifier.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.PromptResponse` for the requested prompt.

        Raises:
            NotFoundError: If no prompt with the given ID exists.
        """
        data = await self._request(
            "GET",
            f"/api/v1/prompts/{prompt_id}",
            params={"project_id": self._project(project_id)},
        )
        return PromptResponse.model_validate(data)

    async def update(
        self,
        prompt_id: str,
        *,
        name: str | None = None,
        template: str | None = None,
        system_prompt: str | None = None,
        description: str | None = None,
        project_id: str | None = None,
    ) -> PromptResponse:
        """Update fields on an existing prompt.

        Args:
            prompt_id: Prompt identifier.
            name: New display name, or ``None`` to leave unchanged.
            template: New template string, or ``None`` to leave unchanged.
            system_prompt: New system prompt, or ``None`` to leave unchanged.
            description: New description, or ``None`` to leave unchanged.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            Updated :class:`~prom_pilot.models.PromptResponse`.

        Raises:
            NotFoundError: If the prompt does not exist.
        """
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
        if template is not None:
            body["template"] = template
        if system_prompt is not None:
            body["system_prompt"] = system_prompt
        if description is not None:
            body["description"] = description

        data = await self._request(
            "PUT",
            f"/api/v1/prompts/{prompt_id}",
            params={"project_id": self._project(project_id)},
            json=body,
        )
        return PromptResponse.model_validate(data)

    async def delete(self, prompt_id: str, *, project_id: str | None = None) -> None:
        """Delete a prompt.

        Args:
            prompt_id: Prompt identifier.
            project_id: Project ID override; uses client default when omitted.

        Raises:
            NotFoundError: If the prompt does not exist.
        """
        await self._request(
            "DELETE",
            f"/api/v1/prompts/{prompt_id}",
            params={"project_id": self._project(project_id)},
        )

    async def list_versions(
        self, prompt_id: str, *, project_id: str | None = None
    ) -> list[PromptVersionResponse]:
        """List all versions of a prompt.

        Args:
            prompt_id: Prompt identifier.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            List of :class:`~prom_pilot.models.PromptVersionResponse` objects.
        """
        data = await self._request(
            "GET",
            f"/api/v1/prompts/{prompt_id}/versions",
            params={"project_id": self._project(project_id)},
        )
        return [PromptVersionResponse.model_validate(v) for v in data]

    async def create_version(
        self, prompt_id: str, *, project_id: str | None = None
    ) -> PromptVersionResponse:
        """Snapshot the current prompt template as a new version.

        Args:
            prompt_id: Prompt identifier.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            :class:`~prom_pilot.models.PromptVersionResponse` for the new version.
        """
        data = await self._request(
            "POST",
            f"/api/v1/prompts/{prompt_id}/versions",
            params={"project_id": self._project(project_id)},
        )
        return PromptVersionResponse.model_validate(data)

    async def set_version_tags(
        self,
        prompt_id: str,
        version_number: int,
        tags: list[str],
        *,
        project_id: str | None = None,
    ) -> PromptVersionResponse:
        """Replace the tag set on a specific version.

        Args:
            prompt_id: Prompt identifier.
            version_number: 1-based version number to update.
            tags: Complete new list of tags for this version.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            Updated :class:`~prom_pilot.models.PromptVersionResponse`.
        """
        data = await self._request(
            "PUT",
            f"/api/v1/prompts/{prompt_id}/versions/{version_number}/tags",
            params={"project_id": self._project(project_id)},
            json={"tags": tags},
        )
        return PromptVersionResponse.model_validate(data)

    async def promote(
        self,
        prompt_id: str,
        version_number: int,
        *,
        project_id: str | None = None,
    ) -> PromptVersionResponse:
        """Tag a version as ``production``.

        Args:
            prompt_id: Prompt identifier.
            version_number: Version to promote.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            Updated :class:`~prom_pilot.models.PromptVersionResponse`.
        """
        return await self.set_version_tags(
            prompt_id,
            version_number,
            ["production"],
            project_id=project_id,
        )

    async def rollback(
        self,
        prompt_id: str,
        to_version: int,
        *,
        project_id: str | None = None,
    ) -> PromptVersionResponse:
        """Promote an older version, effectively rolling back production.

        Args:
            prompt_id: Prompt identifier.
            to_version: Version number to make the new production version.
            project_id: Project ID override; uses client default when omitted.

        Returns:
            Updated :class:`~prom_pilot.models.PromptVersionResponse`.
        """
        return await self.promote(prompt_id, to_version, project_id=project_id)
