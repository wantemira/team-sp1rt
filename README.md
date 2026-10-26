# team-sp1rt

Backend API for the Alfa Smart Credit client cabinet and employee review flow.
The React frontend is in `frontend/`; API contracts and data design are in
[`Api.md`](./Api.md), [`api.yaml`](./api.yaml), and [`DB.md`](./DB.md).

## Backend architecture

```text
app/
├── main.py                         # FastAPI app and router registration
├── api/
│   ├── dependencies.py             # JWT authentication and role checks
│   └── routes/
│       ├── auth.py
│       ├── applications.py
│       └── employee_applications.py
├── core/
│   ├── config.py                   # Required environment configuration
│   ├── errors.py                   # Shared API error responses
│   └── security.py                 # Password verification and JWT creation
├── db/
│   ├── base.py
│   └── session.py
├── integrations/                   # Server-selected FNS/BKI development mocks
├── models/                         # SQLAlchemy models, one per DB table
├── repositories/                   # Database queries
├── schemas/                        # Pydantic request/response DTOs
└── services/
    ├── application_service.py      # Atomic synchronous application workflow
    ├── credit_evaluation.py        # Explainable cash-flow scoring and offers
    └── auth_service.py

migrations/                         # Alembic schema migrations
tests/                              # API tests using an isolated SQLite DB
frontend/                           # React/Vite client and employee cabinets
```

Request flow: **route → service → repository/model → database**. Routes handle
HTTP and dependency injection, services enforce workflow and ownership rules,
repositories encapsulate queries, and Pydantic schemas define the API contract.
Only existing users can sign in; public registration is not exposed. Database
accounts and their `clients`/`employees` profiles are provisioned separately.
Submission, filling missing financial data, and technical retries run external
mocks and cash-flow scoring synchronously, saving checks, result, status,
and history in one database transaction. No worker or message broker is used.

## Run locally with Docker

1. Copy `.env.example` to `.env` and set unique local values for
   `POSTGRES_PASSWORD`, `JWT_SECRET`, and `TEST_USERS_PASSWORD`. Do not use the
   example values outside local development.
2. Start the database and API:

   ```powershell
   docker compose up --build
   ```

   The API container runs `alembic upgrade head` before starting Uvicorn.
   The API is available at `http://localhost:8000`; Swagger UI is at
   `http://localhost:8000/docs`.
3. Docker Compose creates six local test accounts at startup:
   `test.client1@example.com`, `test.client2@example.com`,
   `test.client3@example.com`, `demo.ip@example.com`, `test.employee1@example.com`, and
   `test.employee2@example.com`. The shared password is the value of
   `TEST_USERS_PASSWORD` in `.env` (the example file supplies a local-only
   password). There is intentionally no public registration route.
   Real client and employee accounts must still be provisioned through the
   trusted administrative process.

Test account seeding is enabled only in the Docker Compose configuration. It is
idempotent: existing seed accounts are preserved and are not reset to the
configured password. Do not use these accounts or the example password in a
production environment.

Uploaded documents are stored in the `uploaded_documents` Docker volume. Their
download URLs require a valid JWT and are accessible only to the owning client
or an employee.

## Run locally without Docker

Use Python 3.12 or newer:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:DATABASE_URL = "postgresql+psycopg2://user:password@localhost:5432/credit"
$env:JWT_SECRET = "a-long-random-local-secret"
alembic upgrade head
uvicorn app.main:app --reload
```

Set `UPLOAD_DIR` to a persistent local directory if the default
`storage/uploads` is unsuitable.

## Tests

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest
```

Tests use an isolated in-memory SQLite database and do not connect to the
development or production database.

## Credit demo

Sign in as `demo.ip@example.com` with `TEST_USERS_PASSWORD`. Request
`1000000.00` rubles for 24 months. Server-selected synthetic FNS/BKI data
produce an affordable counter-offer around 610,000 rubles, with the payment,
DSCR, rate and explanation saved in `scoring_result.offer`. See
[CREDIT_POLICY.md](./CREDIT_POLICY.md) for the demonstration rules.
