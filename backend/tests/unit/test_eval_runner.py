"""Unit tests for EvalRunner — batch evaluation orchestration."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.storage.table_client as tbl_module
from app.services.eval_runner import EvalRunner


def _run_entity(
    project_id: str = "p1",
    run_id: str = "run-1",
    flow_id: str = "flow-1",
    dataset_id: str = "ds-1",
    auto_score: bool = False,
) -> dict[str, Any]:
    """Build a minimal mutable eval run entity."""
    return {
        "PartitionKey": project_id,
        "RowKey": run_id,
        "flow_id": flow_id,
        "dataset_id": dataset_id,
        "auto_score": auto_score,
        "judge_criteria": None,
        "judge_model_config_id": None,
        "item_limit": None,
        "status": "pending",
        "total_items": 0,
        "completed_items": 0,
        "failed_items": 0,
    }


def _flow_entity(
    project_id: str = "p1",
    flow_id: str = "flow-1",
) -> dict[str, Any]:
    """Build a minimal flow entity with input and output nodes."""
    now = datetime.utcnow()
    return {
        "PartitionKey": project_id,
        "RowKey": flow_id,
        "name": "Test Flow",
        "description": "",
        "definition": (
            '{"nodes": ['
            '{"id": "in1", "type": "input", "data": {}, "position": {"x": 0, "y": 0}},'
            '{"id": "out1", "type": "output", "data": {}, "position": {"x": 0, "y": 0}}'
            '], "edges": [{"id": "e1", "source": "in1", "target": "out1"}]}'
        ),
        "created_by": "user",
        "created_at": now,
        "updated_at": now,
    }


def _dataset_item(item_id: str = "item-1") -> dict[str, Any]:
    """Build a minimal dataset item entity."""
    return {
        "PartitionKey": "p1~ds-1",
        "RowKey": item_id,
        "input": "hello",
        "expected_output": None,
    }


@pytest.fixture
def patch_table(mock_table_client: MagicMock):
    """Set the table storage singleton to the mock."""
    old = tbl_module._table_client
    tbl_module._table_client = mock_table_client
    yield mock_table_client
    tbl_module._table_client = old


class TestEvalRunner:
    """Tests for EvalRunner.run()."""

    async def test_run_completes_all_items(self, patch_table: MagicMock) -> None:
        """When all items succeed, final update has status='completed'."""
        run = _run_entity()
        items = [_dataset_item("i1"), _dataset_item("i2")]

        patch_table.get_entity.side_effect = [
            run,
            _flow_entity(),
            run,
            run,
            run,
        ]
        patch_table.list_entities_by_partition.return_value = items

        mock_exec_response = MagicMock()
        mock_exec_response.trace_id = "t1"
        mock_exec_response.outputs = {"out1": "result"}

        with patch(
            "app.services.eval_runner.FlowExecutor"
        ) as MockExecutor:
            instance = AsyncMock()
            instance.execute.return_value = mock_exec_response
            MockExecutor.return_value = instance

            runner = EvalRunner(project_id="p1")
            await runner.run(run_id="run-1")

        final_call = patch_table.update_entity.call_args_list[-1]
        entity_arg = (
            final_call.kwargs.get("entity")
            or (final_call.args[0] if final_call.args else None)
        )
        assert entity_arg is not None
        assert entity_arg["status"] == "completed"

    async def test_run_partial_failure(self, patch_table: MagicMock) -> None:
        """One failing item results in failed_items=1, completed_items=1."""
        run = _run_entity()
        items = [_dataset_item("i1"), _dataset_item("i2")]

        patch_table.get_entity.side_effect = [
            run,
            _flow_entity(),
            run,
            run,
            run,
        ]
        patch_table.list_entities_by_partition.return_value = items

        mock_exec_response = MagicMock()
        mock_exec_response.trace_id = "t1"
        mock_exec_response.outputs = {"out1": "result"}

        call_count = 0

        async def _execute_side_effect(**kwargs: Any) -> Any:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("item failed")
            return mock_exec_response

        with patch(
            "app.services.eval_runner.FlowExecutor"
        ) as MockExecutor:
            instance = MagicMock()
            instance.execute = _execute_side_effect
            MockExecutor.return_value = instance

            runner = EvalRunner(project_id="p1")
            await runner.run(run_id="run-1")

        final_call = patch_table.update_entity.call_args_list[-1]
        entity_arg = (
            final_call.kwargs.get("entity")
            or (final_call.args[0] if final_call.args else None)
        )
        assert entity_arg is not None
        assert entity_arg["status"] == "completed"
        assert entity_arg["failed_items"] == 1
        assert entity_arg["completed_items"] == 1

    async def test_run_missing_flow_sets_failed(self, patch_table: MagicMock) -> None:
        """If _load_flow returns None, the run status is set to 'failed'."""
        run = _run_entity()
        patch_table.get_entity.side_effect = [run, None, run]

        runner = EvalRunner(project_id="p1")
        await runner.run(run_id="run-1")

        final_call = patch_table.update_entity.call_args_list[-1]
        entity_arg = (
            final_call.kwargs.get("entity")
            or (final_call.args[0] if final_call.args else None)
        )
        assert entity_arg is not None
        assert entity_arg["status"] == "failed"
