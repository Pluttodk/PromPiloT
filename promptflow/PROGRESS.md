# Prom-Pilot Development Progress

## Current Phase: Phase 2 - Flow Execution

### Phase 1 - Foundation (Completed)
- [x] Backend project setup with uv
- [x] FastAPI application with CORS and startup logic
- [x] Azure Table Storage client with DefaultAzureCredential
- [x] Azure Blob Storage client with DefaultAzureCredential
- [x] Configuration management (Azurite + Azure)
- [x] Table Storage entity models (Projects, Prompts, Users)
- [x] Pydantic schemas for API validation
- [x] Projects CRUD API (`/api/v1/projects`)
- [x] Prompts CRUD API (`/api/v1/prompts`)
- [x] Docker Compose with Azurite (+ skipApiVersionCheck fix)
- [x] README with setup instructions
- [x] Frontend initialized (Vite + React + TypeScript)
- [x] Frontend dependencies in package.json
- [x] Setup Tailwind CSS configuration
- [x] Create API types and axios client
- [x] Create TanStack Query hooks (projects, prompts)
- [x] Create layout components (Header, Sidebar, Layout)
- [x] Create Projects page with list and create modal
- [x] Create Prompts page with Monaco Editor
- [x] Setup React Router for navigation

### Phase 2 - Flow Execution (Completed)
- [x] FlowEntity model and Flow schemas
- [x] Flows CRUD API (`/api/v1/flows`)
- [x] LLM Client wrapper using LiteLLM
- [x] Flow Executor service with DAG execution
- [x] Flow execution endpoint (`POST /api/v1/flows/{id}/execute`)
- [x] React Flow visual designer
- [x] Custom node components (InputNode, PromptNode, OutputNode)
- [x] Node palette with drag-and-drop
- [x] FlowsPage with flow list and create modal
- [x] FlowDesignerPage with canvas and node configuration
- [x] Flow routes and navigation enabled

### Phase 2.5 - Model selection
- [x] Have a navbar menu to create models
- [x] Have the models be tied up to a flow
- [x] Have multiple steps in the flow be seperated by models
- [x] The authentication to model should be happening using AzureDefaultCredential and not API key
- [x] The models defined should be tied to the project

### Phase 4 - Tracing (Completed)
- [x] TraceEntity for storing execution traces
- [x] Token tracking in LLM client
- [x] Flow executor records traces with per-node details
- [x] Traces CRUD API (`/api/v1/traces`)
- [x] Traces list page with filtering
- [x] Trace detail page with timeline view
- [x] "View Trace" link from execute modal
- [x] Fix input flow to pass flow_inputs to all nodes
- [x] Redesigned trace UI with softer colors and better visual hierarchy
- [x] Azure AI Foundry-style trace UI redesign:
  - Date-range filter bar (Today / Last 7 days / Last 30 days / Custom)
  - Backend `date_from`/`date_to` query params for server-side filtering
  - Two-panel trace detail: left node list with duration bars, right Input/Output/Metadata tabs
  - Chat-bubble rendering for prompt node messages (system/user/assistant)
  - Playwright visual tests for traces UI

### Phase 4.5 - Variable-Based Flow Architecture (Completed)
- [x] Prompt nodes support separate system prompt and user input configuration
- [x] Each input can be: None, from stored prompt, or from connection
- [x] Variables in prompts ({{ var }}) appear as labeled handles on nodes
- [x] Explicit edge connections to variable handles
- [x] Input/output node names are visual only (not tied to variable binding)
- [x] Backend executor resolves variables by handle connections
- [x] Variable extraction utility for Jinja2 templates
- [x] New prompt node configuration modal with source selection

### Phase 4.6 - Flow Editor Bug Fixes (Completed)
- [x] Edge deletion now works (click edge + Delete/Backspace)
- [x] Undo (Ctrl+Z) now works for node additions, movements, and deletions
- [x] Flow execution properly routes data between nodes with generic connections
- [x] Backend `_get_connected_value` falls back to edges with null targetHandle
- [x] Increased default_llm_max_tokens from 1024 to 4096 to prevent truncation with longer inputs

