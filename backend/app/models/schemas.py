"""Pydantic schemas for API request and response validation."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


# Project Schemas
class ProjectBase(BaseModel):
    """Base project schema with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: str = Field(default="", description="Project description")


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""

    pass


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class Project(ProjectBase):
    """Schema for project response."""

    project_id: str = Field(..., description="Unique project identifier")
    created_by: str = Field(..., description="User ID who created the project")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Prompt Schemas
class PromptBase(BaseModel):
    """Base prompt schema with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Prompt name")
    description: str = Field(default="", description="Prompt description")
    template: str = Field(..., description="Jinja2 template for the prompt")
    llm_config: dict[str, Any] = Field(
        default_factory=dict,
        description="LLM configuration (model name, temperature, etc.)",
    )


class PromptCreate(PromptBase):
    """Schema for creating a new prompt."""

    pass


class PromptUpdate(BaseModel):
    """Schema for updating a prompt."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    template: str | None = None
    llm_config: dict[str, Any] | None = None


class Prompt(PromptBase):
    """Schema for prompt response."""

    prompt_id: str = Field(..., description="Unique prompt identifier")
    project_id: str = Field(..., description="Project this prompt belongs to")
    created_by: str = Field(..., description="User ID who created the prompt")
    created_at: datetime
    updated_at: datetime
    production_version: int | None = Field(None, description="Version number set as production")
    latest_version: int = Field(0, description="Monotonic version counter")

    class Config:
        from_attributes = True


class PromptVersion(BaseModel):
    """Schema for a prompt version snapshot response."""

    version_number: int = Field(..., description="Version number (1-based)")
    template: str = Field(..., description="Template captured at this version")
    tags: list[str] = Field(default_factory=list, description="User-defined tags, e.g. ['production', 'staging']")
    created_at: datetime
    created_by: str = Field(..., description="User ID who created this version")

    class Config:
        from_attributes = True


class VersionTagsUpdate(BaseModel):
    """Request schema for updating the tags on a version."""

    tags: list[str] = Field(default_factory=list, description="New complete set of tags for this version")


# User Schemas
class User(BaseModel):
    """Schema for user response."""

    azure_ad_id: str = Field(..., description="Azure AD object ID")
    email: str = Field(..., description="User email address")
    name: str = Field(..., description="User display name")
    roles: list[str] = Field(default_factory=list, description="User roles")
    last_login: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# Generic Response Schemas
class Message(BaseModel):
    """Generic message response."""

    message: str


class ErrorResponse(BaseModel):
    """Error response schema."""

    detail: str


# Flow Schemas
class FlowNodePosition(BaseModel):
    """Position of a node in the flow canvas."""

    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")


class FlowNodeData(BaseModel):
    """Data associated with a flow node."""

    name: str | None = Field(None, description="Visual name for input/output nodes")
    label: str | None = Field(None, description="Display label for the node")
    model_config_id: str | None = Field(None, description="Model config ID for prompt nodes")

    # System prompt configuration
    system_prompt_source: str | None = Field(
        None, description="Source: 'prompt', 'connection', or 'none'"
    )
    system_prompt_id: str | None = Field(
        None, description="Prompt ID if system_prompt_source='prompt'"
    )

    # User input configuration
    user_input_source: str | None = Field(
        None, description="Source: 'prompt', 'connection', or 'none'"
    )
    user_input_prompt_id: str | None = Field(
        None, description="Prompt ID if user_input_source='prompt'"
    )

    # Legacy field - being replaced by system_prompt_id/user_input_prompt_id
    prompt_id: str | None = Field(None, description="Legacy: Prompt ID for prompt nodes")


class FlowNode(BaseModel):
    """A node in the flow graph."""

    id: str = Field(..., description="Unique node identifier")
    type: str = Field(..., description="Node type: input, output, prompt")
    data: FlowNodeData = Field(default_factory=FlowNodeData)
    position: FlowNodePosition = Field(..., description="Node position on canvas")


class FlowEdge(BaseModel):
    """An edge connecting two nodes in the flow."""

    id: str = Field(..., description="Unique edge identifier")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    sourceHandle: str | None = Field(None, description="Source handle ID")
    targetHandle: str | None = Field(None, description="Target handle ID")


class FlowDefinition(BaseModel):
    """Complete flow definition with nodes and edges."""

    nodes: list[FlowNode] = Field(default_factory=list, description="Flow nodes")
    edges: list[FlowEdge] = Field(default_factory=list, description="Flow edges")


