"""Flows API endpoints."""

from fastapi import APIRouter, HTTPException, status, Query
from datetime import datetime
import json

from app.models.schemas import (
    Flow,
    FlowCreate,
    FlowUpdate,
    FlowDefinition,
    FlowExecuteRequest,
    FlowExecuteResponse,
    Message,
)
from app.models.entities import FlowEntity
from app.storage.table_client import get_table_storage_client

router = APIRouter()


def _entity_to_flow(entity: dict) -> Flow:
    """Convert Table Storage entity to Flow schema."""
    definition_dict = {}
    if "definition" in entity and entity["definition"]:
        try:
            definition_dict = json.loads(entity["definition"])
        except json.JSONDecodeError:
            definition_dict = {}

    definition = FlowDefinition(**definition_dict) if definition_dict else FlowDefinition()

    return Flow(
        flow_id=entity["RowKey"],
        project_id=entity["PartitionKey"],
        name=entity["name"],
        description=entity.get("description", ""),
        definition=definition,
        created_by=entity["created_by"],
        created_at=entity["created_at"],
        updated_at=entity["updated_at"],
    )


@router.get("/", response_model=list[Flow])
async def list_flows(project_id: str = Query(..., description="Project ID to filter flows")):
    """List all flows in a project.

    Args:
        project_id: Project ID to filter by

    Returns:
        List of flows in the project
    """
    table_client = get_table_storage_client()
    entities = table_client.list_entities_by_partition(table_name="flows", partition_key=project_id)
    return [_entity_to_flow(entity) for entity in entities]


@router.post("/", response_model=Flow, status_code=status.HTTP_201_CREATED)
async def create_flow(flow: FlowCreate, project_id: str = Query(..., description="Project ID")):
    """Create a new flow in a project.

    Args:
        flow: Flow creation data
        project_id: Project ID to create flow in

    Returns:
        Created flow with ID and timestamps
    """
    table_client = get_table_storage_client()

    created_by = "mock-user-id"

    definition_json = flow.definition.model_dump_json()

    entity = FlowEntity(
        project_id=project_id,
        name=flow.name,
        description=flow.description,
        definition=definition_json,
        created_by=created_by,
    )

    table_client.insert_entity(table_name="flows", entity=entity)

    return _entity_to_flow(entity)


@router.get("/{flow_id}", response_model=Flow)
async def get_flow(flow_id: str, project_id: str = Query(..., description="Project ID")):
    """Get a flow by ID.

    Args:
        flow_id: Flow ID
        project_id: Project ID

    Returns:
        Flow details

    Raises:
        HTTPException: If flow not found
    """
    table_client = get_table_storage_client()
    entity = table_client.get_entity(table_name="flows", partition_key=project_id, row_key=flow_id)

    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    return _entity_to_flow(entity)


@router.put("/{flow_id}", response_model=Flow)
async def update_flow(
    flow_id: str,
    flow_update: FlowUpdate,
    project_id: str = Query(..., description="Project ID"),
):
    """Update a flow.

    Args:
        flow_id: Flow ID
        flow_update: Fields to update
        project_id: Project ID

    Returns:
        Updated flow

    Raises:
        HTTPException: If flow not found
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(table_name="flows", partition_key=project_id, row_key=flow_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    if flow_update.name is not None:
        entity["name"] = flow_update.name
    if flow_update.description is not None:
        entity["description"] = flow_update.description
    if flow_update.definition is not None:
        entity["definition"] = flow_update.definition.model_dump_json()
    entity["updated_at"] = datetime.utcnow()

    table_client.update_entity(table_name="flows", entity=entity)

    return _entity_to_flow(entity)


@router.delete("/{flow_id}", response_model=Message)
async def delete_flow(flow_id: str, project_id: str = Query(..., description="Project ID")):
    """Delete a flow.

    Args:
        flow_id: Flow ID
        project_id: Project ID

    Returns:
        Success message

    Raises:
        HTTPException: If flow not found
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(table_name="flows", partition_key=project_id, row_key=flow_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    table_client.delete_entity(table_name="flows", partition_key=project_id, row_key=flow_id)

    return Message(message=f"Flow {flow_id} deleted successfully")


@router.post("/{flow_id}/execute", response_model=FlowExecuteResponse)
async def execute_flow(
    flow_id: str,
    request: FlowExecuteRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Execute a flow with given inputs.

    Args:
        flow_id: Flow ID to execute
        request: Execution request with inputs
        project_id: Project ID

    Returns:
        Flow execution results

    Raises:
        HTTPException: If flow not found or execution fails
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(table_name="flows", partition_key=project_id, row_key=flow_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")

    flow = _entity_to_flow(entity)

    from app.services.flow_executor import FlowExecutor

    executor = FlowExecutor(project_id=project_id, model_config=request.model_config_override)
    try:
        result = await executor.execute(flow=flow, inputs=request.inputs)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Flow execution failed: {str(e)}",
        )
