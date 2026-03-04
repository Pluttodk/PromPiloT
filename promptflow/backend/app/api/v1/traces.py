"""Trace API endpoints."""

import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Query
from typing import Optional

from app.models.schemas import (
    TraceResponse,
    TraceListResponse,
    TraceNodeResult,
    Message,
)
from app.storage.table_client import get_table_storage_client

router = APIRouter()


def _entity_to_trace_list(entity: dict, score_count: int = 0) -> TraceListResponse:
    """Convert Table Storage entity to TraceListResponse schema."""
    return TraceListResponse(
        trace_id=entity["RowKey"],
        project_id=entity["PartitionKey"],
        flow_id=entity.get("flow_id", ""),
        flow_name=entity.get("flow_name", ""),
        status=entity.get("status", "unknown"),
        total_tokens=entity.get("total_tokens"),
        execution_time_ms=entity.get("execution_time_ms"),
        error_message=entity.get("error_message"),
        created_at=entity["created_at"],
        eval_run_id=entity.get("eval_run_id"),
        score_count=score_count,
    )


def _entity_to_trace(entity: dict) -> TraceResponse:
    """Convert Table Storage entity to TraceResponse schema."""
    inputs_str = entity.get("inputs", "{}")
    outputs_str = entity.get("outputs", "{}")
    node_traces_str = entity.get("node_traces", "[]")

    try:
        inputs = json.loads(inputs_str)
    except json.JSONDecodeError:
        inputs = {}

    try:
        outputs = json.loads(outputs_str) if outputs_str else None
    except json.JSONDecodeError:
        outputs = None

    try:
        node_traces_raw = json.loads(node_traces_str)
        node_traces = [TraceNodeResult(**nt) for nt in node_traces_raw]
    except (json.JSONDecodeError, TypeError):
        node_traces = []

    return TraceResponse(
        trace_id=entity["RowKey"],
        project_id=entity["PartitionKey"],
        flow_id=entity.get("flow_id", ""),
        flow_name=entity.get("flow_name", ""),
        status=entity.get("status", "unknown"),
        inputs=inputs,
        outputs=outputs,
        node_traces=node_traces,
        total_tokens=entity.get("total_tokens"),
        execution_time_ms=entity.get("execution_time_ms", 0),
        error_message=entity.get("error_message"),
        created_at=entity["created_at"],
        eval_run_id=entity.get("eval_run_id"),
    )


@router.get("/", response_model=list[TraceListResponse])
async def list_traces(
    project_id: str = Query(..., description="Project ID to filter traces"),
    flow_id: Optional[str] = Query(None, description="Optional flow ID to filter"),
    eval_run_id: Optional[str] = Query(None, description="Optional eval run ID to filter"),
    date_from: Optional[datetime] = Query(None, description="Filter traces created after this datetime (ISO 8601)"),
    date_to: Optional[datetime] = Query(None, description="Filter traces created before this datetime (ISO 8601)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum traces to return"),
):
    """List traces in a project.

    Args:
        project_id: Project ID to filter by
        flow_id: Optional flow ID to filter by
        eval_run_id: Optional eval run ID to filter by
        date_from: Optional start datetime to filter by created_at
        date_to: Optional end datetime to filter by created_at
        limit: Maximum number of traces to return

    Returns:
        List of traces in the project
    """
    table_client = get_table_storage_client()
    entities = table_client.list_entities_by_partition(
        table_name="traces", partition_key=project_id
    )

    score_entities = table_client.list_entities_by_partition(
        table_name="scores", partition_key=project_id
    )
    score_counts: dict[str, int] = {}
    for score_entity in score_entities:
        tid = score_entity.get("trace_id", "")
        if tid:
            score_counts[tid] = score_counts.get(tid, 0) + 1

    traces = []
    for entity in entities:
        if flow_id and entity.get("flow_id") != flow_id:
            continue
        if eval_run_id is not None:
            entity_eval_run_id = entity.get("eval_run_id")
            if eval_run_id == "" and entity_eval_run_id is not None:
                continue
            elif eval_run_id != "" and entity_eval_run_id != eval_run_id:
                continue
        if date_from or date_to:
            try:
                raw = entity["created_at"]
                if isinstance(raw, datetime):
                    created_at = raw.replace(tzinfo=None)
                else:
                    created_at = datetime.fromisoformat(
                        str(raw).replace("Z", "+00:00")
                    ).replace(tzinfo=None)
                if date_from and created_at < date_from.replace(tzinfo=None):
                    continue
                if date_to and created_at > date_to.replace(tzinfo=None):
                    continue
            except (ValueError, KeyError, TypeError):
                pass
        trace_id = entity["RowKey"]
        traces.append(_entity_to_trace_list(entity, score_count=score_counts.get(trace_id, 0)))
        if len(traces) >= limit:
            break

    traces.sort(key=lambda t: t.created_at, reverse=True)

    return traces


@router.get("/{trace_id}", response_model=TraceResponse)
async def get_trace(
    trace_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Get a trace by ID.

    Args:
        trace_id: Trace ID
        project_id: Project ID

    Returns:
        Trace details

    Raises:
        HTTPException: If trace not found
    """
    table_client = get_table_storage_client()
    entity = table_client.get_entity(
        table_name="traces", partition_key=project_id, row_key=trace_id
    )

    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found"
        )

    return _entity_to_trace(entity)


@router.delete("/{trace_id}", response_model=Message)
async def delete_trace(
    trace_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Delete a trace.

    Args:
        trace_id: Trace ID
        project_id: Project ID

    Returns:
        Success message

    Raises:
        HTTPException: If trace not found
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(
        table_name="traces", partition_key=project_id, row_key=trace_id
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found"
        )

    table_client.delete_entity(
        table_name="traces", partition_key=project_id, row_key=trace_id
    )

    return Message(message=f"Trace {trace_id} deleted successfully")
