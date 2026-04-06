## Backend - Resource Management API

Production-oriented FastAPI backend for **Resource Management CRUD** with a clear three-layer architecture:

- Router (Controller) → Service → Repository
- FastAPI + SQLAlchemy ORM + Pydantic
- PostgreSQL
- Alembic migrations in `backend/migrations`

Designed so scheduling and Prolog integration can plug in later without rewriting core resource models.

### 1) Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Update `.env` as needed:

- `DATABASE_URL` (PostgreSQL)
- `CORS_ORIGINS` (frontend origin)

### 2) Run Migrations

```bash
cd backend
alembic upgrade head
```

This creates schema + dummy seed data.

### 3) Run API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Open docs at `http://localhost:8000/docs`.

### 4) API Base

All resource endpoints are under:

- `/api/v1/resources`

Resource groups:

- `/programs`
- `/courses`
- `/rooms`
- `/timeslots`
- `/professors`
- `/students`
- `/special-enrollments`
- `/program-year-plans`

Chat group:

- `/chat`

Each group supports CRUD:

- `GET /`
- `GET /{id}`
- `POST /`
- `PUT /{id}`
- `DELETE /{id}`

### Scheduling RAG Chat

The scheduling chatbot is exposed at:

- `POST /api/v1/chat/ask`

Request payload:

```json
{
	"question": "How many professors are teaching on Monday across all programs?"
}
```

Response includes:

- `status` (`answered` or `rejected`)
- `answer`
- optional SQL/debug fields (`sql_query`, `rows_preview`, `row_count`) based on settings

Chat setup requirements:

- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL` (default `gpt-4o-mini`)
- `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)

Run migration to create pgvector support table:

```bash
alembic upgrade head
```

### Notes for Future Scheduling + Prolog

- Resource entities and relationships are normalized and strongly typed.
- `program_year_plans` is already separated as a planning input boundary.
- Scheduling engine (Prolog) can consume read models from current resource APIs without coupling to router/repository implementation details.
