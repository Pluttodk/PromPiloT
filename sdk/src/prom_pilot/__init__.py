"""Prom-Pilot Python SDK.

Call flows, manage datasets, and trigger evaluations from Python code.

Quick start::

    import asyncio
    from prom_pilot import PromPilotClient

    async def main():
        async with PromPilotClient(
            base_url="http://localhost:8000",
            project_id="<project-id>",
        ) as client:
            flows = await client.flows.list()
            result = await client.flows.execute(
                flows[0].flow_id,
                inputs={"question": "Hello"},
            )
            print(result.outputs)

    asyncio.run(main())
"""

from prom_pilot.client import PromPilotClient
from prom_pilot.exceptions import ExecutionError, NotFoundError, PromPilotError
from prom_pilot.models import (
    DatasetItemResponse,
    DatasetResponse,
    EvalResultResponse,
    EvalRunResponse,
    FlowExecuteResponse,
    FlowResponse,
    FlowResult,
    PromptResponse,
    PromptVersionResponse,
    Trace,
    TraceListItem,
    TraceResponse,
)
from prom_pilot.resources.prompts import PromptsResource

__all__ = [
    "PromPilotClient",
    "PromPilotError",
    "NotFoundError",
    "ExecutionError",
    "FlowExecuteResponse",
    "FlowResponse",
    "FlowResult",
    "PromptResponse",
    "PromptVersionResponse",
    "PromptsResource",
    "DatasetResponse",
    "DatasetItemResponse",
    "EvalRunResponse",
    "EvalResultResponse",
    "TraceResponse",
    "TraceListItem",
    "Trace",
]
