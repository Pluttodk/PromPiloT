"""Pydantic response models matching the Prom-Pilot backend API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class FlowExecuteResponse(BaseModel):
    """Response returned after executing a flow.

    Attributes:
        trace_id: ID of the trace record created for this execution.
        outputs: Mapping of output node names to their values.
        execution_time_ms: Wall-clock time the execution took in milliseconds.
        status: Execution status (``success`` or ``failed``).
        error_message: Present only when ``status == "failed"``.
    """

    trace_id: str
    outputs: dict[str, Any]
    execution_time_ms: int
    status: str
    error_message: str | None = None


class FlowResponse(BaseModel):
    """Summary of a flow resource.

    Attributes:
        flow_id: Unique flow identifier.
        project_id: Project this flow belongs to.
        name: Display name of the flow.
        description: Optional description.
        created_by: User ID of the creator.
        created_at: Creation timestamp.
        updated_at: Last-modified timestamp.
    """

    flow_id: str
    project_id: str
    name: str
    description: str = ""
    created_by: str = ""
    created_at: datetime
    updated_at: datetime


class DatasetResponse(BaseModel):
    """Summary of a dataset resource.

    Attributes:
        dataset_id: Unique dataset identifier.
        project_id: Project this dataset belongs to.
        name: Display name.
        description: Optional description.
        item_count: Number of items currently in the dataset.
        created_by: User ID of the creator.
        created_at: Creation timestamp.
        updated_at: Last-modified timestamp.
    """

    dataset_id: str
    project_id: str
    name: str
    description: str = ""
    item_count: int = 0
    created_by: str = ""
    created_at: datetime
    updated_at: datetime


class DatasetItemResponse(BaseModel):
    """A single item within a dataset.

    Attributes:
        item_id: Unique item identifier.
        dataset_id: Parent dataset identifier.
        input: Input text for this test case.
        expected_output: Optional expected output for evaluation.
        source_trace_id: Trace from which this item was imported, if any.
        notes: Free-text notes.
        created_at: Creation timestamp.
    """

    item_id: str
    dataset_id: str
    input: str
    expected_output: str | None = None
    source_trace_id: str | None = None
    notes: str | None = None
    created_at: datetime


class EvalRunResponse(BaseModel):
    """Status and summary of an evaluation run.

    Attributes:
        run_id: Unique run identifier.
        project_id: Project this run belongs to.
        name: Display name for the run.
        dataset_id: Dataset used for the run.
        dataset_name: Resolved name of the dataset.
        flow_id: Flow under evaluation.
        flow_name: Resolved name of the flow.
        status: One of ``pending``, ``running``, ``completed``, ``failed``.
        total_items: Total items scheduled for evaluation.
        completed_items: Items that finished successfully.
        failed_items: Items that encountered errors.
        auto_score: Whether LLM-as-judge scoring was enabled.
        judge_criteria: Criteria string given to the LLM judge.
        judge_model_config_id: Model config used for judging.
        item_limit: Cap on the number of items evaluated.
        error_message: Top-level error when the whole run fails.
        created_by: User ID of the creator.
        created_at: Creation timestamp.
        completed_at: Completion timestamp when run is done.
    """

    run_id: str
    project_id: str
    name: str
    dataset_id: str
    dataset_name: str = ""
    flow_id: str
    flow_name: str = ""
    status: str
    total_items: int = 0
    completed_items: int = 0
    failed_items: int = 0
    auto_score: bool = False
    judge_criteria: str | None = None
    judge_model_config_id: str | None = None
    item_limit: int | None = None
    error_message: str | None = None
    created_by: str = ""
    created_at: datetime
    completed_at: datetime | None = None


class EvalResultResponse(BaseModel):
    """Per-item result from an evaluation run.

    Attributes:
        result_id: Unique result identifier.
        run_id: Parent evaluation run ID.
        item_id: Dataset item ID that was evaluated.
        trace_id: Trace generated for this item, if available.
        status: ``completed`` or ``failed``.
        actual_output: Raw output produced by the flow.
        expected_output: Expected output from the dataset item.
        score_numeric: Numeric score assigned by the judge (0–1 range typical).
        score_label: Categorical label from the judge.
        judge_reasoning: Free-text explanation from the LLM judge.
        error_message: Error detail when status is ``failed``.
        execution_time_ms: Time taken to execute this single item.
        created_at: Timestamp when the result was recorded.
    """

    result_id: str
    run_id: str
    item_id: str
    trace_id: str | None = None
    status: str
    actual_output: dict[str, Any] | None = None
    expected_output: str | None = None
    score_numeric: float | None = None
    score_label: str | None = None
    judge_reasoning: str | None = None
    error_message: str | None = None
    execution_time_ms: int | None = None
    created_at: datetime


class TraceResponse(BaseModel):
    """Full detail of a single trace.

    Attributes:
        trace_id: Unique trace identifier.
        project_id: Project this trace belongs to.
        flow_id: Flow that produced this trace.
        flow_name: Resolved name of the flow.
        status: ``success`` or ``failed``.
        inputs: Inputs passed to the flow execution.
        outputs: Outputs produced by the flow execution.
        node_traces: Per-node execution records.
        total_tokens: Total tokens consumed across all LLM calls.
        execution_time_ms: Total wall-clock execution time.
        error_message: Error detail when status is ``failed``.
        created_at: Timestamp when the trace was recorded.
        eval_run_id: Evaluation run that triggered this trace, if any.
    """

    trace_id: str
    project_id: str
    flow_id: str
    flow_name: str = ""
    status: str
    inputs: dict[str, Any]
    outputs: dict[str, Any] | None = None
    node_traces: list[dict[str, Any]] = []
    total_tokens: int | None = None
    execution_time_ms: int = 0
    error_message: str | None = None
    created_at: datetime
    eval_run_id: str | None = None


class TraceListItem(BaseModel):
    """Lightweight trace summary for list operations.

    Attributes:
        trace_id: Unique trace identifier.
        project_id: Project this trace belongs to.
        flow_id: Flow that produced this trace.
        flow_name: Resolved name of the flow.
        status: ``success`` or ``failed``.
        total_tokens: Total tokens consumed.
        execution_time_ms: Total wall-clock execution time.
        error_message: Error detail when status is ``failed``.
        created_at: Timestamp when the trace was recorded.
        eval_run_id: Evaluation run that triggered this trace, if any.
        score_count: Number of human scores attached to this trace.
    """

    trace_id: str
    project_id: str
    flow_id: str
    flow_name: str = ""
    status: str
    total_tokens: int | None = None
    execution_time_ms: int | None = None
    error_message: str | None = None
    created_at: datetime
    eval_run_id: str | None = None
    score_count: int = 0
