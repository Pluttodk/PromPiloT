"""Integration tests for the /api/v1/flows/ endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


def _flow_entity(project_id: str = "proj-1", flow_id: str = "flow-1") -> dict[str, Any]:
    """Build a minimal flow entity."""
    now = datetime.utcnow()
    return {
        "PartitionKey": project_id,
        "RowKey": flow_id,
        "name": "Test Flow",
        "description": "",
        "definition": '{"nodes": [], "edges": []}',
        "created_by": "user",
        "created_at": now,
        "updated_at": now,
    }


PROJECT_ID = "proj-1"


class TestListFlows:
    """GET /api/v1/flows/?project_id=..."""

    def test_list_flows_empty(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Returns 200 with an empty list when no flows exist."""
        client, mock = test_client
        mock.list_entities_by_partition.return_value = []

        response = client.get(f"/api/v1/flows/?project_id={PROJECT_ID}")

        assert response.status_code == 200
        assert response.json() == []


class TestCreateFlow:
    """POST /api/v1/flows/?project_id=..."""

    def test_create_flow_returns_201(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Creating a flow returns 201 with a flow_id."""
        client, mock = test_client

        response = client.post(
            f"/api/v1/flows/?project_id={PROJECT_ID}",
            json={
                "name": "New Flow",
                "description": "test",
                "definition": {"nodes": [], "edges": []},
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert "flow_id" in data
        assert data["name"] == "New Flow"
        mock.insert_entity.assert_called_once()


class TestGetFlow:
    """GET /api/v1/flows/{flow_id}?project_id=..."""

    def test_get_flow_not_found_returns_404(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Requesting a non-existent flow returns 404."""
        client, mock = test_client
        mock.get_entity.return_value = None

        response = client.get(f"/api/v1/flows/bad-id?project_id={PROJECT_ID}")

        assert response.status_code == 404


class TestDeleteFlow:
    """DELETE /api/v1/flows/{flow_id}?project_id=..."""

    def test_delete_flow_returns_200(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Deleting an existing flow returns 200 and calls delete_entity."""
        client, mock = test_client
        mock.get_entity.return_value = _flow_entity()

        response = client.delete(f"/api/v1/flows/flow-1?project_id={PROJECT_ID}")

        assert response.status_code == 200
        mock.delete_entity.assert_called_once()


class TestExecuteFlow:
    """POST /api/v1/flows/{flow_id}/execute?project_id=..."""

    def test_execute_flow_returns_200(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Executing a flow returns 200 with trace_id and outputs."""
        client, mock = test_client
        mock.get_entity.return_value = _flow_entity()

        from app.models.schemas import FlowExecuteResponse

        fake_result = FlowExecuteResponse(
            trace_id="trace-abc",
            outputs={"answer": "hi"},
            execution_time_ms=50,
            node_results={},
        )

        with patch(
            "app.services.flow_executor.FlowExecutor.execute",
            new=AsyncMock(return_value=fake_result),
        ):
            response = client.post(
                f"/api/v1/flows/flow-1/execute?project_id={PROJECT_ID}",
                json={"inputs": {"question": "hello"}},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["trace_id"] == "trace-abc"
        assert data["outputs"] == {"answer": "hi"}
