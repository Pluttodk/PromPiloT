"""Unit tests for FlowExecutor — topological sort, variable extraction, and execution."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.storage.table_client as tbl_module
from app.models.schemas import FlowDefinition, FlowEdge, FlowNode, FlowNodeData, FlowNodePosition
from app.services.flow_executor import FlowExecutor


def _pos() -> FlowNodePosition:
    """Return a default node position."""
    return FlowNodePosition(x=0.0, y=0.0)


def _node(node_id: str, node_type: str, name: str | None = None) -> FlowNode:
    """Build a FlowNode with minimal required fields."""
    return FlowNode(
        id=node_id,
        type=node_type,
        data=FlowNodeData(name=name),
        position=_pos(),
    )


def _edge(edge_id: str, source: str, target: str, target_handle: str | None = None) -> FlowEdge:
    """Build a FlowEdge."""
    return FlowEdge(id=edge_id, source=source, target=target, targetHandle=target_handle)


def _trace_entity(project_id: str = "p1", trace_id: str = "t1") -> dict[str, Any]:
    """Return a minimal mutable trace entity dict for _update_trace."""
    return {
        "PartitionKey": project_id,
        "RowKey": trace_id,
        "status": "running",
        "inputs": "{}",
        "outputs": "{}",
        "node_traces": "[]",
        "total_tokens": None,
        "execution_time_ms": None,
        "error_message": None,
    }


@pytest.fixture
def patch_table(mock_table_client: MagicMock):
    """Set the table storage singleton to the mock before each test."""
    old = tbl_module._table_client
    tbl_module._table_client = mock_table_client
    yield mock_table_client
    tbl_module._table_client = old


class TestTopologicalSort:
    """Tests for FlowExecutor._topological_sort."""

    def test_topological_sort_linear_chain(self, patch_table: MagicMock) -> None:
        """Three-node A→B→C chain returns nodes in dependency order."""
        definition = FlowDefinition(
            nodes=[_node("a", "input"), _node("b", "prompt"), _node("c", "output")],
            edges=[_edge("e1", "a", "b"), _edge("e2", "b", "c")],
        )
        executor = FlowExecutor(project_id="p1")
        order = executor._topological_sort(definition)
        assert order.index("a") < order.index("b") < order.index("c")

    def test_topological_sort_cycle_raises(self, patch_table: MagicMock) -> None:
        """A cyclic dependency raises ValueError."""
        definition = FlowDefinition(
            nodes=[_node("a", "input"), _node("b", "prompt")],
            edges=[_edge("e1", "a", "b"), _edge("e2", "b", "a")],
        )
        executor = FlowExecutor(project_id="p1")
        with pytest.raises(ValueError, match="cycle"):
            executor._topological_sort(definition)

    def test_topological_sort_disconnected_node_included(self, patch_table: MagicMock) -> None:
        """An isolated node with no edges still appears in the result."""
        definition = FlowDefinition(
            nodes=[_node("a", "input"), _node("b", "output"), _node("isolated", "input")],
            edges=[_edge("e1", "a", "b")],
        )
        executor = FlowExecutor(project_id="p1")
        order = executor._topological_sort(definition)
        assert "isolated" in order
        assert len(order) == 3


class TestExtractVariables:
    """Tests for FlowExecutor._extract_variables."""

    def test_extract_variables_finds_jinja_vars(self, patch_table: MagicMock) -> None:
        """Variables enclosed in {{ }} are extracted."""
        executor = FlowExecutor(project_id="p1")
        result = executor._extract_variables("Hello {{ name }}, you are {{ age }} years old.")
        assert set(result) == {"name", "age"}

    def test_extract_variables_deduplication(self, patch_table: MagicMock) -> None:
        """The same variable appearing twice is returned only once."""
        executor = FlowExecutor(project_id="p1")
        result = executor._extract_variables("{{ x }} and {{ x }}")
        assert result.count("x") == 1


class TestGetConnectedValue:
    """Tests for FlowExecutor._get_connected_value."""

    def test_get_connected_value_exact_handle(self, patch_table: MagicMock) -> None:
        """An edge whose targetHandle matches returns the source node output."""
        definition = FlowDefinition(
            nodes=[_node("src", "input"), _node("tgt", "prompt")],
            edges=[_edge("e1", "src", "tgt", target_handle="user_input")],
        )
        node_outputs = {"src": "hello"}
        executor = FlowExecutor(project_id="p1")
        value = executor._get_connected_value("tgt", "user_input", definition, node_outputs)
        assert value == "hello"

    def test_get_connected_value_null_handle_fallback(self, patch_table: MagicMock) -> None:
        """When the target asks for a specific handle but only a None-handle edge exists,
        the null-handle edge is used as a fallback."""
        definition = FlowDefinition(
            nodes=[_node("src", "input"), _node("tgt", "output")],
            edges=[_edge("e1", "src", "tgt", target_handle=None)],
        )
        node_outputs = {"src": "world"}
        executor = FlowExecutor(project_id="p1")
        value = executor._get_connected_value("tgt", "some_handle", definition, node_outputs)
        assert value == "world"


class TestExecute:
    """End-to-end execute() tests using input→output flows."""

    @pytest.fixture
    def trace_mock(self, patch_table: MagicMock) -> MagicMock:
        """Configure mock to return a trace entity on get_entity."""
        patch_table.get_entity.return_value = _trace_entity()
        return patch_table

    async def test_execute_input_output_flow_passes_through(
        self, trace_mock: MagicMock
    ) -> None:
        """An input→output flow with no LLM nodes returns inputs as outputs."""
        definition = FlowDefinition(
            nodes=[
                _node("in1", "input", name="question"),
                _node("out1", "output", name="answer"),
            ],
            edges=[_edge("e1", "in1", "out1")],
        )

        from app.models.schemas import Flow

        flow = Flow(
            flow_id="f1",
            project_id="p1",
            name="Simple",
            definition=definition,
            created_by="user",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        executor = FlowExecutor(project_id="p1")
        result = await executor.execute(flow=flow, inputs={"in1": "hello"})

        assert result.outputs == {"answer": "hello"}

    async def test_execute_records_trace_in_storage(self, trace_mock: MagicMock) -> None:
        """Executing a flow calls insert_entity (create trace) and update_entity (finalise)."""
        definition = FlowDefinition(
            nodes=[_node("in1", "input"), _node("out1", "output")],
            edges=[_edge("e1", "in1", "out1")],
        )

        from app.models.schemas import Flow

        flow = Flow(
            flow_id="f1",
            project_id="p1",
            name="Simple",
            definition=definition,
            created_by="user",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        executor = FlowExecutor(project_id="p1")
        await executor.execute(flow=flow, inputs={"in1": "test"})

        trace_mock.insert_entity.assert_called_once()
        trace_mock.update_entity.assert_called_once()

    async def test_execute_failed_node_marks_trace_failed(
        self, trace_mock: MagicMock
    ) -> None:
        """When a node raises, _update_trace is called with status='failed'."""
        definition = FlowDefinition(
            nodes=[_node("prompt1", "prompt")],
            edges=[],
        )

        from app.models.schemas import Flow

        flow = Flow(
            flow_id="f2",
            project_id="p1",
            name="FailFlow",
            definition=definition,
            created_by="user",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        executor = FlowExecutor(project_id="p1")

        with pytest.raises(Exception):
            await executor.execute(flow=flow, inputs={})

        trace_mock.update_entity.assert_called_once()
        updated_entity = trace_mock.update_entity.call_args.kwargs.get(
            "entity"
        ) or trace_mock.update_entity.call_args.args[0] if trace_mock.update_entity.call_args.args else trace_mock.update_entity.call_args[1].get("entity")
        assert updated_entity["status"] == "failed"
