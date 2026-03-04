"""Evaluation runner service.

Orchestrates batch evaluation runs: iterates over dataset items, executes each
through a flow, optionally auto-scores with LLM judge, and persists results.
"""

import json
import logging
import time
from datetime import datetime
from typing import Any

from app.models.entities import EvalResultEntity, ScoreEntity
from app.models.schemas import Flow, FlowDefinition
from app.services.flow_executor import FlowExecutor
from app.services.llm_judge import LLMJudgeService
from app.storage.table_client import get_table_storage_client

logger = logging.getLogger(__name__)


class EvalRunner:
    """Orchestrates batch evaluation runs against a dataset."""

    def __init__(self, project_id: str):
        """Initialize the eval runner.

        Args:
            project_id: Project ID for storage operations
        """
        self.project_id = project_id
        self.table_client = get_table_storage_client()

    def _load_flow(self, flow_id: str) -> Flow | None:
        """Load a flow entity from storage and deserialise its definition.

        Args:
            flow_id: Flow ID to load

        Returns:
            Flow schema instance or None if not found
        """
        entity = self.table_client.get_entity(
            table_name="flows",
            partition_key=self.project_id,
            row_key=flow_id,
        )

        if entity is None:
            return None

        definition_str = entity.get("definition", "{}")
        try:
            definition_dict: dict[str, Any] = json.loads(definition_str)
        except json.JSONDecodeError:
            definition_dict = {}

        definition = FlowDefinition(**definition_dict) if definition_dict else FlowDefinition()

        return Flow(
            flow_id=entity["RowKey"],
            project_id=entity["PartitionKey"],
            name=entity.get("name", ""),
            description=entity.get("description", ""),
            definition=definition,
            created_by=entity.get("created_by", ""),
            created_at=entity["created_at"],
            updated_at=entity["updated_at"],
        )

    def _load_dataset_items(self, dataset_id: str) -> list[dict[str, Any]]:
        """Load all items for a dataset.

        Args:
            dataset_id: Dataset ID to load items for

        Returns:
            List of raw item entities
        """
        partition_key = f"{self.project_id}~{dataset_id}"
        entities = self.table_client.list_entities_by_partition(
            table_name="datasetitems",
            partition_key=partition_key,
        )
        return list(entities)

    def _update_run_counters(
        self,
        run_id: str,
        completed_items: int,
        failed_items: int,
        status: str | None = None,
        error_message: str | None = None,
        completed_at: datetime | None = None,
    ) -> None:
        """Update counter fields on an eval run entity.

        Args:
            run_id: Run ID to update
            completed_items: Number of successfully completed items
            failed_items: Number of failed items
            status: Optional new status
            error_message: Optional error message
            completed_at: Optional completion timestamp
        """
        entity = self.table_client.get_entity(
            table_name="evalruns",
            partition_key=self.project_id,
            row_key=run_id,
        )
        if entity is None:
            return

        entity["completed_items"] = completed_items
        entity["failed_items"] = failed_items

        if status is not None:
            entity["status"] = status
        if error_message is not None:
            entity["error_message"] = error_message
        if completed_at is not None:
            entity["completed_at"] = completed_at

        self.table_client.update_entity(table_name="evalruns", entity=entity)

    async def run(self, run_id: str) -> None:
        """Execute all items in an eval run.

        Fetches the run entity, loads its dataset and flow, executes each item,
        optionally auto-scores with LLM judge, and updates run status throughout.

        Args:
            run_id: Eval run ID to execute
        """
        run_entity = self.table_client.get_entity(
            table_name="evalruns",
            partition_key=self.project_id,
            row_key=run_id,
        )

        if run_entity is None:
            logger.error("Eval run %s not found", run_id)
            return

        run_entity["status"] = "running"
        self.table_client.update_entity(table_name="evalruns", entity=run_entity)

        dataset_id: str = run_entity.get("dataset_id", "")
        flow_id: str = run_entity.get("flow_id", "")
        auto_score: bool = bool(run_entity.get("auto_score", False))
        judge_criteria: str | None = run_entity.get("judge_criteria")
        judge_model_config_id: str | None = run_entity.get("judge_model_config_id")
        item_limit: int | None = run_entity.get("item_limit")

        try:
            flow = self._load_flow(flow_id)
            if flow is None:
                raise ValueError(f"Flow {flow_id} not found")

            all_items = self._load_dataset_items(dataset_id)
            items = all_items[:item_limit] if item_limit is not None else all_items

            run_entity["total_items"] = len(items)
            self.table_client.update_entity(table_name="evalruns", entity=run_entity)

            completed = 0
            failed = 0

            for item_entity in items:
                item_id: str = item_entity["RowKey"]
                item_start = time.time()

                input_text: str = item_entity.get("input", "")
                expected_output: str | None = item_entity.get("expected_output")

                inputs: dict[str, Any] = {
                    node.id: input_text
                    for node in flow.definition.nodes
                    if node.type == "input"
                }

                trace_id: str | None = None
                actual_output_str: str | None = None
                score_numeric: float | None = None
                score_label: str | None = None
                judge_reasoning: str | None = None
                item_error: str | None = None
                item_status = "completed"

                try:
                    executor = FlowExecutor(project_id=self.project_id)
                    execute_response = await executor.execute(
                        flow=flow,
                        inputs=inputs,
                        eval_run_id=run_id,
                    )

                    trace_id = execute_response.trace_id
                    actual_output_str = json.dumps(execute_response.outputs)

                    if expected_output and trace_id:
                        actual_values = list(execute_response.outputs.values())
                        actual_text = (
                            str(actual_values[0])
                            if len(actual_values) == 1
                            else actual_output_str or ""
                        )
                        is_match = actual_text.strip().lower() == expected_output.strip().lower()
                        exact_match_entity = ScoreEntity(
                            project_id=self.project_id,
                            trace_id=trace_id,
                            name="exact_match",
                            score_type="boolean",
                            value_boolean=is_match,
                            scorer_type="deterministic",
                            scorer_id="system",
                            created_at=datetime.utcnow(),
                        )
                        self.table_client.insert_entity(
                            table_name="scores", entity=exact_match_entity
                        )

                    if auto_score and judge_criteria and trace_id:
                        judge = LLMJudgeService(project_id=self.project_id)
                        try:
                            score_resp, reasoning = await judge.score_trace(
                                trace_id=trace_id,
                                criteria=judge_criteria,
                                model_config_id=judge_model_config_id,
                                expected_output=expected_output,
                            )
                            score_numeric = score_resp.value_numeric
                            score_label = score_resp.value_label
                            judge_reasoning = reasoning
                        except Exception as judge_err:
                            logger.warning(
                                "LLM judge failed for item %s: %s", item_id, judge_err
                            )

                    completed += 1

                except Exception as item_err:
                    item_error = str(item_err)
                    item_status = "failed"
                    failed += 1
                    logger.warning("Eval item %s failed: %s", item_id, item_err)

                execution_time_ms = int((time.time() - item_start) * 1000)

                result_entity = EvalResultEntity(
                    project_id=self.project_id,
                    run_id=run_id,
                    item_id=item_id,
                    trace_id=trace_id,
                    status=item_status,
                    actual_output=actual_output_str,
                    expected_output=expected_output,
                    score_numeric=score_numeric,
                    score_label=score_label,
                    judge_reasoning=judge_reasoning[:2000] if judge_reasoning else None,
                    error_message=item_error,
                    execution_time_ms=execution_time_ms,
                    created_at=datetime.utcnow(),
                )
                self.table_client.insert_entity(
                    table_name="evalresults", entity=result_entity
                )

                self._update_run_counters(
                    run_id=run_id,
                    completed_items=completed,
                    failed_items=failed,
                )

            self._update_run_counters(
                run_id=run_id,
                completed_items=completed,
                failed_items=failed,
                status="completed",
                completed_at=datetime.utcnow(),
            )

        except Exception as run_err:
            logger.error("Eval run %s failed: %s", run_id, run_err)
            self._update_run_counters(
                run_id=run_id,
                completed_items=0,
                failed_items=0,
                status="failed",
                error_message=str(run_err),
            )
