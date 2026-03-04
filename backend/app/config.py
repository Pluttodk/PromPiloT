"""Application configuration using Pydantic Settings."""

from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_name: str = "Prom-Pilot"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False

    # Azure Storage
    azure_storage_account_name: str | None = None
    azure_storage_account_url: str | None = None
    use_azurite: bool = True  # Use Azurite for local development

    # Azurite connection string (local development)
    azurite_connection_string: str = (
        "DefaultEndpointsProtocol=http;"
        "AccountName=devstoreaccount1;"
        "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;"
        "TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"
        "BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
    )

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # API
    api_v1_prefix: str = "/api/v1"

    # LLM Configuration
    openai_api_key: str | None = None
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_api_version: str = "2024-02-01"
    default_llm_model: str = "gpt-3.5-turbo"
    default_llm_temperature: float = 0.7
    default_llm_max_tokens: int = 4096

    @property
    def storage_connection_string(self) -> str | None:
        """Get the appropriate storage connection string based on environment."""
        if self.use_azurite:
            return self.azurite_connection_string
        return None

    @property
    def storage_account_url(self) -> str | None:
        """Get storage account URL (for DefaultAzureCredential in production)."""
        if self.use_azurite:
            return None
        if self.azure_storage_account_url:
            return self.azure_storage_account_url
        if self.azure_storage_account_name:
            return f"https://{self.azure_storage_account_name}.table.core.windows.net"
        return None


# Global settings instance
settings = Settings()
