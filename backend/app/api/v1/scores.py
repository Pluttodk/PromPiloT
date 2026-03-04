"""Scores API endpoints — human scoring and LLM-as-judge."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, status

from app.models.schemas import (
    LLMJudgeRequest,
    LLMJudgeResponse,
    Message,
    ScoreCreate,
    ScoreResponse,
)
from app.models.entities import ScoreEntity
from app.services.llm_judge import LLMJudgeService
from app.storage.table_client import get_table_storage_client

router = APIRouter()


def _entity_to_score(entity: dict) -> ScoreResponse:
    """Convert Table Storage entity to ScoreResponse schema."""
    return ScoreResponse(
        score_id=entity["RowKey"],
        project_id=entity["PartitionKey"],
        trace_id=entity.get("trace_id", ""),
        name=entity.get("name", ""),
        score_type=entity.get("score_type", "numeric"),
        value_numeric=entity.get("value_numeric"),
        value_boolean=entity.get("value_boolean"),
        value_label=entity.get("value_label"),
        scorer_type=entity.get("scorer_type", "human"),
        scorer_id=entity.get("scorer_id", ""),
        comment=entity.get("comment"),
        created_at=entity["created_at"],
    )


@router.post("/", response_model=ScoreResponse, status_code=status.HTTP_201_CREATED)
async def create_score(
    body: ScoreCreate,
    project_id: str = Query(..., description="Project ID"),
):
    """Create a human score on a trace.

    Args:
        body: Score creation request
        project_id: Project ID

    Returns:
        Created score entity
    """
    table_client = get_table_storage_client()

    trace_entity = table_client.get_entity(
        table_name="traces",
        partition_key=project_id,
        row_key=body.trace_id,
    )
    if trace_entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trace {body.trace_id} not found",
        )

    score_entity = ScoreEntity(
        project_id=project_id,
        trace_id=body.trace_id,
        name=body.name,
        score_type=body.score_type,
        value_numeric=body.value_numeric,
        value_boolean=body.value_boolean,
        value_label=body.value_label,
        scorer_type="human",
        scorer_id="user",
        comment=body.comment,
        created_at=datetime.utcnow(),
    )

    table_client.insert_entity(table_name="scores", entity=score_entity)

    return _entity_to_score(score_entity)


@router.get("/", response_model=list[ScoreResponse])
async def list_scores(
    project_id: str = Query(..., description="Project ID"),
    trace_id: str = Query(..., description="Trace ID to list scores for"),
):
    """List all scores for a given trace.

    Args:
        project_id: Project ID
        trace_id: Trace ID to filter by

    Returns:
        List of scores for the trace
    """
    table_client = get_table_storage_client()

    entities = table_client.list_entities_by_partition(
        table_name="scores",
        partition_key=project_id,
    )

    scores = [
        _entity_to_score(e)
        for e in entities
        if e.get("trace_id") == trace_id
    ]

    scores.sort(key=lambda s: s.created_at, reverse=True)
    return scores


@router.delete("/{score_id}", response_model=Message)
async def delete_score(
    score_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Delete a score.

    Args:
        score_id: Score ID to delete
        project_id: Project ID

    Returns:
        Success message

    Raises:
        HTTPException: If score not found
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(
        table_name="scores",
        partition_key=project_id,
        row_key=score_id,
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Score not found",
        )

    table_client.delete_entity(
        table_name="scores",
        partition_key=project_id,
        row_key=score_id,
    )

    return Message(message=f"Score {score_id} deleted successfully")


@router.post("/llm-judge", response_model=LLMJudgeResponse)
async def run_llm_judge(
    body: LLMJudgeRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Run LLM-as-judge on a trace and create a score.

    Args:
        body: LLM judge request with trace_id, criteria, and score config
        project_id: Project ID

    Returns:
        Created score and judge reasoning

    Raises:
        HTTPException: If trace not found or judging fails
    """
    judge_service = LLMJudgeService(project_id=project_id)

    try:
        score_response, reasoning = await judge_service.score_trace(
            trace_id=body.trace_id,
            criteria=body.criteria,
            score_name=body.score_name,
            score_type=body.score_type,
            model_config_id=body.model_config_id,
            expected_output=body.expected_output,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM judge failed: {exc}",
        ) from exc

    return LLMJudgeResponse(score=score_response, reasoning=reasoning)
