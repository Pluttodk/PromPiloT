"""Projects API endpoints."""

from fastapi import APIRouter, HTTPException, status
from datetime import datetime
import json

from app.models.schemas import Project, ProjectCreate, ProjectUpdate, Message
from app.models.entities import ProjectEntity
from app.storage.table_client import get_table_storage_client

router = APIRouter()


def _entity_to_project(entity: dict) -> Project:
    """Convert Table Storage entity to Project schema."""
    return Project(
        project_id=entity["RowKey"],
        name=entity["name"],
        description=entity.get("description", ""),
        created_by=entity["created_by"],
        created_at=entity["created_at"],
        updated_at=entity["updated_at"],
    )


@router.get("/", response_model=list[Project])
async def list_projects():
    """List all projects.

    Returns:
        List of all projects
    """
    table_client = get_table_storage_client()
    entities = table_client.query_entities(table_name="projects", filter_query="PartitionKey eq 'PROJECT'")
    return [_entity_to_project(entity) for entity in entities]


@router.post("/", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate):
    """Create a new project.

    Args:
        project: Project creation data

    Returns:
        Created project with ID and timestamps
    """
    table_client = get_table_storage_client()

    # TODO: Get actual user ID from authentication
    created_by = "mock-user-id"

    # Create entity
    entity = ProjectEntity(
        name=project.name,
        description=project.description,
        created_by=created_by,
    )

    # Insert into table
    table_client.insert_entity(table_name="projects", entity=entity)

    return _entity_to_project(entity)


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    """Get a project by ID.

    Args:
        project_id: Project ID

    Returns:
        Project details

    Raises:
        HTTPException: If project not found
    """
    table_client = get_table_storage_client()
    entity = table_client.get_entity(table_name="projects", partition_key="PROJECT", row_key=project_id)

    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return _entity_to_project(entity)


@router.put("/{project_id}", response_model=Project)
async def update_project(project_id: str, project_update: ProjectUpdate):
    """Update a project.

    Args:
        project_id: Project ID
        project_update: Fields to update

    Returns:
        Updated project

    Raises:
        HTTPException: If project not found
    """
    table_client = get_table_storage_client()

    # Get existing entity
    entity = table_client.get_entity(table_name="projects", partition_key="PROJECT", row_key=project_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Update fields
    if project_update.name is not None:
        entity["name"] = project_update.name
    if project_update.description is not None:
        entity["description"] = project_update.description
    entity["updated_at"] = datetime.utcnow()

    # Update in table
    table_client.update_entity(table_name="projects", entity=entity)

    return _entity_to_project(entity)


@router.delete("/{project_id}", response_model=Message)
async def delete_project(project_id: str):
    """Delete a project.

    Args:
        project_id: Project ID

    Returns:
        Success message

    Raises:
        HTTPException: If project not found
    """
    table_client = get_table_storage_client()

    # Check if project exists
    entity = table_client.get_entity(table_name="projects", partition_key="PROJECT", row_key=project_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Delete project
    table_client.delete_entity(table_name="projects", partition_key="PROJECT", row_key=project_id)

    return Message(message=f"Project {project_id} deleted successfully")
