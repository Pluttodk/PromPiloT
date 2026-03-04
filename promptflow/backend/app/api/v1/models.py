"""Model Configuration API endpoints."""

import time
from fastapi import APIRouter, HTTPException, status, Query
from datetime import datetime

from app.models.schemas import (
    ModelConfigCreate,
    ModelConfigUpdate,
    ModelConfigResponse,
    ModelTestRequest,
    ModelTestResponse,
    Message,
)
from app.models.entities import ModelConfigEntity
from app.storage.table_client import get_table_storage_client
from app.core.llm_client import LLMClient

router = APIRouter()


def _entity_to_model_config(entity: dict) -> ModelConfigResponse:
    """Convert Table Storage entity to ModelConfigResponse schema."""
    return ModelConfigResponse(
        model_config_id=entity["RowKey"],
        project_id=entity["PartitionKey"],
        name=entity["name"],
        provider=entity.get("provider", "azure_openai"),
        endpoint=entity.get("endpoint", ""),
        deployment_name=entity.get("deployment_name", ""),
        api_version=entity.get("api_version", "2024-02-01"),
        auth_method=entity.get("auth_method", "default_credential"),
        created_by=entity.get("created_by", ""),
        created_at=entity["created_at"],
        updated_at=entity["updated_at"],
    )


@router.get("/", response_model=list[ModelConfigResponse])
async def list_modelconfigs(
    project_id: str = Query(..., description="Project ID to filter models"),
):
    """List all model configurations in a project.

    Args:
        project_id: Project ID to filter by

    Returns:
        List of model configurations in the project
    """
    table_client = get_table_storage_client()
    entities = table_client.list_entities_by_partition(
        table_name="modelconfigs", partition_key=project_id
    )
    return [_entity_to_model_config(entity) for entity in entities]


@router.post("/", response_model=ModelConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_model_config(
    model_config: ModelConfigCreate,
    project_id: str = Query(..., description="Project ID"),
):
    """Create a new model configuration in a project.

    Args:
        model_config: Model configuration creation data
        project_id: Project ID to create config in

    Returns:
        Created model configuration with ID and timestamps
    """
    table_client = get_table_storage_client()

    created_by = "mock-user-id"

    entity = ModelConfigEntity(
        project_id=project_id,
        name=model_config.name,
        provider=model_config.provider,
        endpoint=model_config.endpoint,
        deployment_name=model_config.deployment_name,
        api_version=model_config.api_version,
        auth_method=model_config.auth_method,
        created_by=created_by,
    )

    table_client.insert_entity(table_name="modelconfigs", entity=entity)

    return _entity_to_model_config(entity)


@router.get("/{model_config_id}", response_model=ModelConfigResponse)
async def get_model_config(
    model_config_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Get a model configuration by ID.

    Args:
        model_config_id: Model configuration ID
        project_id: Project ID

    Returns:
        Model configuration details

    Raises:
        HTTPException: If model config not found
    """
    table_client = get_table_storage_client()
    entity = table_client.get_entity(
        table_name="modelconfigs", partition_key=project_id, row_key=model_config_id
    )

    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Model config not found"
        )

    return _entity_to_model_config(entity)


@router.put("/{model_config_id}", response_model=ModelConfigResponse)
async def update_model_config(
    model_config_id: str,
    model_config_update: ModelConfigUpdate,
    project_id: str = Query(..., description="Project ID"),
):
    """Update a model configuration.

    Args:
        model_config_id: Model configuration ID
        model_config_update: Fields to update
        project_id: Project ID

    Returns:
        Updated model configuration

    Raises:
        HTTPException: If model config not found
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(
        table_name="modelconfigs", partition_key=project_id, row_key=model_config_id
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Model config not found"
        )

    if model_config_update.name is not None:
        entity["name"] = model_config_update.name
    if model_config_update.provider is not None:
        entity["provider"] = model_config_update.provider
    if model_config_update.endpoint is not None:
        entity["endpoint"] = model_config_update.endpoint
    if model_config_update.deployment_name is not None:
        entity["deployment_name"] = model_config_update.deployment_name
    if model_config_update.api_version is not None:
        entity["api_version"] = model_config_update.api_version
    if model_config_update.auth_method is not None:
        entity["auth_method"] = model_config_update.auth_method
    entity["updated_at"] = datetime.utcnow()

    table_client.update_entity(table_name="modelconfigs", entity=entity)

    return _entity_to_model_config(entity)


@router.delete("/{model_config_id}", response_model=Message)
async def delete_model_config(
    model_config_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Delete a model configuration.

    Args:
        model_config_id: Model configuration ID
        project_id: Project ID

    Returns:
        Success message

    Raises:
        HTTPException: If model config not found
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(
        table_name="modelconfigs", partition_key=project_id, row_key=model_config_id
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Model config not found"
        )

    table_client.delete_entity(
        table_name="modelconfigs", partition_key=project_id, row_key=model_config_id
    )

    return Message(message=f"Model config {model_config_id} deleted successfully")


@router.post("/{model_config_id}/test", response_model=ModelTestResponse)
async def test_model_config(
    model_config_id: str,
    test_request: ModelTestRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Test a model configuration with a prompt.

    Args:
        model_config_id: Model configuration ID
        test_request: Test request with prompt
        project_id: Project ID

    Returns:
        Model response and execution time

    Raises:
        HTTPException: If model config not found or test fails
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(
        table_name="modelconfigs", partition_key=project_id, row_key=model_config_id
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Model config not found"
        )

    model_config = _entity_to_model_config(entity)

    start_time = time.time()

    try:
        llm_client = LLMClient(stored_model_config=model_config)
        llm_response = await llm_client.complete_with_prompt(
            prompt=test_request.prompt,
            system_prompt=test_request.system_prompt,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model test failed: {str(e)}",
        )

    execution_time_ms = int((time.time() - start_time) * 1000)

    return ModelTestResponse(
        response=llm_response.content,
        execution_time_ms=execution_time_ms,
    )
