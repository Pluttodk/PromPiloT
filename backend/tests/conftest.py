"""Shared test fixtures for backend unit and integration tests."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import app.storage.table_client as tbl_module
import app.storage.blob_client as blob_module
from app.main import app


def _make_project_entity(
    project_id: str = "proj-1",
    name: str = "Test Project",
) -> dict[str, Any]:
    """Build a minimal project entity dict."""
    now = datetime.utcnow()
    return {
        "PartitionKey": "PROJECT",
        "RowKey": project_id,
        "name": name,
        "description": "",
        "created_by": "user",
        "created_at": now,
        "updated_at": now,
    }


def _make_flow_entity(
    project_id: str = "proj-1",
    flow_id: str = "flow-1",
    name: str = "Test Flow",
) -> dict[str, Any]:
    """Build a minimal flow entity dict."""
    now = datetime.utcnow()
    return {
        "PartitionKey": project_id,
        "RowKey": flow_id,
        "name": name,
        "description": "",
        "definition": '{"nodes": [], "edges": []}',
        "created_by": "user",
        "created_at": now,
        "updated_at": now,
    }


def _make_dataset_entity(
    project_id: str = "proj-1",
    dataset_id: str = "ds-1",
    name: str = "Test Dataset",
    item_count: int = 2,
) -> dict[str, Any]:
    """Build a minimal dataset entity dict."""
    now = datetime.utcnow()
    return {
        "PartitionKey": project_id,
        "RowKey": dataset_id,
        "name": name,
        "description": "",
        "item_count": item_count,
        "created_by": "user",
        "created_at": now,
        "updated_at": now,
    }


def _make_run_entity(
    project_id: str = "proj-1",
    run_id: str = "run-1",
    status: str = "pending",
) -> dict[str, Any]:
    """Build a minimal eval run entity dict."""
    now = datetime.utcnow()
    return {
        "PartitionKey": project_id,
        "RowKey": run_id,
        "name": "Test Run",
        "dataset_id": "ds-1",
        "dataset_name": "Test Dataset",
        "flow_id": "flow-1",
        "flow_name": "Test Flow",
        "status": status,
        "total_items": 0,
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


@pytest.fixture
def mock_table_client() -> MagicMock:
    """MagicMock for TableStorageClient with all required methods stubbed."""
    mock = MagicMock()
    mock.get_entity.return_value = None
    mock.list_entities_by_partition.return_value = []
    mock.query_entities.return_value = []
    mock.insert_entity.return_value = {}
    mock.update_entity.return_value = {}
    mock.delete_entity.return_value = None
    mock.create_table_if_not_exists.return_value = None
    return mock


@pytest.fixture
def mock_blob_client() -> MagicMock:
    """MagicMock for BlobStorageClient with all required methods stubbed."""
    mock = MagicMock()
    mock.create_container_if_not_exists.return_value = None
    return mock


@pytest.fixture
def test_client(mock_table_client: MagicMock, mock_blob_client: MagicMock):
    """FastAPI TestClient with storage singletons replaced by mocks.

    Patches the module-level singletons before TestClient enters so the
    lifespan startup does not attempt any real Azure connections.

    Yields:
        Tuple of (TestClient, mock_table_client) for use in tests.
    """
    old_tbl = tbl_module._table_client
    old_blob = blob_module._blob_client
    tbl_module._table_client = mock_table_client
    blob_module._blob_client = mock_blob_client
    try:
        with TestClient(app) as client:
            yield client, mock_table_client
    finally:
        tbl_module._table_client = old_tbl
        blob_module._blob_client = old_blob


@pytest.fixture
def project_entity() -> dict[str, Any]:
    """Pre-built project entity for use in tests."""
    return _make_project_entity()


@pytest.fixture
def flow_entity() -> dict[str, Any]:
    """Pre-built flow entity for use in tests."""
    return _make_flow_entity()


@pytest.fixture
def dataset_entity() -> dict[str, Any]:
    """Pre-built dataset entity for use in tests."""
    return _make_dataset_entity()


@pytest.fixture
def run_entity() -> dict[str, Any]:
    """Pre-built eval run entity for use in tests."""
    return _make_run_entity()