class FlowBase(BaseModel):
    """Base flow schema with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Flow name")
    description: str = Field(default="", description="Flow description")


class FlowCreate(FlowBase):
    """Schema for creating a new flow."""

    definition: FlowDefinition = Field(
        default_factory=FlowDefinition,
        description="Flow definition with nodes and edges",
    )


class FlowUpdate(BaseModel):
    """Schema for updating a flow."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    definition: FlowDefinition | None = None


class Flow(FlowBase):
    """Schema for flow response."""

    flow_id: str = Field(..., description="Unique flow identifier")
    project_id: str = Field(..., description="Project this flow belongs to")
    definition: FlowDefinition = Field(..., description="Flow definition")
    created_by: str = Field(..., description="User ID who created the flow")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ModelConfig(BaseModel):
    """Model configuration for Azure OpenAI / Azure AI."""

    endpoint: str | None = Field(None, description="Azure OpenAI endpoint URL")
    model: str | None = Field(None, description="Model or deployment name")
    api_version: str | None = Field(None, description="API version")
    api_key: str | None = Field(None, description="API key")


class FlowExecuteRequest(BaseModel):
    """Request schema for flow execution."""

    inputs: dict[str, Any] = Field(
        default_factory=dict,
        description="Input values for the flow (keyed by input node name)",
    )
    model_config_override: ModelConfig | None = Field(
        None,
        alias="model_config",
        description="Optional model configuration override",
    )


class FlowExecuteResponse(BaseModel):
    """Response schema for flow execution."""

    trace_id: str = Field(..., description="Trace ID for this execution")
    outputs: dict[str, Any] = Field(
        ..., description="Output values from the flow (keyed by output node name)"
    )
    execution_time_ms: int = Field(..., description="Total execution time in milliseconds")
    node_results: dict[str, Any] = Field(
        default_factory=dict,
        description="Results from individual nodes for debugging",
    )


# Model Configuration Schemas (Project-level)
class ModelConfigBase(BaseModel):
    """Base model configuration schema."""

    name: str = Field(..., min_length=1, max_length=255, description="Display name")
    provider: str = Field(
        default="azure_openai",
        description="Provider: azure_openai, openai, anthropic",
    )
    endpoint: str = Field(..., description="API endpoint URL")
    deployment_name: str = Field(..., description="Model or deployment name")
    api_version: str = Field(default="2024-02-01", description="API version")
    auth_method: str = Field(
        default="default_credential",
        description="Authentication method: default_credential or api_key",
    )


class ModelConfigCreate(ModelConfigBase):
    """Schema for creating a new model configuration."""

    pass


class ModelConfigUpdate(BaseModel):
    """Schema for updating a model configuration."""

    name: str | None = Field(None, min_length=1, max_length=255)
    provider: str | None = None
    endpoint: str | None = None
    deployment_name: str | None = None
    api_version: str | None = None
    auth_method: str | None = None


class ModelConfigResponse(ModelConfigBase):
    """Schema for model configuration response."""

    model_config_id: str = Field(..., description="Unique model config identifier")
    project_id: str = Field(..., description="Project this config belongs to")
    created_by: str = Field(..., description="User ID who created the config")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ModelTestRequest(BaseModel):
    """Request schema for testing a model configuration."""

    prompt: str = Field(..., description="The prompt to send to the model")
    system_prompt: str | None = Field(None, description="Optional system prompt")


class ModelTestResponse(BaseModel):
    """Response schema for model test."""

    response: str = Field(..., description="Model response")
    execution_time_ms: int = Field(..., description="Execution time in milliseconds")


# Trace Schemas
class TraceNodeResult(BaseModel):
    """Per-node execution result in a trace."""

    node_id: str = Field(..., description="Node identifier")
    node_type: str = Field(..., description="Node type: input, output, prompt")
    name: str | None = Field(None, description="Node name")
    prompt_id: str | None = Field(None, description="Prompt ID for prompt nodes")
    model_config_id: str | None = Field(None, description="Model config ID for prompt nodes")
    input: dict[str, Any] | None = Field(None, description="Input to this node")
    output: Any | None = Field(None, description="Output from this node")
    tokens_used: int | None = Field(None, description="Tokens used by this node")
    execution_time_ms: int | None = Field(None, description="Node execution time")
    error: str | None = Field(None, description="Error message if node failed")


