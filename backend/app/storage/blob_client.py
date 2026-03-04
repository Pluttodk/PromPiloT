"""Azure Blob Storage client wrapper with DefaultAzureCredential support."""

from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from azure.identity import DefaultAzureCredential
from azure.core.exceptions import ResourceNotFoundError, ResourceExistsError
import logging
import json
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class BlobStorageClient:
    """Wrapper for Azure Blob Storage operations."""

    def __init__(self):
        """Initialize Blob Storage client with appropriate credentials."""
        if settings.use_azurite:
            # Use connection string for Azurite (local development)
            logger.info("Using Azurite connection string for Blob Storage")
            self._service_client = BlobServiceClient.from_connection_string(
                conn_str=settings.azurite_connection_string
            )
        else:
            # Use DefaultAzureCredential for production
            logger.info(f"Using DefaultAzureCredential for Blob Storage")
            credential = DefaultAzureCredential()
            account_url = f"https://{settings.azure_storage_account_name}.blob.core.windows.net"
            self._service_client = BlobServiceClient(
                account_url=account_url,
                credential=credential,
            )

    def create_container_if_not_exists(self, container_name: str) -> None:
        """Create a container if it doesn't exist.

        Args:
            container_name: Name of the container to create
        """
        try:
            self._service_client.create_container(name=container_name)
            logger.info(f"Created container: {container_name}")
        except ResourceExistsError:
            logger.debug(f"Container already exists: {container_name}")
        except Exception as e:
            logger.error(f"Error creating container {container_name}: {e}")
            raise

    def get_blob_client(self, container_name: str, blob_name: str) -> BlobClient:
        """Get a client for a specific blob.

        Args:
            container_name: Name of the container
            blob_name: Name of the blob

        Returns:
            BlobClient instance
        """
        return self._service_client.get_blob_client(container=container_name, blob=blob_name)

    def get_container_client(self, container_name: str) -> ContainerClient:
        """Get a client for a specific container.

        Args:
            container_name: Name of the container

        Returns:
            ContainerClient instance
        """
        return self._service_client.get_container_client(container=container_name)

    def upload_blob(self, container_name: str, blob_name: str, data: bytes | str) -> None:
        """Upload data to a blob.

        Args:
            container_name: Name of the container
            blob_name: Name of the blob
            data: Data to upload (bytes or string)
        """
        blob_client = self.get_blob_client(container_name, blob_name)
        if isinstance(data, str):
            data = data.encode("utf-8")
        blob_client.upload_blob(data, overwrite=True)
        logger.info(f"Uploaded blob: {container_name}/{blob_name}")

    def upload_json(self, container_name: str, blob_name: str, data: Any) -> None:
        """Upload JSON data to a blob.

        Args:
            container_name: Name of the container
            blob_name: Name of the blob
            data: Python object to serialize as JSON
        """
        json_data = json.dumps(data, indent=2)
        self.upload_blob(container_name, blob_name, json_data)

    def download_blob(self, container_name: str, blob_name: str) -> bytes:
        """Download a blob as bytes.

        Args:
            container_name: Name of the container
            blob_name: Name of the blob

        Returns:
            Blob content as bytes

        Raises:
            ResourceNotFoundError: If blob doesn't exist
        """
        blob_client = self.get_blob_client(container_name, blob_name)
        return blob_client.download_blob().readall()

    def download_blob_text(self, container_name: str, blob_name: str) -> str:
        """Download a blob as text.

        Args:
            container_name: Name of the container
            blob_name: Name of the blob

        Returns:
            Blob content as string

        Raises:
            ResourceNotFoundError: If blob doesn't exist
        """
        data = self.download_blob(container_name, blob_name)
        return data.decode("utf-8")

    def download_json(self, container_name: str, blob_name: str) -> Any:
        """Download and parse JSON from a blob.

        Args:
            container_name: Name of the container
            blob_name: Name of the blob

        Returns:
            Parsed JSON data

        Raises:
            ResourceNotFoundError: If blob doesn't exist
            json.JSONDecodeError: If blob content is not valid JSON
        """
        text = self.download_blob_text(container_name, blob_name)
        return json.loads(text)

    def delete_blob(self, container_name: str, blob_name: str) -> None:
        """Delete a blob.

        Args:
            container_name: Name of the container
            blob_name: Name of the blob
        """
        blob_client = self.get_blob_client(container_name, blob_name)
        blob_client.delete_blob()
        logger.info(f"Deleted blob: {container_name}/{blob_name}")

    def blob_exists(self, container_name: str, blob_name: str) -> bool:
        """Check if a blob exists.

        Args:
            container_name: Name of the container
            blob_name: Name of the blob

        Returns:
            True if blob exists, False otherwise
        """
        blob_client = self.get_blob_client(container_name, blob_name)
        return blob_client.exists()

    def list_blobs(self, container_name: str, prefix: str | None = None) -> list[str]:
        """List blobs in a container.

        Args:
            container_name: Name of the container
            prefix: Optional prefix to filter blobs

        Returns:
            List of blob names
        """
        container_client = self.get_container_client(container_name)
        blobs = container_client.list_blobs(name_starts_with=prefix)
        return [blob.name for blob in blobs]


# Global blob storage client instance
_blob_client: BlobStorageClient | None = None


def get_blob_storage_client() -> BlobStorageClient:
    """Get the global Blob Storage client instance.

    Returns:
        BlobStorageClient instance
    """
    global _blob_client
    if _blob_client is None:
        _blob_client = BlobStorageClient()
    return _blob_client
