from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.agents import BaseAgent, DevelopmentSupervisor, GlobalOrchestrator
from app.database import create_pipeline_repository
from app.schemas import PipelineRequest
from app.auth import router as auth_router

load_dotenv(Path(__file__).with_name(".env"))


class SimulatedFailingBuildAgent(BaseAgent):
    """Simulates a compiler environment failure to demonstrate autonomous self-healing."""
    name = "Build Agent"

    async def execute(self, task: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("COMPILER_ERROR: Missing C++ build dependencies & header lockfile mismatch in build environment")


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.pipeline_repository = create_pipeline_repository()
    yield
    await application.state.pipeline_repository.close()

app = FastAPI(
    title="Autonomous DevOps Swarm API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

@app.get("/")
def root():
    return {
        "message": "Autonomous DevOps Swarm Backend Running"
    }


@app.post("/api/pipelines/development")
async def start_development_pipeline(payload: PipelineRequest, request: Request):
    """Run the Sprint 2 development workflow and return its observable history."""
    repo = request.app.state.pipeline_repository
    return await DevelopmentSupervisor(repository=repo).run_pipeline(payload.request)


@app.post("/api/pipelines")
async def start_swarm_pipeline(payload: PipelineRequest, request: Request):
    """Run the observable Sprint 3 development-to-operations swarm."""
    repo = request.app.state.pipeline_repository
    dev_supervisor = DevelopmentSupervisor(repository=repo)
    return await GlobalOrchestrator(repository=repo, development_supervisor=dev_supervisor).run_pipeline(payload.request)


@app.post("/api/pipelines/simulate-failure")
async def simulate_failure_and_self_heal(payload: PipelineRequest, request: Request):
    """Simulate a pipeline build failure to demonstrate autonomous self-healing & DB failure memory persistence."""
    repo = request.app.state.pipeline_repository
    failing_pipeline = [
        DevelopmentSupervisor().pipeline[0],  # Planning Agent
        DevelopmentSupervisor().pipeline[1],  # Coding Agent
        SimulatedFailingBuildAgent(),         # Simulated Failure Build Agent
        DevelopmentSupervisor().pipeline[3],  # Testing Agent
    ]
    dev_supervisor = DevelopmentSupervisor(pipeline=failing_pipeline, repository=repo)
    return await GlobalOrchestrator(repository=repo, development_supervisor=dev_supervisor).run_pipeline(payload.request)


@app.get("/api/pipelines")
async def list_pipelines(request: Request, limit: int = 20):
    """Return recent delivery missions for the dashboard history panel."""
    safe_limit = min(max(limit, 1), 100)
    repository = request.app.state.pipeline_repository
    return {"storage": repository.storage_name, "pipelines": await repository.list(safe_limit)}


@app.get("/api/failures")
async def list_failures(request: Request, limit: int = 50):
    """Return stored failure memory and self-healing resolution logs from Database."""
    repository = request.app.state.pipeline_repository
    failures = await repository.list_failure_memory(limit)
    return {
        "storage": repository.storage_name,
        "total_failures_healed": len(failures),
        "failures": failures
    }


@app.get("/api/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str, request: Request):
    pipeline = await request.app.state.pipeline_repository.get(pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline
