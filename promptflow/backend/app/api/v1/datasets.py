"""Datasets API endpoints — manage test datasets and items."""

import csv
import io
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, UploadFile, status

from app.models.schemas import (
    DatasetCreate,
    DatasetCsvUploadResponse,
    DatasetItemCreate,
    DatasetItemFromTrace,
    DatasetItemResponse,
    DatasetResponse,
    Message,
)
from app.models.entities import DatasetEntity, DatasetItemEntity
from app.storage.table_client import get_table_storage_client

router = APIRouter()


def _entity_to_dataset(entity: dict) -> DatasetResponse:
    """Convert Table Storage entity to DatasetResponse schema."""
    return DatasetResponse(
        dataset_id=entity["RowKey"],
        project_id=entity["PartitionKey"],
        name=entity.get("name", ""),
        description=entity.get("description", ""),
        item_count=entity.get("item_count", 0),
        created_by=entity.get("created_by", ""),
        created_at=entity["created_at"],
        updated_at=entity["updated_at"],
    )


def _entity_to_item(entity: dict) -> DatasetItemResponse:
    """Convert Table Storage entity to DatasetItemResponse schema."""
    return DatasetItemResponse(
        item_id=entity["RowKey"],
        dataset_id=entity.get("dataset_id", ""),
        input=entity.get("input", ""),
        expected_output=entity.get("expected_output"),
        source_trace_id=entity.get("source_trace_id"),
        notes=entity.get("notes"),
        created_at=entity["created_at"],
    )


@router.get("/", response_model=list[DatasetResponse])
async def list_datasets(
    project_id: str = Query(..., description="Project ID"),
):
    """List all datasets in a project.

    Args:
        project_id: Project ID

    Returns:
        List of datasets
    """
    table_client = get_table_storage_client()
    entities = table_client.list_entities_by_partition(
        table_name="datasets",
        partition_key=project_id,
    )
    datasets = [_entity_to_dataset(e) for e in entities]
    datasets.sort(key=lambda d: d.created_at, reverse=True)
    return datasets


