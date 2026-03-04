"""LLM-as-judge evaluation service.

Uses a configured LLM to automatically score trace outputs against given criteria.
"""

import json
import re
from datetime import datetime
from typing import Any

from app.core.llm_client import LLMClient
from app.models.entities import ScoreEntity
from app.models.schemas import ModelConfigResponse, ScoreResponse
from app.storage.table_client import get_table_storage_client

JUDGE_SYSTEM_PROMPT = """You are an expert AI evaluator. Your task is to evaluate an AI response \
against the given criteria and provide a score with reasoning.

You MUST respond ONLY with valid JSON in exactly this format:
- For numeric scoring: {{"score": <float 0.0-5.0>, "reasoning": "<explanation>"}}
- For boolean scoring: {{"score": <true or false>, "reasoning": "<explanation>"}}
- For categorical scoring: {{"score": "<pass or fail>", "reasoning": "<explanation>"}}

Do not include any text outside the JSON object."""

JUDGE_USER_TEMPLATE = """INPUT:
{inputs_json}

AI RESPONSE:
{outputs_json}

CRITERIA:
{criteria}"""

JUDGE_USER_TEMPLATE_WITH_EXPECTED = """INPUT:
{inputs_json}

AI RESPONSE:
{outputs_json}

EXPECTED OUTPUT:
{expected_output}

CRITERIA:
{criteria}"""


class LLMJudgeService:
    """Service for running LLM-as-judge evaluation on traces."""

    def __init__(self, project_id: str):
        """Initialize the judge service.

        Args:
            project_id: Project ID for storage operations
        """
        self.project_id = project_id
        self.table_client = get_table_storage_client()

    def _get_model_config(self, model_config_id: str) -> ModelConfigResponse | None:
        """Fetch a model configuration entity from storage.

        Args:
            model_config_id: Model config ID to fetch

        Returns:
            ModelConfigResponse if found, else None
        """
        entity = self.table_client.get_entity(
            table_name="modelconfigs",
            partition_key=self.project_id,
            row_key=model_config_id,
        )

        if entity is None:
            return None

        return ModelConfigResponse(
            model_config_id=entity["RowKey"],
            project_id=entity["PartitionKey"],
            name=entity.get("name", ""),
            provider=entity.get("provider", "azure_openai"),
            endpoint=entity.get("endpoint", ""),
            deployment_name=entity.get("deployment_name", ""),
            api_version=entity.get("api_version", "2024-02-01"),
            auth_method=entity.get("auth_method", "default_credential"),
            created_by=entity.get("created_by", ""),
            created_at=entity["created_at"],
            updated_at=entity["updated_at"],
        )

    def _parse_judge_response(
        self,
        response_text: str,
        score_type: str,
    ) -> tuple[float | None, bool | None, str | None, str]:
        """Parse LLM judge response JSON, with regex fallback.

        Args:
            response_text: Raw LLM response text
            score_type: Expected score type (numeric, boolean, categorical)

        Returns:
            Tuple of (value_numeric, value_boolean, value_label, reasoning)
        """
        json_text = response_text.strip()

        json_match = re.search(r"\{.*\}", json_text, re.DOTALL)
        if json_match:
            json_text = json_match.group(0)

        try:
            parsed: dict[str, Any] = json.loads(json_text)
        except json.JSONDecodeError:
            return None, None, None, f"Failed to parse judge response: {response_text}"

        reasoning: str = str(parsed.get("reasoning", ""))
        raw_score = parsed.get("score")

        value_numeric: float | None = None
        value_boolean: bool | None = None
        value_label: str | None = None

        if score_type == "numeric":
            try:
                value_numeric = float(raw_score)
            except (TypeError, ValueError):
                value_numeric = None
        elif score_type == "boolean":
            if isinstance(raw_score, bool):
                value_boolean = raw_score
            elif isinstance(raw_score, str):
                value_boolean = raw_score.lower() in ("true", "yes", "1")
            else:
                value_boolean = bool(raw_score)
        else:
            value_label = str(raw_score) if raw_score is not None else None

        return value_numeric, value_boolean, value_label, reasoning

    async def score_trace(
        self,
        trace_id: str,
        criteria: str,
        score_name: str = "llm_judge",
        score_type: str = "numeric",
        model_config_id: str | None = None,
        scorer_id: str = "llm",
        expected_output: str | None = None,
    ) -> tuple[ScoreResponse, str]:
        """Run LLM-as-judge on a trace and persist the score.

        Args:
            trace_id: Trace ID to evaluate
            criteria: Evaluation criteria/rubric
            score_name: Name for the score dimension
            score_type: Score type (numeric, boolean, categorical)
            model_config_id: Optional model config ID to use
            scorer_id: Identifier for the scorer
            expected_output: Optional expected output for direct comparison

        Returns:
            Tuple of (ScoreResponse, reasoning string)

        Raises:
            ValueError: If trace not found or model config missing
        """
        trace_entity = self.table_client.get_entity(
            table_name="traces",
            partition_key=self.project_id,
            row_key=trace_id,
        )

        if trace_entity is None:
            raise ValueError(f"Trace {trace_id} not found")

        inputs_str = trace_entity.get("inputs", "{}")
        outputs_str = trace_entity.get("outputs", "{}")

        try:
            inputs_json = json.dumps(json.loads(inputs_str), indent=2)
        except json.JSONDecodeError:
            inputs_json = inputs_str

        try:
            outputs_json = json.dumps(json.loads(outputs_str), indent=2)
        except json.JSONDecodeError:
            outputs_json = outputs_str

        stored_config: ModelConfigResponse | None = None
        if model_config_id:
            stored_config = self._get_model_config(model_config_id)

        llm_client = LLMClient(stored_model_config=stored_config)

        if expected_output is not None:
            user_content = JUDGE_USER_TEMPLATE_WITH_EXPECTED.format(
                inputs_json=inputs_json,
                outputs_json=outputs_json,
                expected_output=expected_output,
                criteria=criteria,
            )
        else:
            user_content = JUDGE_USER_TEMPLATE.format(
                inputs_json=inputs_json,
                outputs_json=outputs_json,
                criteria=criteria,
            )

        response = await llm_client.complete(
            messages=[
                {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.0,
        )

        value_numeric, value_boolean, value_label, reasoning = self._parse_judge_response(
            response.content, score_type
        )

        score_entity = ScoreEntity(
            project_id=self.project_id,
            trace_id=trace_id,
            name=score_name,
            score_type=score_type,
            value_numeric=value_numeric,
            value_boolean=value_boolean,
            value_label=value_label,
            scorer_type="llm",
            scorer_id=scorer_id,
            comment=reasoning[:1000] if reasoning else None,
            created_at=datetime.utcnow(),
        )

        self.table_client.insert_entity(table_name="scores", entity=score_entity)

        score_response = ScoreResponse(
            score_id=score_entity["RowKey"],
            project_id=self.project_id,
            trace_id=trace_id,
            name=score_name,
            score_type=score_type,
            value_numeric=value_numeric,
            value_boolean=value_boolean,
            value_label=value_label,
            scorer_type="llm",
            scorer_id=scorer_id,
            comment=score_entity["comment"],
            created_at=score_entity["created_at"],
        )

        return score_response, reasoning
