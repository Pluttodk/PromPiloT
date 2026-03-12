"""Integration-style unit tests for the Prom-Pilot SDK using respx mock transport."""

from __future__ import annotations

import json
from datetime import datetime

import httpx
import pytest
import respx

from prom_pilot import PromPilotClient
from prom_pilot.exceptions import ExecutionError, NotFoundError, PromPilotError
from prom_pilot.models import PromptResponse, PromptVersionResponse

BASE_URL = "http://test.local"
PROJECT_ID = "proj-1"
NOW = datetime.utcnow().isoformat()

FLOW_ID = "flow-abc"
DATASET_ID = "ds-xyz"
RUN_ID = "run-001"
TRACE_ID = "trace-111"
PROMPT_ID = "prompt-ppp"


def _flow_payload(flow_id: str = FLOW_ID) -> dict:
    return {
        "flow_id": flow_id,
        "project_id": PROJECT_ID,
        "name": "Test Flow",
        "description": "",
        "created_by": "user",
        "created_at": NOW,
        "updated_at": NOW,
    }


def _dataset_payload(dataset_id: str = DATASET_ID) -> dict:
    return {
        "dataset_id": dataset_id,
        "project_id": PROJECT_ID,
        "name": "Test Dataset",
        "description": "",
        "item_count": 0,
        "created_by": "user",
        "created_at": NOW,
        "updated_at": NOW,
    }


def _item_payload(item_id: str = "item-1") -> dict:
    return {
        "item_id": item_id,
        "dataset_id": DATASET_ID,
        "input": "Hello",
        "expected_output": "Hi",
        "source_trace_id": None,
        "notes": None,
        "created_at": NOW,
    }


def _run_payload(status: str = "completed") -> dict:
    return {
        "run_id": RUN_ID,
        "project_id": PROJECT_ID,
        "name": "CI eval",
        "dataset_id": DATASET_ID,
        "dataset_name": "Test Dataset",
        "flow_id": FLOW_ID,
        "flow_name": "Test Flow",
        "status": status,
        "total_items": 1,
        "completed_items": 1,
        "failed_items": 0,
        "auto_score": False,
        "judge_criteria": None,
        "judge_model_config_id": None,
        "item_limit": None,
        "error_message": None,
        "created_by": "user",
        "created_at": NOW,
        "completed_at": NOW,
    }


def _prompt_payload(prompt_id: str = PROMPT_ID) -> dict:
    return {
        "prompt_id": prompt_id,
        "project_id": PROJECT_ID,
        "name": "Test Prompt",
        "template": "Hello {{ name }}",
        "system_prompt": "",
        "description": "",
        "production_version": None,
        "latest_version": 0,
        "created_by": "user",
        "created_at": NOW,
        "updated_at": NOW,
    }


def _version_payload(version_number: int = 1) -> dict:
    return {
        "version_number": version_number,
        "template": "Hello {{ name }}",
        "tags": [],
        "created_by": "user",
        "created_at": NOW,
    }


def _trace_payload() -> dict:
    return {
        "trace_id": TRACE_ID,
        "project_id": PROJECT_ID,
        "flow_id": FLOW_ID,
        "flow_name": "Test Flow",
        "status": "success",
        "total_tokens": 100,
        "execution_time_ms": 500,
        "error_message": None,
        "created_at": NOW,
        "eval_run_id": None,
        "score_count": 0,
    }


@pytest.fixture
def client() -> PromPilotClient:
    """Return a PromPilotClient backed by the real httpx client (respx intercepts)."""
    return PromPilotClient(base_url=BASE_URL, project_id=PROJECT_ID)


