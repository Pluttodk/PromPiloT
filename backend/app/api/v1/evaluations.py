"""Evaluations API endpoints — create and manage evaluation runs."""

import json
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from typing import Any

from app.models.schemas import (
    EvalResultResponse,
    EvalRunCreate,
    EvalRunResponse,
    Message,
)
from app.models.entities import EvalRunEntity
from app.services.eval_runner import EvalRunner
from app.storage.table_client import get_table_storage_client

router = APIRouter()


def _entity_to_run(entity: dict) -> EvalRunResponse:
    """Convert Table Storage entity to EvalRunResponse schema."""
    return EvalRunResponse(
        run_id=entity["RowKey"],
        project_id=entity["PartitionKey"],
        name=entity.get("name", ""),
        dataset_id=entity.get("dataset_id", ""),
        dataset_name=entity.get("dataset_name", ""),
        flow_id=entity.get("flow_id", ""),
        flow_name=entity.get("flow_name", ""),
        status=entity.get("status", "pending"),
        total_items=entity.get("total_items", 0),
        completed_items=entity.get("completed_items", 0),
        failed_items=entity.get("failed_items", 0),
        auto_score=bool(entity.get("auto_score", False)),
        judge_criteria=entity.get("judge_criteria"),
        judge_model_config_id=entity.get("judge_model_config_id"),
        item_limit=entity.get("item_limit"),
        error_message=entity.get("error_message"),
        created_by=entity.get("created_by", ""),
        created_at=entity["created_at"],
        completed_at=entity.get("completed_at"),
    )


def _entity_to_result(entity: dict) -> EvalResultResponse:
    """Convert Table Storage entity to EvalResultResponse schema."""
    actual_output_str = entity.get("actual_output")
    actual_output: dict[str, Any] | None = None
    if actual_output_str:
        try:
            actual_output = json.loads(actual_output_str)
        except json.JSONDecodeError:
            actual_output = {"raw": actual_output_str}

    return EvalResultResponse(
        result_id=entity["RowKey"],
        run_id=entity.get("run_id", ""),
        item_id=entity.get("item_id", ""),
        trace_id=entity.get("trace_id"),
        status=entity.get("status", "completed"),
        actual_output=actual_output,
        expected_output=entity.get("expected_output"),
        score_numeric=entity.get("score_numeric"),
        score_label=entity.get("score_label"),
        judge_reasoning=entity.get("judge_reasoning"),
        error_message=entity.get("error_message"),
        execution_time_ms=entity.get("execution_time_ms"),
        created_at=entity["created_at"],
    )


async def _run_evaluation_background(project_id: str, run_id: str) -> None:
    """Background task that executes an eval run.

    Args:
        project_id: Project ID
        run_id: Run ID to execute
    """
    runner = EvalRunner(project_id=project_id)
    await runner.run(run_id=run_id)


@router.post(
    "/",
    response_model=EvalRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_eval_run(
    body: EvalRunCreate,
    background_tasks: BackgroundTasks,
    project_id: str = Query(..., description="Project ID"),
):
    """Create and start an evaluation run.

    The run executes asynchronously via FastAPI BackgroundTasks.
    Poll GET /evaluations/{run_id} for status updates.

    Args:
        body: Eval run creation request
        background_tasks: FastAPI background tasks handler
        project_id: Project ID

    Returns:
        Created eval run (status=pending, will transition to running)

    Raises:
        HTTPException: If dataset or flow not found, or auto_score=True but no criteria
    """
    table_client = get_table_storage_client()

    dataset_entity = table_client.get_entity(
        table_name="datasets",
        partition_key=project_id,
        row_key=body.dataset_id,
    )
    if dataset_entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {body.dataset_id} not found",
        )

    flow_entity = table_client.get_entity(
        table_name="flows",
        partition_key=project_id,
        row_key=body.flow_id,
    )
    if flow_entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flow {body.flow_id} not found",
        )

    if body.auto_score and not body.judge_criteria:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="judge_criteria is required when auto_score=True",
        )

    dataset_item_count = int(dataset_entity.get("item_count", 0))
    effective_total = (
        min(body.item_limit, dataset_item_count)
        if body.item_limit is not None
        else dataset_item_count
    )

    run_entity = EvalRunEntity(
        project_id=project_id,
        name=body.name,
        dataset_id=body.dataset_id,
        dataset_name=dataset_entity.get("name", ""),
        flow_id=body.flow_id,
        flow_name=flow_entity.get("name", ""),
        status="pending",
        total_items=effective_total,
        auto_score=body.auto_score,
        judge_criteria=body.judge_criteria,
        judge_model_config_id=body.judge_model_config_id,
        item_limit=body.item_limit,
        created_by="user",
        created_at=datetime.utcnow(),
    )

    table_client.insert_entity(table_name="evalruns", entity=run_entity)

    run_id = run_entity["RowKey"]
    background_tasks.add_task(_run_evaluation_background, project_id, run_id)

    return _entity_to_run(run_entity)


@router.get("/", response_model=list[EvalRunResponse])
async def list_eval_runs(
    project_id: str = Query(..., description="Project ID"),
    dataset_id: str | None = Query(None, description="Optional dataset ID filter"),
):
    """List evaluation runs in a project.

    Args:
        project_id: Project ID
        dataset_id: Optional dataset ID to filter by

    Returns:
        List of evaluation runs
    """
    table_client = get_table_storage_client()
    entities = table_client.list_entities_by_partition(
        table_name="evalruns",
        partition_key=project_id,
    )

    runs = []
    for entity in entities:
        if dataset_id and entity.get("dataset_id") != dataset_id:
            continue
        runs.append(_entity_to_run(entity))

    runs.sort(key=lambda r: r.created_at, reverse=True)
    return runs


@router.get("/{run_id}", response_model=EvalRunResponse)
async def get_eval_run(
    run_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Get an evaluation run by ID.

    Args:
        run_id: Run ID
        project_id: Project ID

    Returns:
        Eval run details

    Raises:
        HTTPException: If run not found
    """
    table_client = get_table_storage_client()
    entity = table_client.get_entity(
        table_name="evalruns",
        partition_key=project_id,
        row_key=run_id,
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Eval run not found",
        )
    return _entity_to_run(entity)


@router.get("/{run_id}/results", response_model=list[EvalResultResponse])
async def list_eval_results(
    run_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """List per-item results for an evaluation run.

    Args:
        run_id: Run ID
        project_id: Project ID

    Returns:
        List of per-item evaluation results
    """
    table_client = get_table_storage_client()
    partition_key = f"{project_id}~{run_id}"
    entities = table_client.list_entities_by_partition(
        table_name="evalresults",
        partition_key=partition_key,
    )

    results = [_entity_to_result(e) for e in entities]
    results.sort(key=lambda r: r.created_at)
    return results
