# Run evaluation between two prompts

Evaluation lets you measure the quality difference between two prompt versions before promoting one to production. Prom-Pilot supports three evaluation modes: LLM-as-judge, batch evaluation against a dataset, and deterministic metrics.

```python
from prom_pilot import PromPilotClient

client = PromPilotClient("localhost:8000")
```

## Use LLM as judge

An LLM-as-judge evaluation runs both prompt versions on the same inputs and asks a separate judge LLM to score and compare the outputs.

**Async**

```python
import asyncio
from prom_pilot import PromPilotClient, EvaluationResult

client = PromPilotClient("localhost:8000")


async def main() -> None:
    evaluation: EvaluationResult = await client.evaluations.run_and_wait(
        prompt_name="emoji_system_prompt",
        version_a="v1",
        version_b="v2",
        dataset="emoji_test_set",
        judge="llm",
        judge_criteria="Which response uses more accurate and expressive emojis?",
    )

    print(evaluation.winner)
    # "v2"

    print(evaluation.scores)
    # {"v1": 0.61, "v2": 0.84}

    for sample in evaluation.samples:
        print(sample.input, sample.output_a, sample.output_b, sample.judge_verdict)


asyncio.run(main())
```

**Sync**

```python
from prom_pilot import EvaluationResult

evaluation: EvaluationResult = client.run_sync(
    client.evaluations.run_and_wait(
        prompt_name="emoji_system_prompt",
        version_a="v1",
        version_b="v2",
        dataset="emoji_test_set",
        judge="llm",
        judge_criteria="Which response uses more accurate and expressive emojis?",
    )
)
print(evaluation.winner)
```

If you want to start the evaluation and poll later:

```python
from prom_pilot import EvaluationJob, EvaluationResult

async def main() -> None:
    job: EvaluationJob = await client.evaluations.create(
        prompt_name="emoji_system_prompt",
        version_a="v1",
        version_b="v2",
        dataset="emoji_test_set",
        judge="llm",
        judge_criteria="Which response uses more accurate and expressive emojis?",
    )

    result: EvaluationResult = await client.evaluations.poll(job.id)
    print(result.winner)
```

## Schedule a batch evaluation

A batch evaluation runs a prompt version against an entire dataset and collects outputs for later review or comparison. This is useful for regression testing before promoting a version.

**Async**

```python
from prom_pilot import EvaluationResult

async def main() -> None:
    evaluation: EvaluationResult = await client.evaluations.run_and_wait(
        prompt_name="emoji_system_prompt",
        version_a="production",
        version_b="v3",
        dataset="emoji_test_set",
        judge="llm",
        schedule="nightly",
    )
    print(f"Batch complete — winner: {evaluation.winner}")
```

**Sync**

```python
evaluation: EvaluationResult = client.run_sync(
    client.evaluations.run_and_wait(
        prompt_name="emoji_system_prompt",
        version_a="production",
        version_b="v3",
        dataset="emoji_test_set",
        judge="llm",
        schedule="nightly",
    )
)
```

Scheduled evaluations also appear in the Prom-Pilot UI under the **Evaluations** tab for the project.

## Deterministic evaluation

> **Planned — not yet available.** Deterministic scoring modes (Levenshtein distance,
> NLTK BLEU/token-overlap, and multi-judge combining) are on the roadmap and not yet
> implemented. Currently only **LLM-as-judge** scoring is supported via the
> `auto_score=True` flag on evaluation runs.
