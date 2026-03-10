# Prom-Pilot: LLMOps Platform

An enterprise-grade LLMOps platform for managing prompts, orchestrating multi-step LLM flows, running evaluations, and tracing production usage.

The tool is made to ensure that one can segment the management of prompts, while still constructing multi-stage flows

Ideally this tool servers as a gap in the market, that are only solved half by tools such as Langfuse or Haystack

The tool focus on using Azure as the backend for hosting

## 🏗️ Architecture

- **Backend**: FastAPI (Python 3.12+) with Azure Table Storage and Blob Storage
- **Frontend**: React 18 + TypeScript with Vite
- **Storage**: Azure Storage Account (Tables + Blobs)
- **Authentication**: Azure DefaultAzureCredential (user's own Azure credentials)
- **Local Development**: Azurite storage emulator


## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+ and npm
- Docker and Docker Compose
- Azure CLI (run `az login` for local development)
- uv (Python package manager): `pip install uv`

### Backend Setup

1. **Install backend dependencies:**
   ```bash
   cd backend
   uv sync
   ```

2. **Start Azurite (Azure Storage Emulator):**
   ```bash
   cd ..
   docker compose up -d
   ```

   This starts Azurite with ports:
   - 10000: Blob Storage
   - 10001: Queue Storage
   - 10002: Table Storage

3. **Run the backend:**
   ```bash
   cd backend
   uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at:
   - http://localhost:8000 - Root endpoint
   - http://localhost:8000/docs - Interactive API documentation (Swagger)
   - http://localhost:8000/health - Health check

### Frontend Setup

1. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Run the frontend dev server:**
   ```bash
   npm run dev
   ```

   The frontend will be available at http://localhost:5173

### Environment Configuration

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

For local development, the default configuration uses Azurite. No changes needed!

For production deployment to Azure:
- Set `USE_AZURITE=false`
- Set `AZURE_STORAGE_ACCOUNT_NAME=your_storage_account`
- Ensure Web App has managed identity with Storage permissions

## 📁 Project Structure

```
promptflow/
├── backend/                       # FastAPI backend
│   ├── app/
│   │   ├── main.py                # Application entry point
│   │   ├── config.py              # Settings and configuration
│   │   ├── api/v1/                # API endpoints
│   │   │   ├── projects.py        # Projects CRUD
│   │   │   └── prompts.py         # Prompts CRUD
│   │   ├── models/
│   │   │   ├── entities.py        # Table Storage entities
│   │   │   └── schemas.py         # Pydantic schemas
│   │   ├── storage/
│   │   │   ├── table_client.py    # Table Storage client
│   │   │   └── blob_client.py     # Blob Storage client
│   │   ├── services/              # Business logic (TBD)
│   │   └── core/                  # Flow engine, LLM clients (TBD)
│   ├── tests/                     # Tests (TBD)
│   └── pyproject.toml             # Python dependencies
│
├── frontend/                      # React frontend
│   ├── src/                       # Source code (to be built)
│   ├── package.json               # Dependencies configured
│   └── vite.config.ts             # Vite configuration
│
├── docker-compose.yml             # Azurite setup
├── .env.example                   # Environment variables template
└── README.md                      # This file
```

## 🔧 API Endpoints

### Projects

- `GET /api/v1/projects` - List all projects
- `POST /api/v1/projects` - Create a project
- `GET /api/v1/projects/{project_id}` - Get project by ID
- `PUT /api/v1/projects/{project_id}` - Update a project
- `DELETE /api/v1/projects/{project_id}` - Delete a project

### Prompts

- `GET /api/v1/prompts?project_id={project_id}` - List prompts in a project
- `POST /api/v1/prompts?project_id={project_id}` - Create a prompt
- `GET /api/v1/prompts/{prompt_id}?project_id={project_id}` - Get prompt by ID
- `PUT /api/v1/prompts/{prompt_id}?project_id={project_id}` - Update a prompt
- `DELETE /api/v1/prompts/{prompt_id}?project_id={project_id}` - Delete a prompt

## 🧪 Testing the API

You can test the API using the interactive docs at http://localhost:8000/docs

Or use curl:

```bash
# Create a project
curl -X POST http://localhost:8000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "My First Project", "description": "Test project"}'

# List projects
curl http://localhost:8000/api/v1/projects

# Create a prompt
curl -X POST "http://localhost:8000/api/v1/prompts?project_id=PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer Support Bot",
    "description": "Helpful customer support assistant",
    "template": "You are a helpful assistant. User question: {{question}}",
    "model_config": {"model": "gpt-4", "temperature": 0.7}
  }'

# List prompts in a project
curl "http://localhost:8000/api/v1/prompts?project_id=PROJECT_ID"
```

## 📊 Storage Schema

### Table Storage

**projects** table:
- PartitionKey: "PROJECT"
- RowKey: {project_id} (UUID)
- Fields: name, description, created_by, created_at, updated_at

**prompts** table:
- PartitionKey: {project_id}
- RowKey: {prompt_id} (UUID)
- Fields: name, description, template, model_config (JSON), created_by, created_at, updated_at

### Blob Storage

Containers:
- `traces` - Trace data and span details
- `flows` - Flow definitions (LangGraph JSON)
- `evaluations` - Evaluation datasets and results
- `artifacts` - Model outputs, screenshots, etc.

## 🔐 Authentication

### Local Development
- Run `az login` to authenticate with Azure CLI
- DefaultAzureCredential automatically uses your CLI credentials
- No API keys or secrets needed in code!

### Production (Azure Web App)
- Web App uses Managed Identity
- Managed Identity needs these RBAC roles on Storage Account:
  - `Storage Blob Data Contributor`
  - `Storage Table Data Contributor`
- No secrets stored in application configuration

## 🐛 Troubleshooting

### Azurite Connection Issues
- Ensure Docker is running: `docker ps`
- Check Azurite is listening: `curl http://localhost:10002/devstoreaccount1/tables`
- Restart Azurite: `docker compose restart`

### Backend Import Errors
- Ensure you're in the backend directory
- Run with uv: `uv run uvicorn app.main:app --reload`
- Check virtual environment: `uv sync`

### CORS Errors
- Frontend must run on http://localhost:5173 or add your URL to CORS_ORIGINS in .env

## 📚 Next Steps

1. **Complete Frontend Setup**:
   - Install dependencies
   - Configure Tailwind CSS
   - Setup shadcn/ui
   - Create API client and hooks

2. **Build UI Components**:
   - Layout (Header, Sidebar)
   - Project list and creation
   - Prompt editor with Monaco
   - Prompt list and management

3. **Phase 2: Flow Execution**:
   - LangGraph integration
   - React Flow visual designer
   - Flow execution engine

4. **Phase 3: Tracing**:
   - OpenTelemetry integration
   - Trace storage and retrieval
   - Trace visualization UI

## 📖 Documentation

- [SDK Documentation](docs/) - Python SDK guides and reference
- [API Documentation](http://localhost:8000/docs) (when backend is running)
- [Implementation Plan](CLAUDE.md) - Full specification and architecture

## 🤝 Contributing

This project follows the implementation plan in [CLAUDE.md](CLAUDE.md). We're currently in Phase 1 (Foundation).

## 📝 License

[Your License Here]
