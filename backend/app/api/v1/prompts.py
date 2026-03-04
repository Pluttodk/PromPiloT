"""Prompts API endpoints."""

from fastapi import APIRouter, HTTPException, status, Query
from datetime import datetime
import json

from app.models.schemas import Prompt, PromptCreate, PromptUpdate, PromptVersion, VersionTagsUpdate, Message
from app.models.entities import PromptEntity, PromptVersionEntity
from app.storage.table_client import get_table_storage_client

router = APIRouter()


def _entity_to_prompt(entity: dict) -> Prompt:
    """Convert Table Storage entity to Prompt schema."""
    llm_config = {}
    if "llm_config" in entity and entity["llm_config"]:
        try:
            llm_config = json.loads(entity["llm_config"])
        except json.JSONDecodeError:
            llm_config = {}

    return Prompt(
        prompt_id=entity["RowKey"],
        project_id=entity["PartitionKey"],
        name=entity["name"],
        description=entity.get("description", ""),
        template=entity["template"],
        llm_config=llm_config,
        created_by=entity["created_by"],
        created_at=entity["created_at"],
        updated_at=entity["updated_at"],
        production_version=entity.get("production_version"),
        latest_version=entity.get("latest_version", 0),
    )


def _entity_to_version(entity: dict) -> PromptVersion:
    """Convert Table Storage entity to PromptVersion schema."""
    tags: list[str] = []
    raw = entity.get("tags", "[]")
    if raw:
        try:
            tags = json.loads(raw)
        except json.JSONDecodeError:
            tags = []

    return PromptVersion(
        version_number=entity["version_number"],
        template=entity["template"],
        tags=tags,
        created_at=entity["created_at"],
        created_by=entity["created_by"],
    )


@router.get("/", response_model=list[Prompt])
async def list_prompts(project_id: str = Query(..., description="Project ID to filter prompts")):
    """List all prompts in a project.

    Args:
        project_id: Project ID to filter by

    Returns:
        List of prompts in the project
    """
    table_client = get_table_storage_client()
    entities = table_client.list_entities_by_partition(table_name="prompts", partition_key=project_id)
    return [_entity_to_prompt(entity) for entity in entities]


@router.post("/", response_model=Prompt, status_code=status.HTTP_201_CREATED)
async def create_prompt(prompt: PromptCreate, project_id: str = Query(..., description="Project ID")):
    """Create a new prompt in a project.

    Args:
        prompt: Prompt creation data
        project_id: Project ID to create prompt in

    Returns:
        Created prompt with ID and timestamps
    """
    table_client = get_table_storage_client()

    # TODO: Verify project exists and user has access

    # TODO: Get actual user ID from authentication
    created_by = "mock-user-id"

    # Serialize LLM config to JSON
    llm_config_json = json.dumps(prompt.llm_config)

    # Create entity
    entity = PromptEntity(
        project_id=project_id,
        name=prompt.name,
        description=prompt.description,
        template=prompt.template,
        llm_config=llm_config_json,
        created_by=created_by,
    )

    # Insert into table
    table_client.insert_entity(table_name="prompts", entity=entity)

    return _entity_to_prompt(entity)


@router.get("/{prompt_id}", response_model=Prompt)
async def get_prompt(prompt_id: str, project_id: str = Query(..., description="Project ID")):
    """Get a prompt by ID.

    Args:
        prompt_id: Prompt ID
        project_id: Project ID

    Returns:
        Prompt details

    Raises:
        HTTPException: If prompt not found
    """
    table_client = get_table_storage_client()
    entity = table_client.get_entity(table_name="prompts", partition_key=project_id, row_key=prompt_id)

    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    return _entity_to_prompt(entity)


