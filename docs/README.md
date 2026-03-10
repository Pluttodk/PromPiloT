# Prom-Pilot Documentation

## Python SDK

The `prom_pilot` Python SDK lets you manage prompts, build flows, run evaluations, and inspect traces directly from your code.

Install the SDK:

```bash
pip install prom_pilot
```

Connect to your Prom-Pilot instance:

```python
from prom_pilot import PromPilotClient

client = PromPilotClient("localhost:8000")
```

---

## SDK Guides

| Guide | Description |
|---|---|
| [Create a prompt and fetch production](sdk/create-prompt-and-fetch-production.md) | Fetch, version, promote, and roll back prompts |
| [Create a flow](sdk/create-a-flow.md) | Define single-step and multi-step flows |
| [Use a flow in code](sdk/use-a-flow-in-code.md) | Execute flows and access step-level outputs |
| [Run a flow](sdk/run-a-flow.md) | Run flows and inspect traces for debugging |
| [Run evaluation between two prompts](sdk/run-evaluation-between-two-prompts.md) | LLM-as-judge, batch, and deterministic evaluation |

---

## SDK Resources

| Resource | Methods |
|---|---|
| `client.prompts` | `get`, `list`, `create_version`, `promote`, `rollback` |
| `client.flows` | `get`, `list`, `create`, `update`, `execute`, `validate` |
| `client.evaluations` | `create`, `poll`, `run_and_wait` |
| `client.traces` | `get`, `list` |
| `client.datasets` | `get`, `list`, `create`, `update`, `delete` |

---

## Async and Sync

All SDK methods are async by default. Use `client.run_sync(...)` for synchronous code.

```python
# Async
result = await client.prompts.get("my_prompt")

# Sync
result = client.run_sync(client.prompts.get("my_prompt"))
```
