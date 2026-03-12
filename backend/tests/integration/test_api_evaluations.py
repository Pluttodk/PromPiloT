"""Integration tests for the /api/v1/evaluations/ endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


PROJECT_ID = "proj-1"
DATASET_ID = "ds-1"
FLOW_ID = "flow-1"
RUN_ID = "run-1"


def _dataset_entity() -> dict[str, Any]:
    """Minimal dataset entity."""
    now = datetime.utcnow()
    return {
        "PartitionKey": PROJECT_ID,
        "RowKey": DATASET_ID,
        "name": "Test Dataset",
        "description": "",
        "item_count": 2,
        "created_by": "user",
        "created_at": now,
        "updated_at": now,
    }


def _flow_entity() -> dict[str, Any]:
    """Minimal flow entity."""
    now = datetime.utcnow()
    return {
        "PartitionKey": PROJECT_ID,
        "RowKey": FLOW_ID,
        "name": "Test Flow",
        "description": "",
        "definition": '{"nodes": [], "edges": []}',
        "created_by": "user",
        "created_at": now,
        "updated_at": now,
    }


def _run_entity(status: str = "pending") -> dict[str, Any]:
    """Minimal eval run entity."""
    now = datetime.utcnow()
    return {
        "PartitionKey": PROJECT_ID,
        "RowKey": RUN_ID,
        "name": "Test Run",
        "dataset_id": DATASET_ID,
        "dataset_name": "Test Dataset",
        "flow_id": FLOW_ID,
        "flow_name": "Test Flow",
        "status": status,
        "total_items": 2,
        "completed_items": 0,
        "failed_items": 0,
        "auto_score": False,
        "judge_criteria": None,
        "judge_model_config_id": None,
        "item_limit": None,
        "error_message": None,
        "created_by": "user",
        "created_at": now,
        "completed_at": None,
    }


def _result_entity(result_id: str = "res-1") -> dict[str, Any]:
    """Minimal eval result entity."""
    now = datetime.utcnow()
    return {
        "PartitionKey": f"{PROJECT_ID}~{RUN_ID}",
        "RowKey": result_id,
        "run_id": RUN_ID,
        "item_id": "item-1",
        "trace_id": "trace-1",
        "status": "completed",
        "actual_output": '{"answer": "hello"}',
        "expected_output": "hello",
        "score_numeric": None,
        "score_label": None,
        "judge_reasoning": None,
        "error_message": None,
        "execution_time_ms": 100,
        "created_at": now,
    }


class TestCreateEvalRun:
    """POST /api/v1/evaluations/?project_id=..."""

    def test_create_eval_run_missing_dataset_returns_404(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Returns 404 when the referenced dataset does not exist."""
        client, mock = test_client
        mock.get_entity.return_value = None

        response = client.post(
            f"/api/v1/evaluations/?project_id={PROJECT_ID}",
            json={
                "name": "Run 1",
                "dataset_id": "nonexistent",
                "flow_id": FLOW_ID,
                "auto_score": False,
            },
        )

        assert response.status_code == 404

    def test_create_eval_run_auto_score_without_criteria_returns_422(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Returns 422 when auto_score=True but judge_criteria is missing."""
        client, mock = test_client
        mock.get_entity.side_effect = [_dataset_entity(), _flow_entity()]

        response = client.post(
            f"/api/v1/evaluations/?project_id={PROJECT_ID}",
            json={
                "name": "Run 1",
                "dataset_id": DATASET_ID,
                "flow_id": FLOW_ID,
                "auto_score": True,
                "judge_criteria": None,
            },
        )

        assert response.status_code == 422

    def test_create_eval_run_returns_202_with_pending_status(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Returns 202 with status=pending; background task is no-op'd."""
        client, mock = test_client
        mock.get_entity.side_effect = [_dataset_entity(), _flow_entity()]

        with patch(
            "app.api.v1.evaluations._run_evaluation_background",
            new=AsyncMock(return_value=None),
        ):
            response = client.post(
                f"/api/v1/evaluations/?project_id={PROJECT_ID}",
                json={
                    "name": "Run 1",
                    "dataset_id": DATASET_ID,
                    "flow_id": FLOW_ID,
                    "auto_score": False,
                },
            )

        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "pending"
        mock.insert_entity.assert_called_once()


class TestGetEvalRun:
    """GET /api/v1/evaluations/{run_id}?project_id=..."""

    def test_get_eval_run_returns_status_and_counts(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Returns the eval run with status and item counts."""
        client, mock = test_client
        entity = _run_entity(status="completed")
        entity["completed_items"] = 2
        mock.get_entity.return_value = entity

        response = client.get(
            f"/api/v1/evaluations/{RUN_ID}?project_id={PROJECT_ID}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["completed_items"] == 2


class TestListEvalResults:
    """GET /api/v1/evaluations/{run_id}/results?project_id=..."""

    def test_list_eval_results_returns_per_item_results(
        self, test_client: tuple[TestClient, MagicMock]
    ) -> None:
        """Returns a list of per-item evaluation results."""
        client, mock = test_client
        mock.list_entities_by_partition.return_value = [
            _result_entity("res-1"),
            _result_entity("res-2"),
        ]

        response = client.get(
            f"/api/v1/evaluations/{RUN_ID}/results?project_id={PROJECT_ID}"
        )

        assert response.status_code == 200
        results = response.json()
        assert len(results) == 2
        assert results[0]["status"] == "completed"