class TraceResponse(BaseModel):
    """Schema for trace response."""

    trace_id: str = Field(..., description="Unique trace identifier")
    project_id: str = Field(..., description="Project this trace belongs to")
    flow_id: str = Field(..., description="Flow that was executed")
    flow_name: str = Field(..., description="Flow name at execution time")
    status: str = Field(..., description="Trace status: running, completed, failed")
    inputs: dict[str, Any] = Field(..., description="Flow inputs")
    outputs: dict[str, Any] | None = Field(None, description="Flow outputs")
    node_traces: list[TraceNodeResult] = Field(
        default_factory=list, description="Per-node execution results"
    )
    total_tokens: int | None = Field(None, description="Total tokens used")
    execution_time_ms: int = Field(..., description="Total execution time")
    error_message: str | None = Field(None, description="Error message if failed")
    created_at: datetime
    eval_run_id: str | None = Field(None, description="Eval run ID if this trace was created by an eval run")

    class Config:
        from_attributes = True


class TraceListResponse(BaseModel):
    """Schema for trace list item (lighter than full trace)."""

    trace_id: str = Field(..., description="Unique trace identifier")
    project_id: str = Field(..., description="Project this trace belongs to")
    flow_id: str = Field(..., description="Flow that was executed")
    flow_name: str = Field(..., description="Flow name at execution time")
    status: str = Field(..., description="Trace status: running, completed, failed")
    total_tokens: int | None = Field(None, description="Total tokens used")
    execution_time_ms: int | None = Field(None, description="Total execution time")
    error_message: str | None = Field(None, description="Error message if failed")
    created_at: datetime
    eval_run_id: str | None = Field(None, description="Eval run ID if created by an eval run")
    score_count: int = Field(0, description="Number of scores for this trace")

    class Config:
        from_attributes = True


# Evaluation / Score Schemas

class ScoreCreate(BaseModel):
    """Request schema for creating a human score."""

    trace_id: str = Field(..., description="Trace to score")
    name: str = Field(..., min_length=1, max_length=255, description="Score name/dimension")
    score_type: str = Field("numeric", description="Score type: numeric, boolean, categorical")
    value_numeric: float | None = Field(None, description="Numeric value (0-5) for numeric type")
    value_boolean: bool | None = Field(None, description="Boolean value for boolean type")
    value_label: str | None = Field(None, description="Label value for categorical type")
    comment: str | None = Field(None, description="Optional comment/reasoning")


class ScoreResponse(BaseModel):
    """Response schema for a score."""

    score_id: str = Field(..., description="Unique score identifier")
    project_id: str = Field(..., description="Project ID")
    trace_id: str = Field(..., description="Trace ID that was scored")
    name: str = Field(..., description="Score dimension name")
    score_type: str = Field(..., description="Score type: numeric, boolean, categorical")
    value_numeric: float | None = Field(None, description="Numeric value")
    value_boolean: bool | None = Field(None, description="Boolean value")
    value_label: str | None = Field(None, description="Label value")
    scorer_type: str = Field(..., description="Scorer type: human, llm")
    scorer_id: str = Field(..., description="Scorer identifier")
    comment: str | None = Field(None, description="Optional comment")
    created_at: datetime

    class Config:
        from_attributes = True


class LLMJudgeRequest(BaseModel):
    """Request schema for running LLM-as-judge on a trace."""

    trace_id: str = Field(..., description="Trace to judge")
    criteria: str = Field(..., description="Evaluation criteria/rubric")
    score_name: str = Field("llm_judge", description="Name for the resulting score")
    score_type: str = Field("numeric", description="Score type: numeric, boolean, categorical")
    model_config_id: str | None = Field(None, description="Model config to use for judging")
    expected_output: str | None = Field(None, description="Expected output for reference comparison")


class LLMJudgeResponse(BaseModel):
    """Response schema for LLM judge result."""

    score: ScoreResponse = Field(..., description="Created score entity")
    reasoning: str = Field(..., description="Judge reasoning/explanation")


# Dataset Schemas

class DatasetCreate(BaseModel):
    """Request schema for creating a dataset."""

    name: str = Field(..., min_length=1, max_length=255, description="Dataset name")
    description: str = Field(default="", description="Dataset description")


