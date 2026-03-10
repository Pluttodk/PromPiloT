# Create a flow

A flow chains multiple prompts together. Each step receives input, calls its assigned prompt, and passes its output to the next step. Flows are defined as typed objects and stored in Prom-Pilot so they can be versioned, executed, and evaluated.

```python
from prom_pilot import PromPilotClient, Flow, FlowStep

client = PromPilotClient("localhost:8000")
```

## Define and create a single-step flow

A single-step flow is the simplest case — one prompt, one output.

**Async**

```python
import asyncio
from prom_pilot import PromPilotClient, Flow, FlowStep

client = PromPilotClient("localhost:8000")


async def main() -> None:
    flow: Flow = await client.flows.create(
        Flow(
            name="emoji_generator",
            description="Converts a sentence into an emoji representation",
            steps=[
                FlowStep(
                    name="generate",
                    prompt="emoji_system_prompt",
                    version="production",
                )
            ],
        )
    )
    print(flow.name)
    # "emoji_generator"


asyncio.run(main())
```

**Sync**

```python
from prom_pilot import PromPilotClient, Flow, FlowStep

client = PromPilotClient("localhost:8000")

flow: Flow = client.run_sync(
    client.flows.create(
        Flow(
            name="emoji_generator",
            description="Converts a sentence into an emoji representation",
            steps=[
                FlowStep(
                    name="generate",
                    prompt="emoji_system_prompt",
                    version="production",
                )
            ],
        )
    )
)
```

## Define a multi-step flow

Steps can depend on each other. Use `input_mapping` to wire the output of one step into the input of the next. The mapping syntax is `"step_name.output"`.

**Async**

```python
async def main() -> None:
    flow: Flow = await client.flows.create(
        Flow(
            name="emoji_pipeline",
            description="Classifies sentiment then generates matching emojis",
            steps=[
                FlowStep(
                    name="classify_sentiment",
                    prompt="sentiment_classifier",
                    version="production",
                ),
                FlowStep(
                    name="generate_emojis",
                    prompt="emoji_system_prompt",
                    version="production",
                    input_mapping={
                        "sentiment": "classify_sentiment.output",
                    },
                ),
            ],
        )
    )
```

**Sync**

```python
flow: Flow = client.run_sync(
    client.flows.create(
        Flow(
            name="emoji_pipeline",
            description="Classifies sentiment then generates matching emojis",
            steps=[
                FlowStep(
                    name="classify_sentiment",
                    prompt="sentiment_classifier",
                    version="production",
                ),
                FlowStep(
                    name="generate_emojis",
                    prompt="emoji_system_prompt",
                    version="production",
                    input_mapping={
                        "sentiment": "classify_sentiment.output",
                    },
                ),
            ],
        )
    )
)
```

## List and retrieve existing flows

```python
from prom_pilot import Flow

async def main() -> None:
    flows: list[Flow] = await client.flows.list(project="my_project")
    for f in flows:
        print(f.name, f.description)

    specific_flow: Flow = await client.flows.get("emoji_pipeline")
    print(specific_flow.steps)
```

## Update a flow

Updating a flow replaces its step definitions. The flow name stays the same and the change is versioned automatically.

```python
async def main() -> None:
    updated: Flow = await client.flows.update(
        "emoji_pipeline",
        steps=[
            FlowStep(
                name="classify_sentiment",
                prompt="sentiment_classifier",
                version="v2",
            ),
            FlowStep(
                name="generate_emojis",
                prompt="emoji_system_prompt",
                version="production",
                input_mapping={
                    "sentiment": "classify_sentiment.output",
                },
            ),
        ],
    )
```