class TestFlowsResource:
    """Tests for FlowsResource covering list, get, execute, and error paths."""

    @respx.mock
    async def test_list_flows(self, client: PromPilotClient) -> None:
        """list() returns a populated list of FlowResponse objects."""
        respx.get(f"{BASE_URL}/api/v1/flows/").mock(
            return_value=httpx.Response(200, json=[_flow_payload()])
        )
        flows = await client.flows.list()
        assert len(flows) == 1
        assert flows[0].flow_id == FLOW_ID
        assert flows[0].name == "Test Flow"

    @respx.mock
    async def test_get_flow(self, client: PromPilotClient) -> None:
        """get() returns a single FlowResponse for a valid ID."""
        respx.get(f"{BASE_URL}/api/v1/flows/{FLOW_ID}").mock(
            return_value=httpx.Response(200, json=_flow_payload())
        )
        flow = await client.flows.get(FLOW_ID)
        assert flow.flow_id == FLOW_ID

    @respx.mock
    async def test_get_flow_not_found(self, client: PromPilotClient) -> None:
        """get() raises NotFoundError on 404."""
        respx.get(f"{BASE_URL}/api/v1/flows/bad-id").mock(
            return_value=httpx.Response(404, json={"detail": "Flow not found"})
        )
        with pytest.raises(NotFoundError, match="Flow not found"):
            await client.flows.get("bad-id")

    @respx.mock
    async def test_execute_flow(self, client: PromPilotClient) -> None:
        """execute() returns a FlowExecuteResponse with outputs and trace_id."""
        execute_response = {
            "trace_id": TRACE_ID,
            "outputs": {"answer": "Hello back"},
            "execution_time_ms": 250,
            "status": "success",
            "error_message": None,
        }
        respx.post(f"{BASE_URL}/api/v1/flows/{FLOW_ID}/execute").mock(
            return_value=httpx.Response(200, json=execute_response)
        )
        result = await client.flows.execute(FLOW_ID, inputs={"question": "Hello"})
        assert result.trace_id == TRACE_ID
        assert result.outputs == {"answer": "Hello back"}
        assert result.execution_time_ms == 250

    @respx.mock
    async def test_execute_flow_server_error(self, client: PromPilotClient) -> None:
        """execute() raises ExecutionError on a 500 response."""
        respx.post(f"{BASE_URL}/api/v1/flows/{FLOW_ID}/execute").mock(
            return_value=httpx.Response(
                500, json={"detail": "Flow execution failed: model timeout"}
            )
        )
        with pytest.raises(ExecutionError, match="Flow execution failed"):
            await client.flows.execute(FLOW_ID, inputs={})


class TestDatasetsResource:
    """Tests for DatasetsResource covering CRUD and item management."""

    @respx.mock
    async def test_create_dataset(self, client: PromPilotClient) -> None:
        """create() returns a DatasetResponse with the given name."""
        respx.post(f"{BASE_URL}/api/v1/datasets/").mock(
            return_value=httpx.Response(201, json=_dataset_payload())
        )
        ds = await client.datasets.create("Test Dataset")
        assert ds.dataset_id == DATASET_ID
        assert ds.name == "Test Dataset"

    @respx.mock
    async def test_add_and_list_items(self, client: PromPilotClient) -> None:
        """add_item() and list_items() work together correctly."""
        respx.post(f"{BASE_URL}/api/v1/datasets/{DATASET_ID}/items").mock(
            return_value=httpx.Response(201, json=_item_payload())
        )
        respx.get(f"{BASE_URL}/api/v1/datasets/{DATASET_ID}/items").mock(
            return_value=httpx.Response(200, json=[_item_payload()])
        )
        item = await client.datasets.add_item(DATASET_ID, input="Hello", expected_output="Hi")
        assert item.item_id == "item-1"
        assert item.input == "Hello"

        items = await client.datasets.list_items(DATASET_ID)
        assert len(items) == 1
        assert items[0].expected_output == "Hi"

    @respx.mock
    async def test_delete_item(self, client: PromPilotClient) -> None:
        """delete_item() succeeds without raising for a valid item."""
        respx.delete(
            f"{BASE_URL}/api/v1/datasets/{DATASET_ID}/items/item-1"
        ).mock(return_value=httpx.Response(200, json={"message": "Item item-1 deleted"}))
        await client.datasets.delete_item(DATASET_ID, "item-1")


