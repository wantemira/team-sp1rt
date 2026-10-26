# team-sp1rt

Backend API for the Alfa Smart Credit client cabinet and employee review flow.
Before integration, the React frontend lives on the existing `frontend-manager`
branch; run it from that checkout with `CREDIT_API_TARGET` pointing to this API.
The frontend will be in `frontend/` after integration. This branch's Compose
starts the database and API. API contracts and data design are in
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
3. Docker Compose creates seven local test accounts at startup:
   `test.client1@example.com`, `test.client2@example.com`,
   `test.client3@example.com`, `demo.ip@example.com`, `demo.review@example.com`, `test.employee1@example.com`, and
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

Optional PostgreSQL checks:

```powershell
$env:CREDIT_TEST_POSTGRES_URL = "postgresql+psycopg2://test_user:test_password@localhost:5432/credit_test"
python -m pytest -m postgres
```

Use a dedicated test database with permission to create schemas. These checks
create unique temporary schemas, apply every Alembic migration, run `alembic check`,
and verify concurrent signing and competing employee decisions. Their schemas
are removed afterward. Without this variable the PostgreSQL tests are skipped.
The initial verification used PostgreSQL 17; Compose currently targets 16.

## Credit demo

Sign in as `demo.ip@example.com` with `TEST_USERS_PASSWORD`. Request
`1000000.00` rubles for 24 months. Server-selected synthetic FNS/BKI data
produce an affordable counter-offer around 610,000 rubles, with the payment,
DSCR, rate and explanation saved in `scoring_result.offer`. See
[CREDIT_POLICY.md](./CREDIT_POLICY.md) for the demonstration rules.

For manual review, sign in as `demo.review@example.com` and request
`1000000.00` rubles for 24 months. The real demonstration calculation returns
a borderline score: current debt is absent, but prior delays and the industry
reduce the score. Sign in as `test.employee1@example.com` to approve, reject,
or request information. No scoring result is forced for this profile.
Run the idempotent seed again to add the account to an existing local database;
passwords of existing accounts are preserved.
