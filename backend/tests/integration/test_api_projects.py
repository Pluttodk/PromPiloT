"""Integration tests for the /api/v1/projects/ endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient


def _project_entity(project_id: str = "proj-1", name: str = "My Project") -> dict[str, Any]:
    """Build a minimal project entity."""
    now = datetime.utcnow()
    return {
        "PartitionKey": "PROJECT",
        "RowKey": project_id,
        "name": name,
        "description": "A test project",
        "created_by": "user",
        "created_at": now,
        "updated_at": now,
    }


class TestListProjects:
    """GET /api/v1/projects/"""

    def test_list_projects_empty(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Returns 200 with an empty list when no projects exist."""
        client, mock = test_client
        mock.query_entities.return_value = []

        response = client.get("/api/v1/projects/")

        assert response.status_code == 200
        assert response.json() == []


class TestCreateProject:
    """POST /api/v1/projects/"""

    def test_create_project_returns_201(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Creating a project returns 201 with a project_id and calls insert_entity."""
        client, mock = test_client

        response = client.post(
            "/api/v1/projects/",
            json={"name": "New Project", "description": "desc"},
        )

        assert response.status_code == 201
        data = response.json()
        assert "project_id" in data
        assert data["name"] == "New Project"
        mock.insert_entity.assert_called_once()


class TestGetProject:
    """GET /api/v1/projects/{project_id}"""

    def test_get_project_not_found_returns_404(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Requesting a non-existent project returns 404."""
        client, mock = test_client
        mock.get_entity.return_value = None

        response = client.get("/api/v1/projects/nonexistent")

        assert response.status_code == 404


class TestUpdateProject:
    """PUT /api/v1/projects/{project_id}"""

    def test_update_project_patches_name(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Updating a project name returns 200 with the new name."""
        client, mock = test_client
        entity = _project_entity(name="Old Name")
        mock.get_entity.return_value = entity

        response = client.put(
            "/api/v1/projects/proj-1",
            json={"name": "New Name"},
        )

        assert response.status_code == 200
        assert response.json()["name"] == "New Name"
        mock.update_entity.assert_called_once()


class TestDeleteProject:
    """DELETE /api/v1/projects/{project_id}"""

    def test_delete_project_returns_200(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Deleting an existing project returns 200 and calls delete_entity."""
        client, mock = test_client
        entity = _project_entity()
        mock.get_entity.return_value = entity

        response = client.delete("/api/v1/projects/proj-1")

        assert response.status_code == 200
        mock.delete_entity.assert_called_once()