class TestEvaluationsResource:
    """Tests for EvaluationsResource including run_and_wait polling."""

    @respx.mock
    async def test_create_eval_run(self, client: PromPilotClient) -> None:
        """create() returns an EvalRunResponse with pending status."""
        pending = _run_payload(status="pending")
        respx.post(f"{BASE_URL}/api/v1/evaluations/").mock(
            return_value=httpx.Response(202, json=pending)
        )
        run = await client.evaluations.create("CI eval", DATASET_ID, FLOW_ID)
        assert run.run_id == RUN_ID
        assert run.status == "pending"

    @respx.mock
    async def test_run_and_wait_completes(self, client: PromPilotClient) -> None:
        """run_and_wait() polls until completed and returns the final run."""
        pending = _run_payload(status="pending")
        running = _run_payload(status="running")
        completed = _run_payload(status="completed")

        post_mock = respx.post(f"{BASE_URL}/api/v1/evaluations/").mock(
            return_value=httpx.Response(202, json=pending)
        )
        get_responses = [
            httpx.Response(200, json=running),
            httpx.Response(200, json=completed),
        ]
        get_mock = respx.get(f"{BASE_URL}/api/v1/evaluations/{RUN_ID}").mock(
            side_effect=get_responses
        )

        run = await client.evaluations.run_and_wait(
            "CI eval", DATASET_ID, FLOW_ID, poll_interval=0.01
        )
        assert run.status == "completed"
        assert run.completed_items == 1
        assert post_mock.called
        assert get_mock.call_count == 2

    @respx.mock
    async def test_run_and_wait_failed(self, client: PromPilotClient) -> None:
        """run_and_wait() raises ExecutionError when the run fails."""
        failed = _run_payload(status="failed")
        failed["error_message"] = "out of memory"

        respx.post(f"{BASE_URL}/api/v1/evaluations/").mock(
            return_value=httpx.Response(202, json=_run_payload(status="pending"))
        )
        respx.get(f"{BASE_URL}/api/v1/evaluations/{RUN_ID}").mock(
            return_value=httpx.Response(200, json=failed)
        )
        with pytest.raises(ExecutionError, match="out of memory"):
            await client.evaluations.run_and_wait(
                "CI eval", DATASET_ID, FLOW_ID, poll_interval=0.01
            )


class TestTracesResource:
    """Tests for TracesResource covering get and list."""

    @respx.mock
    async def test_get_trace(self, client: PromPilotClient) -> None:
        """get() returns a TraceResponse for a valid trace ID."""
        full_trace = {
            "trace_id": TRACE_ID,
            "project_id": PROJECT_ID,
            "flow_id": FLOW_ID,
            "flow_name": "Test Flow",
            "status": "success",
            "inputs": {"question": "Hello"},
            "outputs": {"answer": "Hi"},
            "node_traces": [],
            "total_tokens": 100,
            "execution_time_ms": 500,
            "error_message": None,
            "created_at": NOW,
            "eval_run_id": None,
        }
        respx.get(f"{BASE_URL}/api/v1/traces/{TRACE_ID}").mock(
            return_value=httpx.Response(200, json=full_trace)
        )
        trace = await client.traces.get(TRACE_ID)
        assert trace.trace_id == TRACE_ID
        assert trace.inputs == {"question": "Hello"}
        assert trace.outputs == {"answer": "Hi"}

    @respx.mock
    async def test_list_traces(self, client: PromPilotClient) -> None:
        """list() returns a list of TraceListItem objects."""
        respx.get(f"{BASE_URL}/api/v1/traces/").mock(
            return_value=httpx.Response(200, json=[_trace_payload()])
        )
        traces = await client.traces.list(flow_id=FLOW_ID, limit=10)
        assert len(traces) == 1
        assert traces[0].trace_id == TRACE_ID
        assert traces[0].status == "success"

    @respx.mock
    async def test_get_trace_not_found(self, client: PromPilotClient) -> None:
        """get() raises NotFoundError on 404."""
        respx.get(f"{BASE_URL}/api/v1/traces/bad-trace").mock(
            return_value=httpx.Response(404, json={"detail": "Trace not found"})
        )
        with pytest.raises(NotFoundError, match="Trace not found"):
            await client.traces.get("bad-trace")


