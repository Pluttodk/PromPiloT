# Run a flow

Running a flow through the SDK automatically records a trace. Every step — its input, output, latency, and token usage — is captured and stored so you can inspect and debug executions after the fact.

```python
from prom_pilot import PromPilotClient

client = PromPilotClient("localhost:8000")
```

## Run a flow and get the trace ID

Every `FlowResult` includes a `trace_id` that links the execution to a full trace record.

**Async**

```python
import asyncio
from prom_pilot import PromPilotClient, FlowResult

client = PromPilotClient("localhost:8000")


async def main() -> None:
    result: FlowResult = await client.flows.execute(
        "emoji_pipeline",
        inputs={"sentence": "The sun is shining today"},
    )

    print(result.output)
    # {"text": "The sun is shining today ☀️"}

    print(result.trace_id)
    # "trace_01jk2m..."


asyncio.run(main())
```

**Sync**

```python
from prom_pilot import PromPilotClient, FlowResult

client = PromPilotClient("localhost:8000")

result: FlowResult = client.run_sync(
    client.flows.execute(
        "emoji_pipeline",
        inputs={"sentence": "The sun is shining today"},
    )
)
print(result.trace_id)
```

## See the trace

Fetch the full trace by its ID to inspect every step of the execution, including latency, token counts, and raw LLM responses.

**Async**

```python
from prom_pilot import Trace, TraceStep

async def main() -> None:
    trace: Trace = await client.traces.get(result.trace_id)

    print(trace.flow_name)
    # "emoji_pipeline"

    print(trace.total_duration_ms)
    # 1240

    for step in trace.steps:
        print(step.name, step.duration_ms, step.tokens_used)
        # "classify_sentiment"  612  83
        # "generate_emojis"     628  47
```

**Sync**

```python
from prom_pilot import Trace

trace: Trace = client.run_sync(client.traces.get(result.trace_id))

for step in trace.steps:
    print(step.name, step.duration_ms, step.tokens_used)
```

You can also search traces by flow name or time range:

```python
from datetime import datetime, timedelta
from prom_pilot import Trace

async def main() -> None:
    traces: list[Trace] = await client.traces.list(
        flow_name="emoji_pipeline",
        since=datetime.utcnow() - timedelta(hours=24),
        limit=50,
    )
```

## Debug the output within a flow

When a flow returns unexpected output, inspect each step's raw input and output to find where the result diverged.

```python
from prom_pilot import Trace, TraceStep

async def main() -> None:
    trace: Trace = await client.traces.get(result.trace_id)

    classify_step: TraceStep = trace.steps["classify_sentiment"]
    print(classify_step.prompt_rendered)
    # The full prompt sent to the LLM after variable substitution

    print(classify_step.raw_input)
    # {"sentence": "The sun is shining today"}

    print(classify_step.raw_output)
    # {"label": "positive", "confidence": 0.97}

    emoji_step: TraceStep = trace.steps["generate_emojis"]
    print(emoji_step.raw_input)
    # {"sentence": "The sun is shining today", "sentiment": "positive"}

    print(emoji_step.raw_output)
    # {"text": "The sun is shining today ☀️"}
```

This lets you pinpoint whether the issue is in the data fed to a step, the prompt template itself, or the model's response.
