"""Main FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings
from app.storage.table_client import get_table_storage_client
from app.storage.blob_client import get_blob_storage_client
from app.api.v1 import router as api_v1_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Table names
TABLES = ["projects", "prompts", "promptversions", "flows", "traces", "users", "permissions", "modelconfigs", "scores", "datasets", "datasetitems", "evalruns", "evalresults"]

# Blob containers
CONTAINERS = ["traces", "flows", "evaluations", "artifacts"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events.

    This function runs on application startup to initialize storage tables and containers.
    """
    logger.info(f"Starting {settings.app_name} in {settings.environment} mode")

    # Initialize Table Storage
    table_client = get_table_storage_client()
    logger.info("Initializing Table Storage tables...")
    for table_name in TABLES:
        table_client.create_table_if_not_exists(table_name)

    # Initialize Blob Storage
    blob_client = get_blob_storage_client()
    logger.info("Initializing Blob Storage containers...")
    for container_name in CONTAINERS:
        blob_client.create_container_if_not_exists(container_name)

    logger.info("Application startup complete!")

    yield

    # Cleanup on shutdown
    logger.info("Application shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="LLMOps platform for managing prompts, flows, and evaluations",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_v1_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root():
    """Root endpoint to check if the API is running."""
    return {
        "message": f"Welcome to {settings.app_name}!",
        "environment": settings.environment,
        "docs_url": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "environment": settings.environment}
