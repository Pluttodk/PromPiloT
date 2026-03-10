# Use a flow in the code

Once a flow is created in Prom-Pilot, you call it from Python by name. The SDK resolves the prompt versions, passes data between steps, and returns a structured result.

```python
from prom_pilot import PromPilotClient

client = PromPilotClient("localhost:8000")
```

## Single node prompt

A single-step flow takes one input and returns one output. This is equivalent to calling a prompt directly but goes through the flow engine so execution is traced.

**Async**

```python
import asyncio
from prom_pilot import PromPilotClient, FlowResult

client = PromPilotClient("localhost:8000")


async def main() -> None:
    result: FlowResult = await client.flows.execute(
        "emoji_generator",
        inputs={"sentence": "The sun is shining today"},
    )
    print(result.output)
    # {"text": "The sun is shining today ☀️"}


asyncio.run(main())
```

**Sync**

```python
from prom_pilot import PromPilotClient, FlowResult

client = PromPilotClient("localhost:8000")

result: FlowResult = client.run_sync(
    client.flows.execute(
        "emoji_generator",
        inputs={"sentence": "The sun is shining today"},
    )
)
print(result.output)
```

## Multi stage flow

A multi-step flow runs each step in order and wires outputs between steps automatically. You receive the final output and can inspect intermediate step results.

**Async**

```python
async def main() -> None:
    result: FlowResult = await client.flows.execute(
        "emoji_pipeline",
        inputs={"sentence": "The sun is shining today"},
    )

    sentiment: str = result.steps["classify_sentiment"].output["label"]
    # "positive"

    final: str = result.steps["generate_emojis"].output["text"]
    # "The sun is shining today ☀️"

    print(result.output)
    # {"text": "The sun is shining today ☀️"}
```

**Sync**

```python
result: FlowResult = client.run_sync(
    client.flows.execute(
        "emoji_pipeline",
        inputs={"sentence": "The sun is shining today"},
    )
)

sentiment: str = result.steps["classify_sentiment"].output["label"]
final: str = result.steps["generate_emojis"].output["text"]
```

## Flow with multiple inputs but one output

Flows can accept several named inputs. Each step declares which of those it consumes.

```python
from prom_pilot import FlowResult

async def main() -> None:
    result: FlowResult = await client.flows.execute(
        "personalised_emoji_pipeline",
        inputs={
            "sentence": "The sun is shining today",
            "user_language": "Danish",
            "tone": "playful",
        },
    )
    print(result.output)
    # {"text": "Solen skinner i dag ☀️😄"}
```

The flow definition maps each input key to the steps that need it. From the caller's side, you always pass a flat `inputs` dict.

## Schema validation of the flow

Before execution, the SDK validates that all required inputs are present and that each step's `input_mapping` references valid sources. Validation errors are raised before any LLM call is made.

```python
from prom_pilot import FlowResult, FlowValidationError

async def main() -> None:
    try:
        result: FlowResult = await client.flows.execute(
            "emoji_pipeline",
            inputs={},
        )
    except FlowValidationError as error:
        print(error.missing_inputs)
        # ["sentence"]
        print(error.broken_mappings)
        # []
```

You can also validate without executing:

```python
from prom_pilot import FlowValidationResult

async def main() -> None:
    validation: FlowValidationResult = await client.flows.validate(
        "emoji_pipeline",
        inputs={"sentence": "test"},
    )
    print(validation.is_valid)
    # True
```