### Phase 5 - Versioning & Deployment
- [x] Prompt versioning (PromptVersionEntity in `promptversions` table)
- [x] Save as new version (POST /prompts/{id}/versions — snapshots current draft)
- [x] List versions (GET /prompts/{id}/versions — newest first)
- [x] Promote to production (POST /prompts/{id}/versions/{n}/promote)
- [x] Flow executor resolves Production version at runtime (backward-compatible)
- [x] Frontend: Production badge in editor header, Save draft / Save as new version buttons
- [x] Frontend: Collapsible version history panel with crown icon and Set as Production button
- [x] Frontend: Read-only version preview modal (Monaco readOnly)
- [x] Tags replace is_production: free-form strings per version (e.g. "staging", "dev", "archived")
- [x] "production" tag is exclusive — setting it clears it from all other versions automatically
- [x] Production warning modal before promoting (evaluation reminder)
- [x] Version history moved to left panel (below prompt list) — editor is now full-height and uncluttered
- [x] Tag chips with colour coding (amber=production, blue=staging, green=dev) + inline add/remove
- [x] Header Production badge stays live via usePrompt query (reacts to tag mutations instantly)
- [ ] Azure Bicep templates
- [ ] Docker deployment

### Phase 6 - Evaluation Framework (Completed)
- [x] New storage tables: scores, datasets, datasetitems, evalruns, evalresults
- [x] Entity classes: ScoreEntity, DatasetEntity, DatasetItemEntity, EvalRunEntity, EvalResultEntity
- [x] TraceEntity gains `eval_run_id` field to tag eval-generated traces
- [x] ScoreCreate/ScoreResponse/LLMJudgeRequest/LLMJudgeResponse Pydantic schemas
- [x] Dataset/DatasetItem/EvalRun/EvalResult Pydantic schemas (~14 new schemas)
- [x] `app/services/llm_judge.py` — LLMJudgeService with deterministic scoring & JSON parsing
- [x] `app/services/eval_runner.py` — EvalRunner background batch execution
- [x] `app/api/v1/scores.py` — create/list/delete human scores + LLM judge endpoint
- [x] `app/api/v1/datasets.py` — full dataset CRUD + item management + import-from-trace
- [x] `app/api/v1/evaluations.py` — eval run CRUD + per-item results + BackgroundTasks
- [x] `traces.py` updated: eval_run_id filter, score_count in list response
- [x] `flow_executor.py` accepts optional `eval_run_id` param
- [x] Frontend: DatasetsPage + DatasetDetailPage
- [x] Frontend: EvalRunsPage + EvalRunDetailPage (auto-polling while running)
- [x] Frontend: ScorePanel component (thumbs, stars, custom, LLM judge)
- [x] Frontend: LLMJudgeModal + EvalRunCreateModal
- [x] Frontend: "Import as test case" modal on TraceDetailPage
- [x] Frontend: score_count badge + eval tag on TracesPage cards
- [x] Sidebar: Datasets (Database icon) + Evaluations (FlaskConical icon) nav items

### Phase 6.5 - Flow Editor UX Improvements (Completed)
- [x] Right-side `NodeConfigPanel` (replaces the node config modal) — slides in on node select, canvas shrinks cleanly
- [x] Validation badges on nodes — green/amber/red dot derived from node data, no extra state
- [x] Empty-state template overlay — "Simple Q&A", "Multi-step Chain", "Blank" quick-start cards when canvas is empty
- [x] Auto-arrange button — dagre LR layout applied to all nodes on click
- [x] `dagre` + `@types/dagre` installed
- [x] CORS origins extended to cover dev ports 5175–5177

### Phase 7 - SDK & Deployment
- [x] Python SDK (`sdk/` package — `prom-pilot-sdk`, importable as `prom_pilot`)
  - `PromPilotClient` with async-first API and `run_sync()` convenience wrapper
  - `FlowsResource` — list, get, execute
  - `DatasetsResource` — CRUD + item management
  - `EvaluationsResource` — create, poll, `run_and_wait()` with timeout
  - `TracesResource` — get, list with filters
  - Pydantic response models matching backend schemas
  - `PromPilotError` / `NotFoundError` / `ExecutionError` exceptions
  - 17 unit tests (all passing) with `respx` mock transport
- [ ] Azure Bicep templates / Docker deployment

### Phase 8 - Access Control & Polish
- [ ] Project permissions
- [ ] UI polish

## Quick Commands

```bash
# Start Azurite
docker compose up -d

# Run backend
cd backend && uv run uvicorn app.main:app --reload

# Run frontend
cd frontend && npm run dev

# API docs
http://localhost:8000/docs
```

## Key Files
- Backend: `backend/app/main.py`
- Frontend: `frontend/src/main.tsx`
- Config: `backend/app/config.py`
- Docker: `docker-compose.yml`
 