class TestFlowsResourceMutations:
    """Tests for FlowsResource.create, update, and delete."""

    @respx.mock
    async def test_create_flow(self, client: PromPilotClient) -> None:
        """create() returns a FlowResponse for the new flow."""
        respx.post(f"{BASE_URL}/api/v1/flows/").mock(
            return_value=httpx.Response(201, json=_flow_payload())
        )
        flow = await client.flows.create("Test Flow")
        assert flow.flow_id == FLOW_ID
        assert flow.name == "Test Flow"

    @respx.mock
    async def test_update_flow(self, client: PromPilotClient) -> None:
        """update() returns the updated FlowResponse."""
        updated = _flow_payload()
        updated["name"] = "Renamed Flow"
        respx.put(f"{BASE_URL}/api/v1/flows/{FLOW_ID}").mock(
            return_value=httpx.Response(200, json=updated)
        )
        flow = await client.flows.update(FLOW_ID, name="Renamed Flow")
        assert flow.name == "Renamed Flow"

    @respx.mock
    async def test_delete_flow(self, client: PromPilotClient) -> None:
        """delete() completes without raising for an existing flow."""
        respx.delete(f"{BASE_URL}/api/v1/flows/{FLOW_ID}").mock(
            return_value=httpx.Response(200, json={"message": "deleted"})
        )
        await client.flows.delete(FLOW_ID)

    @respx.mock
    async def test_delete_flow_not_found(self, client: PromPilotClient) -> None:
        """delete() raises NotFoundError on 404."""
        respx.delete(f"{BASE_URL}/api/v1/flows/bad-id").mock(
            return_value=httpx.Response(404, json={"detail": "Flow not found"})
        )
        with pytest.raises(NotFoundError):
            await client.flows.delete("bad-id")


