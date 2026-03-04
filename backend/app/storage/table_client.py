"""Azure Table Storage client wrapper with DefaultAzureCredential support."""

from azure.data.tables import TableServiceClient, TableClient, UpdateMode
from azure.identity import DefaultAzureCredential
from azure.core.exceptions import ResourceNotFoundError, ResourceExistsError
from typing import Any
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class TableStorageClient:
    """Wrapper for Azure Table Storage operations."""

    def __init__(self):
        """Initialize Table Storage client with appropriate credentials."""
        if settings.use_azurite:
            # Use connection string for Azurite (local development)
            logger.info("Using Azurite connection string for Table Storage")
            self._service_client = TableServiceClient.from_connection_string(
                conn_str=settings.azurite_connection_string
            )
        else:
            # Use DefaultAzureCredential for production
            logger.info(f"Using DefaultAzureCredential for Table Storage: {settings.storage_account_url}")
            credential = DefaultAzureCredential()
            self._service_client = TableServiceClient(
                endpoint=settings.storage_account_url,
                credential=credential,
            )

    def get_table_client(self, table_name: str) -> TableClient:
        """Get a client for a specific table.

        Args:
            table_name: Name of the table

        Returns:
            TableClient instance for the specified table
        """
        return self._service_client.get_table_client(table_name=table_name)

    def create_table_if_not_exists(self, table_name: str) -> None:
        """Create a table if it doesn't exist.

        Args:
            table_name: Name of the table to create
        """
        try:
            self._service_client.create_table(table_name=table_name)
            logger.info(f"Created table: {table_name}")
        except ResourceExistsError:
            logger.debug(f"Table already exists: {table_name}")
        except Exception as e:
            logger.error(f"Error creating table {table_name}: {e}")
            raise

    def insert_entity(self, table_name: str, entity: dict[str, Any]) -> dict[str, Any]:
        """Insert an entity into a table.

        Args:
            table_name: Name of the table
            entity: Entity dictionary with PartitionKey and RowKey

        Returns:
            Inserted entity with metadata
        """
        table_client = self.get_table_client(table_name)
        return table_client.create_entity(entity=entity)

    def get_entity(self, table_name: str, partition_key: str, row_key: str) -> dict[str, Any] | None:
        """Get a single entity by partition and row key.

        Args:
            table_name: Name of the table
            partition_key: Partition key
            row_key: Row key

        Returns:
            Entity dictionary or None if not found
        """
        table_client = self.get_table_client(table_name)
        try:
            return table_client.get_entity(partition_key=partition_key, row_key=row_key)
        except ResourceNotFoundError:
            return None

    def update_entity(self, table_name: str, entity: dict[str, Any], mode: str = "merge") -> dict[str, Any]:
        """Update an entity in a table.

        Args:
            table_name: Name of the table
            entity: Entity dictionary with PartitionKey and RowKey
            mode: Update mode - "merge" (default) or "replace"

        Returns:
            Updated entity metadata
        """
        table_client = self.get_table_client(table_name)
        update_mode = UpdateMode.MERGE if mode == "merge" else UpdateMode.REPLACE
        return table_client.update_entity(entity=entity, mode=update_mode)

    def delete_entity(self, table_name: str, partition_key: str, row_key: str) -> None:
        """Delete an entity from a table.

        Args:
            table_name: Name of the table
            partition_key: Partition key
            row_key: Row key
        """
        table_client = self.get_table_client(table_name)
        table_client.delete_entity(partition_key=partition_key, row_key=row_key)

    def batch_insert_entities(
        self,
        table_name: str,
        entities: list[dict[str, Any]],
        batch_size: int = 100,
    ) -> int:
        """Insert multiple entities using batched transactions.

        Azure Table Storage supports up to 100 entities per transaction,
        and all entities in a batch must share the same PartitionKey.

        Args:
            table_name: Name of the table
            entities: List of entity dictionaries (must share PartitionKey)
            batch_size: Number of entities per transaction (max 100)

        Returns:
            Number of entities successfully inserted
        """
        if not entities:
            return 0

        table_client = self.get_table_client(table_name)
        inserted = 0

        for i in range(0, len(entities), batch_size):
            chunk = entities[i : i + batch_size]
            operations = [("create", entity) for entity in chunk]
            table_client.submit_transaction(operations)
            inserted += len(chunk)

        return inserted

    def query_entities(
        self,
        table_name: str,
        filter_query: str | None = None,
        select: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Query entities from a table.

        Args:
            table_name: Name of the table
            filter_query: OData filter string (e.g., "PartitionKey eq 'PROJECT'")
            select: List of properties to select

        Returns:
            List of entities matching the query
        """
        table_client = self.get_table_client(table_name)
        entities = table_client.query_entities(query_filter=filter_query, select=select)
        return list(entities)

    def list_entities_by_partition(
        self,
        table_name: str,
        partition_key: str,
    ) -> list[dict[str, Any]]:
        """List all entities in a partition.

        Args:
            table_name: Name of the table
            partition_key: Partition key to filter by

        Returns:
            List of entities in the partition
        """
        filter_query = f"PartitionKey eq '{partition_key}'"
        return self.query_entities(table_name=table_name, filter_query=filter_query)

    def list_entities_paged(
        self,
        table_name: str,
        partition_key: str,
        limit: int = 100,
        skip: int = 0,
    ) -> list[dict[str, Any]]:
        """List entities in a partition with offset-based pagination.

        Args:
            table_name: Name of the table
            partition_key: Partition key to filter by
            limit: Maximum number of entities to return
            skip: Number of entities to skip

        Returns:
            Slice of entities for the requested page
        """
        filter_query = f"PartitionKey eq '{partition_key}'"
        table_client = self.get_table_client(table_name)
        entities = table_client.query_entities(
            query_filter=filter_query,
            results_per_page=min(limit + skip, 1000),
        )
        results = []
        fetched = 0
        for entity in entities:
            if fetched < skip:
                fetched += 1
                continue
            results.append(dict(entity))
            if len(results) >= limit:
                break
        return results


# Global table storage client instance
_table_client: TableStorageClient | None = None


def get_table_storage_client() -> TableStorageClient:
    """Get the global Table Storage client instance.

    Returns:
        TableStorageClient instance
    """
    global _table_client
    if _table_client is None:
        _table_client = TableStorageClient()
    return _table_client
