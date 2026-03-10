# Create a prompt and fetch the newest Production prompt

```python
from prom_pilot import PromPilotClient, Prompt, PromptVersion

client = PromPilotClient("localhost:8000")
```

## Fetch the production prompt

When no version is specified, `production` is always returned.

**Async**

```python
import asyncio
from prom_pilot import PromPilotClient, Prompt

client = PromPilotClient("localhost:8000")


async def main() -> None:
    prompt: Prompt = await client.prompts.get("emoji_system_prompt")
    print(prompt.content)
    # "You are an emoji expert that generates emojis to a sentence"


asyncio.run(main())
```

**Sync**

```python
from prom_pilot import PromPilotClient, Prompt

client = PromPilotClient("localhost:8000")

prompt: Prompt = client.run_sync(client.prompts.get("emoji_system_prompt"))
print(prompt.content)
# "You are an emoji expert that generates emojis to a sentence"
```

You can also request a specific version by name:

```python
prompt: Prompt = await client.prompts.get("emoji_system_prompt", version="v3")
```

## Create a new version

Creating a version saves a new snapshot of the prompt content. It is not yet in production until you explicitly promote it.

**Async**

```python
async def main() -> None:
    version: PromptVersion = await client.prompts.create_version(
        "emoji_system_prompt",
        content="You are an emoji expert, and will generate emojis that perfectly represent the sentence",
        tags=["staging", "demo"],
        message="Improved phrasing for emoji generation",
    )
    print(version.version)
    # "v2"
```

**Sync**

```python
version: PromptVersion = client.run_sync(
    client.prompts.create_version(
        "emoji_system_prompt",
        content="You are an emoji expert, and will generate emojis that perfectly represent the sentence",
        tags=["staging", "demo"],
        message="Improved phrasing for emoji generation",
    )
)
```

## Promote a version to production

Once you have validated the new version, promote it so all callers that request `production` receive it.

**Async**

```python
async def main() -> None:
    await client.prompts.promote(
        "emoji_system_prompt",
        version="v2",
        to="production",
    )
```

**Sync**

```python
client.run_sync(
    client.prompts.promote(
        "emoji_system_prompt",
        version="v2",
        to="production",
    )
)
```

## Do a rollback

If a new production version introduces a regression, roll back to the previous version in one call.

**Async**

```python
async def main() -> None:
    await client.prompts.rollback("emoji_system_prompt", to_version="v1")
```

**Sync**

```python
client.run_sync(
    client.prompts.rollback("emoji_system_prompt", to_version="v1")
)
```

After a rollback, `client.prompts.get("emoji_system_prompt")` will return `v1` content until a new version is promoted.

## List all prompts in a project

```python
from prom_pilot import Prompt

async def main() -> None:
    prompts: list[Prompt] = await client.prompts.list(project="my_project")
    for prompt in prompts:
        print(f"{prompt.name}  —  {prompt.version}  —  {prompt.tags}")
```