class TestPromptsResource:
    """Tests for PromptsResource covering CRUD and versioning."""

    @respx.mock
    async def test_list_prompts(self, client: PromPilotClient) -> None:
        """list() returns a list of PromptResponse objects."""
        respx.get(f"{BASE_URL}/api/v1/prompts/").mock(
            return_value=httpx.Response(200, json=[_prompt_payload()])
        )
        prompts = await client.prompts.list()
        assert len(prompts) == 1
        assert prompts[0].prompt_id == PROMPT_ID
        assert prompts[0].content == "Hello {{ name }}"

    @respx.mock
    async def test_create_prompt(self, client: PromPilotClient) -> None:
        """create() returns a PromptResponse for the new prompt."""
        respx.post(f"{BASE_URL}/api/v1/prompts/").mock(
            return_value=httpx.Response(201, json=_prompt_payload())
        )
        prompt = await client.prompts.create("Test Prompt", template="Hello {{ name }}")
        assert prompt.prompt_id == PROMPT_ID
        assert prompt.name == "Test Prompt"

    @respx.mock
    async def test_get_prompt(self, client: PromPilotClient) -> None:
        """get() returns a single PromptResponse."""
        respx.get(f"{BASE_URL}/api/v1/prompts/{PROMPT_ID}").mock(
            return_value=httpx.Response(200, json=_prompt_payload())
        )
        prompt = await client.prompts.get(PROMPT_ID)
        assert prompt.prompt_id == PROMPT_ID

    @respx.mock
    async def test_get_prompt_not_found(self, client: PromPilotClient) -> None:
        """get() raises NotFoundError on 404."""
        respx.get(f"{BASE_URL}/api/v1/prompts/bad").mock(
            return_value=httpx.Response(404, json={"detail": "Prompt not found"})
        )
        with pytest.raises(NotFoundError, match="Prompt not found"):
            await client.prompts.get("bad")

    @respx.mock
    async def test_update_prompt(self, client: PromPilotClient) -> None:
        """update() returns the updated PromptResponse."""
        updated = _prompt_payload()
        updated["name"] = "Renamed"
        respx.put(f"{BASE_URL}/api/v1/prompts/{PROMPT_ID}").mock(
            return_value=httpx.Response(200, json=updated)
        )
        prompt = await client.prompts.update(PROMPT_ID, name="Renamed")
        assert prompt.name == "Renamed"

    @respx.mock
    async def test_delete_prompt(self, client: PromPilotClient) -> None:
        """delete() completes without raising."""
        respx.delete(f"{BASE_URL}/api/v1/prompts/{PROMPT_ID}").mock(
            return_value=httpx.Response(200, json={"message": "deleted"})
        )
        await client.prompts.delete(PROMPT_ID)

    @respx.mock
    async def test_list_versions(self, client: PromPilotClient) -> None:
        """list_versions() returns a list of PromptVersionResponse objects."""
        respx.get(f"{BASE_URL}/api/v1/prompts/{PROMPT_ID}/versions").mock(
            return_value=httpx.Response(200, json=[_version_payload(1), _version_payload(2)])
        )
        versions = await client.prompts.list_versions(PROMPT_ID)
        assert len(versions) == 2
        assert versions[0].version_number == 1
        assert versions[0].content == "Hello {{ name }}"

    @respx.mock
    async def test_create_version(self, client: PromPilotClient) -> None:
        """create_version() snapshots the current template."""
        respx.post(f"{BASE_URL}/api/v1/prompts/{PROMPT_ID}/versions").mock(
            return_value=httpx.Response(201, json=_version_payload(1))
        )
        version = await client.prompts.create_version(PROMPT_ID)
        assert version.version_number == 1

    @respx.mock
    async def test_promote_sets_production_tag(self, client: PromPilotClient) -> None:
        """promote() sends tags=['production'] to the version tags endpoint."""
        tagged = _version_payload(1)
        tagged["tags"] = ["production"]
        route = respx.put(
            f"{BASE_URL}/api/v1/prompts/{PROMPT_ID}/versions/1/tags"
        ).mock(return_value=httpx.Response(200, json=tagged))

        version = await client.prompts.promote(PROMPT_ID, 1)

        assert version.tags == ["production"]
        assert route.called
        sent_body = json.loads(route.calls.last.request.content)
        assert sent_body["tags"] == ["production"]

    @respx.mock
    async def test_rollback_promotes_older_version(self, client: PromPilotClient) -> None:
        """rollback() is a convenience alias for promote() on an older version."""
        tagged = _version_payload(2)
        tagged["tags"] = ["production"]
        route = respx.put(
            f"{BASE_URL}/api/v1/prompts/{PROMPT_ID}/versions/2/tags"
        ).mock(return_value=httpx.Response(200, json=tagged))

        version = await client.prompts.rollback(PROMPT_ID, to_version=2)

        assert version.tags == ["production"]
        assert route.called


class TestClientHelpers:
    """Tests for PromPilotClient context manager and run_sync."""

    @respx.mock
    async def test_context_manager(self) -> None:
        """async with PromPilotClient works and closes cleanly."""
        respx.get(f"{BASE_URL}/api/v1/flows/").mock(
            return_value=httpx.Response(200, json=[])
        )
        async with PromPilotClient(base_url=BASE_URL, project_id=PROJECT_ID) as c:
            flows = await c.flows.list()
        assert flows == []

    def test_run_sync(self) -> None:
        """run_sync() executes a coroutine and returns its value."""
        with respx.mock:
            respx.get(f"{BASE_URL}/api/v1/flows/").mock(
                return_value=httpx.Response(200, json=[_flow_payload()])
            )
            c = PromPilotClient(base_url=BASE_URL, project_id=PROJECT_ID)
            flows = c.run_sync(c.flows.list())
        assert flows[0].flow_id == FLOW_ID

    @respx.mock
    async def test_generic_4xx_raises_prom_pilot_error(
        self, client: PromPilotClient
    ) -> None:
        """Non-404 4xx responses raise PromPilotError with the status code."""
        respx.get(f"{BASE_URL}/api/v1/flows/").mock(
            return_value=httpx.Response(403, json={"detail": "Forbidden"})
        )
        with pytest.raises(PromPilotError) as exc_info:
            await client.flows.list()
        assert exc_info.value.status_code == 403
        assert "Forbidden" in exc_info.value.detail
