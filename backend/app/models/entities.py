"""Table Storage entity models.

These classes represent entities stored in Azure Table Storage.
Each entity has PartitionKey and RowKey for partitioning and uniqueness.
"""

from datetime import datetime
from typing import Any
from uuid import uuid4


class TableEntity(dict):
    """Base class for Table Storage entities.

    Table entities are stored as dictionaries with special PartitionKey and RowKey fields.
    """

    def __init__(self, **kwargs: Any):
        """Initialize entity with partition and row keys."""
        super().__init__(**kwargs)
        if "PartitionKey" not in self:
            self["PartitionKey"] = ""
        if "RowKey" not in self:
            self["RowKey"] = str(uuid4())
        if "Timestamp" not in self:
            self["Timestamp"] = datetime.utcnow()


class ProjectEntity(TableEntity):
    """Project entity stored in Table Storage.

    PartitionKey: "PROJECT" (all projects in same partition)
    RowKey: {project_id} (UUID)
    """

    def __init__(
        self,
        project_id: str | None = None,
        name: str = "",
        description: str = "",
        created_by: str = "",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize project entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = "PROJECT"
        self["RowKey"] = project_id or str(uuid4())
        self["name"] = name
        self["description"] = description
        self["created_by"] = created_by
        self["created_at"] = created_at or datetime.utcnow()
        self["updated_at"] = updated_at or datetime.utcnow()

    @property
    def project_id(self) -> str:
        """Get project ID from RowKey."""
        return self["RowKey"]


class PromptEntity(TableEntity):
    """Prompt entity stored in Table Storage.

    PartitionKey: {project_id} (partition by project)
    RowKey: {prompt_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        prompt_id: str | None = None,
        name: str = "",
        description: str = "",
        template: str = "",
        llm_config: str = "{}",  # JSON string
        created_by: str = "",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
        production_version: int | None = None,
        latest_version: int = 0,
        **kwargs: Any,
    ):
        """Initialize prompt entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = project_id
        self["RowKey"] = prompt_id or str(uuid4())
        self["name"] = name
        self["description"] = description
        self["template"] = template
        self["llm_config"] = llm_config
        self["created_by"] = created_by
        self["created_at"] = created_at or datetime.utcnow()
        self["updated_at"] = updated_at or datetime.utcnow()
        self["production_version"] = production_version
        self["latest_version"] = latest_version

    @property
    def prompt_id(self) -> str:
        """Get prompt ID from RowKey."""
        return self["RowKey"]

    @property
    def project_id(self) -> str:
        """Get project ID from PartitionKey."""
        return self["PartitionKey"]


class PromptVersionEntity(TableEntity):
    """Prompt version snapshot stored in Table Storage.

    PartitionKey: {project_id}~{prompt_id} (enables listing per prompt)
    RowKey: {version_number:04d} (e.g. "0001") — sortable
    """

    def __init__(
        self,
        project_id: str = "",
        prompt_id: str = "",
        version_number: int = 1,
        template: str = "",
        tags: str = "[]",  # JSON array of tag strings
        created_by: str = "",
        created_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize prompt version entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = f"{project_id}~{prompt_id}"
        self["RowKey"] = f"{version_number:04d}"
        self["prompt_id"] = prompt_id
        self["version_number"] = version_number
        self["template"] = template
        self["tags"] = tags
        self["created_by"] = created_by
        self["created_at"] = created_at or datetime.utcnow()

    @property
    def prompt_id(self) -> str:
        """Get prompt ID from stored field."""
        return self["prompt_id"]

    @property
    def version_number(self) -> int:
        """Get version number from stored field."""
        return self["version_number"]


class UserEntity(TableEntity):
    """User entity stored in Table Storage.

    PartitionKey: "USER" (all users in same partition)
    RowKey: {azure_ad_id} (Azure AD object ID)
    """

    def __init__(
        self,
        azure_ad_id: str = "",
        email: str = "",
        name: str = "",
        roles: str = "[]",  # JSON string
        last_login: datetime | None = None,
        created_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize user entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = "USER"
        self["RowKey"] = azure_ad_id
        self["email"] = email
        self["name"] = name
        self["roles"] = roles
        self["last_login"] = last_login or datetime.utcnow()
        self["created_at"] = created_at or datetime.utcnow()

    @property
    def azure_ad_id(self) -> str:
        """Get Azure AD ID from RowKey."""
        return self["RowKey"]


class FlowEntity(TableEntity):
    """Flow entity stored in Table Storage.

    PartitionKey: {project_id} (partition by project)
    RowKey: {flow_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        flow_id: str | None = None,
        name: str = "",
        description: str = "",
        definition: str = "{}",
        created_by: str = "",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize flow entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = project_id
        self["RowKey"] = flow_id or str(uuid4())
        self["name"] = name
        self["description"] = description
        self["definition"] = definition
        self["created_by"] = created_by
        self["created_at"] = created_at or datetime.utcnow()
        self["updated_at"] = updated_at or datetime.utcnow()

    @property
    def flow_id(self) -> str:
        """Get flow ID from RowKey."""
        return self["RowKey"]

    @property
    def project_id(self) -> str:
        """Get project ID from PartitionKey."""
        return self["PartitionKey"]


class ModelConfigEntity(TableEntity):
    """Model configuration entity stored in Table Storage.

    PartitionKey: {project_id} (partition by project)
    RowKey: {model_config_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        model_config_id: str | None = None,
        name: str = "",
        provider: str = "azure_openai",
        endpoint: str = "",
        deployment_name: str = "",
        api_version: str = "2024-02-01",
        auth_method: str = "default_credential",
        created_by: str = "",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize model config entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = project_id
        self["RowKey"] = model_config_id or str(uuid4())
        self["name"] = name
        self["provider"] = provider
        self["endpoint"] = endpoint
        self["deployment_name"] = deployment_name
        self["api_version"] = api_version
        self["auth_method"] = auth_method
        self["created_by"] = created_by
        self["created_at"] = created_at or datetime.utcnow()
        self["updated_at"] = updated_at or datetime.utcnow()

    @property
    def model_config_id(self) -> str:
        """Get model config ID from RowKey."""
        return self["RowKey"]

    @property
    def project_id(self) -> str:
        """Get project ID from PartitionKey."""
        return self["PartitionKey"]


class TraceEntity(TableEntity):
    """Trace entity stored in Table Storage.

    PartitionKey: {project_id} (partition by project)
    RowKey: {trace_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        trace_id: str | None = None,
        flow_id: str = "",
        flow_name: str = "",
        status: str = "running",
        inputs: str = "{}",
        outputs: str = "{}",
        node_traces: str = "[]",
        total_tokens: int | None = None,
        execution_time_ms: int | None = None,
        error_message: str | None = None,
        created_at: datetime | None = None,
        eval_run_id: str | None = None,
        **kwargs: Any,
    ):
        """Initialize trace entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = project_id
        self["RowKey"] = trace_id or str(uuid4())
        self["flow_id"] = flow_id
        self["flow_name"] = flow_name
        self["status"] = status
        self["inputs"] = inputs
        self["outputs"] = outputs
        self["node_traces"] = node_traces
        self["total_tokens"] = total_tokens
        self["execution_time_ms"] = execution_time_ms
        self["error_message"] = error_message
        self["created_at"] = created_at or datetime.utcnow()
        self["eval_run_id"] = eval_run_id

    @property
    def trace_id(self) -> str:
        """Get trace ID from RowKey."""
        return self["RowKey"]

    @property
    def project_id(self) -> str:
        """Get project ID from PartitionKey."""
        return self["PartitionKey"]


class ScoreEntity(TableEntity):
    """Score entity stored in Table Storage.

    PartitionKey: {project_id}
    RowKey: {score_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        score_id: str | None = None,
        trace_id: str = "",
        name: str = "",
        score_type: str = "numeric",
        value_numeric: float | None = None,
        value_boolean: bool | None = None,
        value_label: str | None = None,
        scorer_type: str = "human",
        scorer_id: str = "",
        comment: str | None = None,
        created_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize score entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = project_id
        self["RowKey"] = score_id or str(uuid4())
        self["trace_id"] = trace_id
        self["name"] = name
        self["score_type"] = score_type
        self["value_numeric"] = value_numeric
        self["value_boolean"] = value_boolean
        self["value_label"] = value_label
        self["scorer_type"] = scorer_type
        self["scorer_id"] = scorer_id
        self["comment"] = comment
        self["created_at"] = created_at or datetime.utcnow()

    @property
    def score_id(self) -> str:
        """Get score ID from RowKey."""
        return self["RowKey"]


class DatasetEntity(TableEntity):
    """Dataset entity stored in Table Storage.

    PartitionKey: {project_id}
    RowKey: {dataset_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        dataset_id: str | None = None,
        name: str = "",
        description: str = "",
        item_count: int = 0,
        created_by: str = "",
        created_at: datetime | None = None,
        updated_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize dataset entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = project_id
        self["RowKey"] = dataset_id or str(uuid4())
        self["name"] = name
        self["description"] = description
        self["item_count"] = item_count
        self["created_by"] = created_by
        self["created_at"] = created_at or datetime.utcnow()
        self["updated_at"] = updated_at or datetime.utcnow()

    @property
    def dataset_id(self) -> str:
        """Get dataset ID from RowKey."""
        return self["RowKey"]


class DatasetItemEntity(TableEntity):
    """Dataset item entity stored in Table Storage.

    PartitionKey: {project_id}~{dataset_id} (composite for efficient per-dataset listing)
    RowKey: {item_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        dataset_id: str = "",
        item_id: str | None = None,
        input: str = "{}",
        expected_output: str | None = None,
        source_trace_id: str | None = None,
        notes: str | None = None,
        created_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize dataset item entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = f"{project_id}~{dataset_id}"
        self["RowKey"] = item_id or str(uuid4())
        self["dataset_id"] = dataset_id
        self["input"] = input
        self["expected_output"] = expected_output
        self["source_trace_id"] = source_trace_id
        self["notes"] = notes
        self["created_at"] = created_at or datetime.utcnow()

    @property
    def item_id(self) -> str:
        """Get item ID from RowKey."""
        return self["RowKey"]


class EvalRunEntity(TableEntity):
    """Evaluation run entity stored in Table Storage.

    PartitionKey: {project_id}
    RowKey: {run_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        run_id: str | None = None,
        name: str = "",
        dataset_id: str = "",
        dataset_name: str = "",
        flow_id: str = "",
        flow_name: str = "",
        status: str = "pending",
        total_items: int = 0,
        completed_items: int = 0,
        failed_items: int = 0,
        auto_score: bool = False,
        judge_criteria: str | None = None,
        judge_model_config_id: str | None = None,
        item_limit: int | None = None,
        error_message: str | None = None,
        created_by: str = "",
        created_at: datetime | None = None,
        completed_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize eval run entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = project_id
        self["RowKey"] = run_id or str(uuid4())
        self["name"] = name
        self["dataset_id"] = dataset_id
        self["dataset_name"] = dataset_name
        self["flow_id"] = flow_id
        self["flow_name"] = flow_name
        self["status"] = status
        self["total_items"] = total_items
        self["completed_items"] = completed_items
        self["failed_items"] = failed_items
        self["auto_score"] = auto_score
        self["judge_criteria"] = judge_criteria
        self["judge_model_config_id"] = judge_model_config_id
        self["item_limit"] = item_limit
        self["error_message"] = error_message
        self["created_by"] = created_by
        self["created_at"] = created_at or datetime.utcnow()
        self["completed_at"] = completed_at

    @property
    def run_id(self) -> str:
        """Get run ID from RowKey."""
        return self["RowKey"]


class EvalResultEntity(TableEntity):
    """Evaluation result entity stored in Table Storage.

    PartitionKey: {project_id}~{run_id} (composite for efficient per-run listing)
    RowKey: {result_id} (UUID)
    """

    def __init__(
        self,
        project_id: str = "",
        run_id: str = "",
        result_id: str | None = None,
        item_id: str = "",
        trace_id: str | None = None,
        status: str = "completed",
        actual_output: str | None = None,
        expected_output: str | None = None,
        score_numeric: float | None = None,
        score_label: str | None = None,
        judge_reasoning: str | None = None,
        error_message: str | None = None,
        execution_time_ms: int | None = None,
        created_at: datetime | None = None,
        **kwargs: Any,
    ):
        """Initialize eval result entity."""
        super().__init__(**kwargs)
        self["PartitionKey"] = f"{project_id}~{run_id}"
        self["RowKey"] = result_id or str(uuid4())
        self["run_id"] = run_id
        self["item_id"] = item_id
        self["trace_id"] = trace_id
        self["status"] = status
        self["actual_output"] = actual_output
        self["expected_output"] = expected_output
        self["score_numeric"] = score_numeric
        self["score_label"] = score_label
        self["judge_reasoning"] = judge_reasoning
        self["error_message"] = error_message
        self["execution_time_ms"] = execution_time_ms
        self["created_at"] = created_at or datetime.utcnow()

    @property
    def result_id(self) -> str:
        """Get result ID from RowKey."""
        return self["RowKey"]
