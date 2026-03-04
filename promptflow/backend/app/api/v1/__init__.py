"""API v1 router that includes all endpoint routers."""

from fastapi import APIRouter

from app.api.v1 import projects, prompts, flows, models, traces, scores, datasets, evaluations

router = APIRouter()

# Include sub-routers
router.include_router(projects.router, prefix="/projects", tags=["projects"])
router.include_router(prompts.router, prefix="/prompts", tags=["prompts"])
router.include_router(flows.router, prefix="/flows", tags=["flows"])
router.include_router(models.router, prefix="/models", tags=["models"])
router.include_router(traces.router, prefix="/traces", tags=["traces"])
router.include_router(scores.router, prefix="/scores", tags=["scores"])
router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])