@router.post("/", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def create_dataset(
    body: DatasetCreate,
    project_id: str = Query(..., description="Project ID"),
):
    """Create a new dataset.

    Args:
        body: Dataset creation request
        project_id: Project ID

    Returns:
        Created dataset
    """
    table_client = get_table_storage_client()

    entity = DatasetEntity(
        project_id=project_id,
        name=body.name,
        description=body.description,
        created_by="user",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    table_client.insert_entity(table_name="datasets", entity=entity)
    return _entity_to_dataset(entity)


@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Get a dataset by ID.

    Args:
        dataset_id: Dataset ID
        project_id: Project ID

    Returns:
        Dataset details

    Raises:
        HTTPException: If dataset not found
    """
    table_client = get_table_storage_client()
    entity = table_client.get_entity(
        table_name="datasets",
        partition_key=project_id,
        row_key=dataset_id,
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )
    return _entity_to_dataset(entity)


@router.delete("/{dataset_id}", response_model=Message)
async def delete_dataset(
    dataset_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Delete a dataset and all its items.

    Args:
        dataset_id: Dataset ID to delete
        project_id: Project ID

    Returns:
        Success message

    Raises:
        HTTPException: If dataset not found
    """
    table_client = get_table_storage_client()

    entity = table_client.get_entity(
        table_name="datasets",
        partition_key=project_id,
        row_key=dataset_id,
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )

    items_partition = f"{project_id}~{dataset_id}"
    items = table_client.list_entities_by_partition(
        table_name="datasetitems",
        partition_key=items_partition,
    )
    for item in items:
        table_client.delete_entity(
            table_name="datasetitems",
            partition_key=items_partition,
            row_key=item["RowKey"],
        )

    table_client.delete_entity(
        table_name="datasets",
        partition_key=project_id,
        row_key=dataset_id,
    )

    return Message(message=f"Dataset {dataset_id} and all items deleted")


@router.get("/{dataset_id}/items", response_model=list[DatasetItemResponse])
async def list_items(
    dataset_id: str,
    project_id: str = Query(..., description="Project ID"),
    limit: int = Query(100, ge=1, le=500, description="Max items to return"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
):
    """List items in a dataset with pagination.

    Args:
        dataset_id: Dataset ID
        project_id: Project ID
        limit: Maximum number of items to return (1–500, default 100)
        skip: Number of items to skip for pagination

    Returns:
        Page of dataset items
    """
    table_client = get_table_storage_client()
    partition_key = f"{project_id}~{dataset_id}"
    entities = table_client.list_entities_paged(
        table_name="datasetitems",
        partition_key=partition_key,
        limit=limit,
        skip=skip,
    )
    return [_entity_to_item(e) for e in entities]


@router.post(
    "/{dataset_id}/items",
    response_model=DatasetItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_item(
    dataset_id: str,
    body: DatasetItemCreate,
    project_id: str = Query(..., description="Project ID"),
):
    """Add an item to a dataset manually.

    Args:
        dataset_id: Dataset ID
        body: Item creation request
        project_id: Project ID

    Returns:
        Created dataset item

    Raises:
        HTTPException: If dataset not found
    """
    table_client = get_table_storage_client()

    dataset_entity = table_client.get_entity(
        table_name="datasets",
        partition_key=project_id,
        row_key=dataset_id,
    )
    if dataset_entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )

    item_entity = DatasetItemEntity(
        project_id=project_id,
        dataset_id=dataset_id,
        input=body.input,
        expected_output=body.expected_output,
        notes=body.notes,
        created_at=datetime.utcnow(),
    )
    table_client.insert_entity(table_name="datasetitems", entity=item_entity)

    dataset_entity["item_count"] = int(dataset_entity.get("item_count", 0)) + 1
    dataset_entity["updated_at"] = datetime.utcnow()
    table_client.update_entity(table_name="datasets", entity=dataset_entity)

    return _entity_to_item(item_entity)


@router.post(
    "/{dataset_id}/items/from-trace",
    response_model=DatasetItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_item_from_trace(
    dataset_id: str,
    body: DatasetItemFromTrace,
    project_id: str = Query(..., description="Project ID"),
):
    """Import a trace's inputs as a dataset item.

    Args:
        dataset_id: Dataset ID
        body: Import request with trace_id and optional expected_output
        project_id: Project ID

    Returns:
        Created dataset item

    Raises:
        HTTPException: If dataset or trace not found
    """
    table_client = get_table_storage_client()

    dataset_entity = table_client.get_entity(
        table_name="datasets",
        partition_key=project_id,
        row_key=dataset_id,
    )
    if dataset_entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )

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

    inputs_str = trace_entity.get("inputs", "{}")
    try:
        inputs_dict = json.loads(inputs_str)
        input_text = "\n".join(
            str(v) for v in inputs_dict.values() if v is not None
        )
    except (json.JSONDecodeError, AttributeError):
        input_text = inputs_str

    item_entity = DatasetItemEntity(
        project_id=project_id,
        dataset_id=dataset_id,
        input=input_text,
        expected_output=body.expected_output,
        source_trace_id=body.trace_id,
        notes=body.notes,
        created_at=datetime.utcnow(),
    )
    table_client.insert_entity(table_name="datasetitems", entity=item_entity)

    dataset_entity["item_count"] = int(dataset_entity.get("item_count", 0)) + 1
    dataset_entity["updated_at"] = datetime.utcnow()
    table_client.update_entity(table_name="datasets", entity=dataset_entity)

    return _entity_to_item(item_entity)


@router.post(
    "/{dataset_id}/items/upload-csv",
    response_model=DatasetCsvUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_csv_items(
    dataset_id: str,
    file: UploadFile,
    project_id: str = Query(..., description="Project ID"),
) -> DatasetCsvUploadResponse:
    """Bulk-import dataset items from a CSV file using batched writes.

    Accepts a CSV with an ``input`` or ``inputs`` column (required) and an
    optional ``expected_output`` column.  All other columns are ignored.
    Rows with an empty input value are skipped.  Inserts are performed in
    batches of 100 for efficiency.

    Args:
        dataset_id: Dataset ID to add items to
        file: Uploaded CSV file
        project_id: Project ID

    Returns:
        Count of created and skipped rows

    Raises:
        HTTPException: If dataset not found or CSV is missing the input column
    """
    table_client = get_table_storage_client()

    dataset_entity = table_client.get_entity(
        table_name="datasets",
        partition_key=project_id,
        row_key=dataset_id,
    )
    if dataset_entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames or []

    input_col: str | None = next(
        (c for c in ("input", "inputs") if c in fieldnames), None
    )
    if input_col is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"CSV must contain an 'input' or 'inputs' column. Found: {list(fieldnames)}",
        )

    now = datetime.utcnow()

    _MAX_INPUT_CHARS = 32_000

    entities: list[dict] = []
    skipped = 0
    truncated = 0

    for row in reader:
        input_text = row.get(input_col, "").strip()
        if not input_text:
            skipped += 1
            continue

        if len(input_text) > _MAX_INPUT_CHARS:
            input_text = input_text[:_MAX_INPUT_CHARS]
            truncated += 1

        expected_output = row.get("expected_output", "").strip() or None

        item_entity = DatasetItemEntity(
            project_id=project_id,
            dataset_id=dataset_id,
            input=input_text,
            expected_output=expected_output,
            notes=None,
            created_at=now,
        )
        entities.append(dict(item_entity))

    created = 0
    if entities:
        created = table_client.batch_insert_entities(
            table_name="datasetitems",
            entities=entities,
        )
        dataset_entity["item_count"] = int(dataset_entity.get("item_count", 0)) + created
        dataset_entity["updated_at"] = now
        table_client.update_entity(table_name="datasets", entity=dataset_entity)

    return DatasetCsvUploadResponse(created=created, skipped=skipped, truncated=truncated)


@router.delete("/{dataset_id}/items/{item_id}", response_model=Message)
async def delete_item(
    dataset_id: str,
    item_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Delete a dataset item.

    Args:
        dataset_id: Dataset ID
        item_id: Item ID to delete
        project_id: Project ID

    Returns:
        Success message

    Raises:
        HTTPException: If item not found
    """
    table_client = get_table_storage_client()

    partition_key = f"{project_id}~{dataset_id}"
    entity = table_client.get_entity(
        table_name="datasetitems",
        partition_key=partition_key,
        row_key=item_id,
    )
    if entity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset item not found",
        )

    table_client.delete_entity(
        table_name="datasetitems",
        partition_key=partition_key,
        row_key=item_id,
    )

    dataset_entity = table_client.get_entity(
        table_name="datasets",
        partition_key=project_id,
        row_key=dataset_id,
    )
    if dataset_entity is not None:
        current_count = int(dataset_entity.get("item_count", 0))
        dataset_entity["item_count"] = max(0, current_count - 1)
        dataset_entity["updated_at"] = datetime.utcnow()
        table_client.update_entity(table_name="datasets", entity=dataset_entity)

    return Message(message=f"Item {item_id} deleted successfully")