class DatasetResponse(BaseModel):
    """Response schema for a dataset."""

    dataset_id: str = Field(..., description="Unique dataset identifier")
    project_id: str = Field(..., description="Project ID")
    name: str = Field(..., description="Dataset name")
    description: str = Field(..., description="Dataset description")
    item_count: int = Field(..., description="Number of items in the dataset")
    created_by: str = Field(..., description="Creator user ID")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DatasetItemCreate(BaseModel):
    """Request schema for adding an item to a dataset manually."""

    input: str = Field(..., description="Plain text input for the flow's input node(s)")
    expected_output: str | None = Field(None, description="Expected output string")
    notes: str | None = Field(None, description="Optional notes")


class DatasetItemFromTrace(BaseModel):
    """Request schema for importing a trace as a dataset item."""

    trace_id: str = Field(..., description="Source trace ID to import inputs from")
    expected_output: str | None = Field(None, description="Expected output string")
    notes: str | None = Field(None, description="Optional notes")


class DatasetItemResponse(BaseModel):
    """Response schema for a dataset item."""

    item_id: str = Field(..., description="Unique item identifier")
    dataset_id: str = Field(..., description="Dataset this item belongs to")
    input: str = Field(..., description="Plain text input for the flow's input node(s)")
    expected_output: str | None = Field(None, description="Expected output")
    source_trace_id: str | None = Field(None, description="Source trace if imported")
    notes: str | None = Field(None, description="Optional notes")
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetCsvUploadResponse(BaseModel):
    """Response schema for a CSV bulk-import operation."""

    created: int = Field(..., description="Number of items successfully created")
    skipped: int = Field(0, description="Number of rows skipped (empty input)")
    truncated: int = Field(0, description="Number of items whose input was truncated to 32K characters")


# Eval Run Schemas

class EvalRunCreate(BaseModel):
    """Request schema for creating an evaluation run."""

    name: str = Field(..., min_length=1, max_length=255, description="Run name")
    dataset_id: str = Field(..., description="Dataset to evaluate against")
    flow_id: str = Field(..., description="Flow to evaluate")
    auto_score: bool = Field(False, description="Whether to auto-score with LLM judge")
    judge_criteria: str | None = Field(None, description="LLM judge criteria (required if auto_score=True)")
    judge_model_config_id: str | None = Field(None, description="Model config for judging")
    item_limit: int | None = Field(None, ge=1, description="Max number of dataset items to run (None = all)")


class EvalRunResponse(BaseModel):
    """Response schema for an evaluation run."""

    run_id: str = Field(..., description="Unique run identifier")
    project_id: str = Field(..., description="Project ID")
    name: str = Field(..., description="Run name")
    dataset_id: str = Field(..., description="Dataset ID")
    dataset_name: str = Field(..., description="Dataset name at run time")
    flow_id: str = Field(..., description="Flow ID")
    flow_name: str = Field(..., description="Flow name at run time")
    status: str = Field(..., description="Status: pending, running, completed, failed")
    total_items: int = Field(..., description="Total items to process")
    completed_items: int = Field(..., description="Successfully completed items")
    failed_items: int = Field(..., description="Failed items")
    auto_score: bool = Field(..., description="Whether auto-scoring is enabled")
    judge_criteria: str | None = Field(None, description="Judge criteria")
    judge_model_config_id: str | None = Field(None, description="Judge model config ID")
    item_limit: int | None = Field(None, description="Max items to run (None = all)")
    error_message: str | None = Field(None, description="Error if run failed")
    created_by: str = Field(..., description="Creator user ID")
    created_at: datetime
    completed_at: datetime | None = Field(None, description="Completion timestamp")

    class Config:
        from_attributes = True


class EvalResultResponse(BaseModel):
    """Response schema for a single eval result (per dataset item)."""

    result_id: str = Field(..., description="Unique result identifier")
    run_id: str = Field(..., description="Run this result belongs to")
    item_id: str = Field(..., description="Dataset item ID")
    trace_id: str | None = Field(None, description="Trace ID from execution")
    status: str = Field(..., description="Status: completed, failed")
    actual_output: dict[str, Any] | None = Field(None, description="Actual flow outputs")
    expected_output: str | None = Field(None, description="Expected output")
    score_numeric: float | None = Field(None, description="Numeric judge score")
    score_label: str | None = Field(None, description="Categorical judge score")
    judge_reasoning: str | None = Field(None, description="Judge reasoning")
    error_message: str | None = Field(None, description="Error if item failed")
    execution_time_ms: int | None = Field(None, description="Execution time")
    created_at: datetime

    class Config:
        from_attributes = True