@router.put("/{prompt_id}", response_model=Prompt)
async def update_prompt(
    prompt_id: str,
    prompt_update: PromptUpdate,
    project_id: str = Query(..., description="Project ID"),
):
    """Update a prompt.

    Args:
        prompt_id: Prompt ID
        prompt_update: Fields to update
        project_id: Project ID

    Returns:
        Updated prompt

    Raises:
        HTTPException: If prompt not found
    """
    table_client = get_table_storage_client()

    # Get existing entity
    entity = table_client.get_entity(table_name="prompts", partition_key=project_id, row_key=prompt_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    # Update fields
    if prompt_update.name is not None:
        entity["name"] = prompt_update.name
    if prompt_update.description is not None:
        entity["description"] = prompt_update.description
    if prompt_update.template is not None:
        entity["template"] = prompt_update.template
    if prompt_update.llm_config is not None:
        entity["llm_config"] = json.dumps(prompt_update.llm_config)
    entity["updated_at"] = datetime.utcnow()

    # Update in table
    table_client.update_entity(table_name="prompts", entity=entity)

    return _entity_to_prompt(entity)


@router.delete("/{prompt_id}", response_model=Message)
async def delete_prompt(prompt_id: str, project_id: str = Query(..., description="Project ID")):
    """Delete a prompt.

    Args:
        prompt_id: Prompt ID
        project_id: Project ID

    Returns:
        Success message

    Raises:
        HTTPException: If prompt not found
    """
    table_client = get_table_storage_client()

    # Check if prompt exists
    entity = table_client.get_entity(table_name="prompts", partition_key=project_id, row_key=prompt_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    # Delete prompt
    table_client.delete_entity(table_name="prompts", partition_key=project_id, row_key=prompt_id)

    return Message(message=f"Prompt {prompt_id} deleted successfully")


@router.get("/{prompt_id}/versions", response_model=list[PromptVersion])
async def list_prompt_versions(
    prompt_id: str,
    project_id: str = Query(..., description="Project ID"),
) -> list[PromptVersion]:
    """List all versions for a prompt, newest first.

    Args:
        prompt_id: Prompt ID
        project_id: Project ID

    Returns:
        List of prompt versions sorted descending by version number
    """
    table_client = get_table_storage_client()
    partition_key = f"{project_id}~{prompt_id}"
    entities = table_client.list_entities_by_partition(
        table_name="promptversions", partition_key=partition_key
    )
    versions = [_entity_to_version(e) for e in entities]
    versions.sort(key=lambda v: v.version_number, reverse=True)
    return versions


@router.post("/{prompt_id}/versions", response_model=PromptVersion, status_code=status.HTTP_201_CREATED)
async def create_prompt_version(
    prompt_id: str,
    project_id: str = Query(..., description="Project ID"),
) -> PromptVersion:
    """Create a new version snapshot from the prompt's current draft template.

    Args:
        prompt_id: Prompt ID
        project_id: Project ID

    Returns:
        Created version

    Raises:
        HTTPException: If prompt not found
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(table_name="prompts", partition_key=project_id, row_key=prompt_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    new_version_number = entity.get("latest_version", 0) + 1
    created_by = entity.get("created_by", "mock-user-id")

    version_entity = PromptVersionEntity(
        project_id=project_id,
        prompt_id=prompt_id,
        version_number=new_version_number,
        template=entity["template"],
        tags="[]",
        created_by=created_by,
    )
    table_client.insert_entity(table_name="promptversions", entity=version_entity)

    entity["latest_version"] = new_version_number
    entity["updated_at"] = datetime.utcnow()
    table_client.update_entity(table_name="prompts", entity=entity)

    return _entity_to_version(version_entity)


@router.put("/{prompt_id}/versions/{version_number}/tags", response_model=Prompt)
async def set_version_tags(
    prompt_id: str,
    version_number: int,
    body: VersionTagsUpdate,
    project_id: str = Query(..., description="Project ID"),
) -> Prompt:
    """Set the complete tag list on a version.

    The 'production' tag is exclusive: adding it removes it from every other version
    for this prompt and updates production_version on the prompt header. Removing it
    resets production_version to null.

    Args:
        prompt_id: Prompt ID
        version_number: Version number to tag
        body: New tag list
        project_id: Project ID

    Returns:
        Updated prompt header

    Raises:
        HTTPException: If prompt or version not found
    """
    table_client = get_table_storage_client()

    prompt_entity = table_client.get_entity(
        table_name="prompts", partition_key=project_id, row_key=prompt_id
    )
    if prompt_entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    row_key = f"{version_number:04d}"
    partition_key = f"{project_id}~{prompt_id}"
    target_entity = table_client.get_entity(
        table_name="promptversions", partition_key=partition_key, row_key=row_key
    )
    if target_entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    new_tags = [t.strip().lower() for t in body.tags if t.strip()]

    old_tags: list[str] = []
    try:
        old_tags = json.loads(target_entity.get("tags", "[]") or "[]")
    except json.JSONDecodeError:
        old_tags = []

    production_added = "production" in new_tags and "production" not in old_tags
    production_removed = "production" not in new_tags and "production" in old_tags

    if production_added:
        all_versions = table_client.list_entities_by_partition(
            table_name="promptversions", partition_key=partition_key
        )
        for v in all_versions:
            if v["RowKey"] == row_key:
                continue
            try:
                other_tags: list[str] = json.loads(v.get("tags", "[]") or "[]")
            except json.JSONDecodeError:
                other_tags = []
            if "production" in other_tags:
                other_tags.remove("production")
                v["tags"] = json.dumps(other_tags)
                table_client.update_entity(table_name="promptversions", entity=v)

        prompt_entity["production_version"] = version_number
        prompt_entity["updated_at"] = datetime.utcnow()
        table_client.update_entity(table_name="prompts", entity=prompt_entity)

    elif production_removed:
        prompt_entity["production_version"] = None
        prompt_entity["updated_at"] = datetime.utcnow()
        table_client.update_entity(table_name="prompts", entity=prompt_entity)

    target_entity["tags"] = json.dumps(new_tags)
    table_client.update_entity(table_name="promptversions", entity=target_entity)

    return _entity_to_prompt(prompt_entity)
