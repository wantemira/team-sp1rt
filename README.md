# team-sp1rt

Единый прототип кредитного кабинета: React/Vite для клиента и сотрудника,
FastAPI для кредитного процесса, PostgreSQL для хранения. Актуальные ветки
`API` и `frontend-manager` объединены в `main` с сохранением истории.
Внешние проверки ФНС/БКИ, подписание и выдача смоделированы;
финансовые показатели синтетические, сумма и ставка рассчитываются сервером.

Документы: [API](./Api.md), [обзорный OpenAPI](./api.yaml),
[кредитная политика](./CREDIT_POLICY.md), [фронтенд](./frontend/README.md).
Точная схема работающего сервера доступна на `/openapi.json`.

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
2. Start PostgreSQL, API and frontend/Nginx:

   ```powershell
   docker compose up --build -d --wait
   ```

   The API container runs `alembic upgrade head` before starting Uvicorn.
   Open the application at `http://localhost:8080`. Nginx serves the built
   frontend and forwards `/api/` to `api:8000` in the Compose network. Services
   wait for database/API readiness. Swagger UI is at `http://localhost:8000/docs`.
   `WEB_PORT`, `API_PORT` and `DB_PORT` override the default host ports
   8080, 8000 and 5432. Published ports bind to the local machine.
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

## Restart and stop

```bash
docker compose restart
docker compose down
# Resume using the same .env and volumes:
docker compose up --build -d --wait
```

Database records and document files persist in named volumes. `down -v`
deletes those volumes and is only appropriate for discarding a test stand.

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
`storage/uploads` is unsuitable. To add synthetic accounts without Compose,
set `SEED_TEST_USERS=true` and `TEST_USERS_PASSWORD`, then run
`python -m app.seed_test_users` after migrations.

In another terminal run the frontend from this same checkout:

```bash
cd frontend
npm ci
npm run dev
```

The development UI is at `http://localhost:5173`. Vite forwards `/api` to
`http://localhost:8000`; set `CREDIT_API_TARGET` for a different API address.
Frontend requirements and browser tests are in [frontend/README.md](./frontend/README.md).

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
The merged application is checked on PostgreSQL 16, matching the Compose configuration.

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

The main demo: create the request, view the counter-offer, click
«Согласен с предложением», confirm it, then reload the page. The agreed
conditions remain saved. `test.client2@example.com` demonstrates a stop-factor
rejection. `test.client3@example.com` demonstrates an initial FNS timeout,
an employee retry and requested financial information.

## Frontend checks

```bash
npm ci --prefix frontend
npm run lint --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
```

Browser tests require a separately seeded test API and create synthetic
applications/documents. See [frontend/README.md](./frontend/README.md) for the
password and browser configuration. Do not run them against valuable data.

## Проверка объединённой версии

Общий Docker-стенд проверен на Python 3.12 / PostgreSQL 16: 106 API-тестов,
19 модульных тестов фронтенда, линтер и сборка, 17 браузерных сценариев через
production Nginx. После `down` и повторного `up` с сохранением томов проверены
черновик, принятые условия, история выдачи и исходные байты документа больше
1 МиБ. Редкие конфликты в части браузерных тестов используют подмену ответов;
основной путь, документы и ручное одобрение проходят через работающий API.
