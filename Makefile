.DEFAULT_GOAL := help

PROJECT ?= team-sp1rt
ENV_FILE ?= .env
PYTHON ?= python3
NPM ?= npm
VENV ?= .venv
VENV_PYTHON = $(VENV)/bin/python
COMPOSE = docker compose --env-file "$(ENV_FILE)" -p "$(PROJECT)"

.PHONY: help init config up build start restart down reset-data ps logs health \
	migrate seed api-shell db-shell venv deps-api deps-web api-dev web-dev \
	lint test-api test-postgres test-web build-web install-browser test-ui \
	demo-api check check-all export-openapi

help: ## Показать команды
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

init: ## Создать файл окружения без перезаписи существующего
	@if [ -f "$(ENV_FILE)" ]; then printf 'Файл %s уже существует.\n' "$(ENV_FILE)"; else cp .env.example "$(ENV_FILE)"; printf 'Создан %s. Задайте POSTGRES_PASSWORD, JWT_SECRET и TEST_USERS_PASSWORD.\n' "$(ENV_FILE)"; fi

config: ## Проверить настройки Compose без вывода секретов
	@test -f "$(ENV_FILE)" || { printf 'Нет %s. Выполните make init.\n' "$(ENV_FILE)"; exit 1; }
	@$(COMPOSE) config --quiet

up: config ## Собрать и запустить всю систему, дождаться готовности
	$(COMPOSE) up --build -d --wait

build: config ## Собрать образы
	$(COMPOSE) build

start: config ## Запустить уже собранные образы
	$(COMPOSE) up --no-build -d --wait

restart: config ## Перезапустить сервисы
	$(COMPOSE) restart

down: config ## Остановить систему с сохранением БД и документов
	$(COMPOSE) down

reset-data: config ## Удалить контейнеры, БД и документы выбранного стенда
	$(COMPOSE) down -v

ps: config ## Показать состояние сервисов
	$(COMPOSE) ps

logs: config ## Смотреть последние логи; SERVICE=api ограничивает сервис
	$(COMPOSE) logs --tail=100 -f $(SERVICE)

health: config ## Проверить API, БД и доступность фронтенда
	$(COMPOSE) exec -T api python -c 'from urllib.request import urlopen; print(urlopen("http://127.0.0.1:8000/health/db", timeout=5).read().decode())'
	$(COMPOSE) exec -T frontend wget -q -O /dev/null http://127.0.0.1/

migrate: config ## Применить миграции работающего стенда
	$(COMPOSE) exec -T api alembic upgrade head

seed: config ## Добавить тестовые аккаунты без смены существующих паролей
	$(COMPOSE) exec -T api python -m app.seed_test_users

api-shell: config ## Открыть оболочку контейнера API
	$(COMPOSE) exec api sh

db-shell: config ## Открыть psql
	$(COMPOSE) exec db psql -U credit -d credit

venv: ## Создать локальную среду Python
	@test -x "$(VENV_PYTHON)" || $(PYTHON) -m venv "$(VENV)"

deps-api: venv ## Установить локальные рабочие и тестовые зависимости Python
	$(VENV_PYTHON) -m pip install -r requirements-dev.txt
	$(VENV_PYTHON) -m pip check

deps-web: ## Установить зависимости фронтенда по lock-файлу
	$(NPM) ci --prefix frontend

api-dev: ## Запустить локальный API; DATABASE_URL и JWT_SECRET берутся из окружения
	$(VENV_PYTHON) -m uvicorn app.main:app --reload

web-dev: ## Запустить Vite для разработки
	$(NPM) run dev --prefix frontend

lint: deps-web ## Проверить фронтенд линтером
	$(NPM) run lint --prefix frontend

test-api: config ## Проверить весь API, миграции и конкуренцию PostgreSQL
	$(COMPOSE) run --rm --no-deps api sh -c 'pip install --disable-pip-version-check -q -r requirements-dev.txt && pip check && CREDIT_TEST_POSTGRES_URL="$$DATABASE_URL" python -m pytest -q'

test-postgres: config ## Проверить только миграции и конкуренцию PostgreSQL
	$(COMPOSE) run --rm --no-deps api sh -c 'pip install --disable-pip-version-check -q -r requirements-dev.txt && CREDIT_TEST_POSTGRES_URL="$$DATABASE_URL" python -m pytest -q -m postgres'

test-web: deps-web ## Запустить модульные тесты фронтенда
	$(NPM) test --prefix frontend

build-web: deps-web ## Собрать фронтенд
	$(NPM) run build --prefix frontend

install-browser: deps-web ## Установить Chromium для браузерных тестов
	cd frontend && $(NPM) exec -- playwright install chromium

test-ui: config deps-web ## Проверить браузерные сценарии на работающем стенде
	@ENV_FILE="$(ENV_FILE)" node scripts/run-web-check.mjs ui

demo-api: config ## Выполнить коллекцию запросов через работающий Nginx
	@ENV_FILE="$(ENV_FILE)" node scripts/run-web-check.mjs collection

check: lint test-api test-web build-web ## Выполнить основные проверки после make up

check-all: check test-ui demo-api ## Проверить API, фронтенд, браузер и коллекцию после make up

export-openapi: config ## Обновить api.yaml по коду работающего API
	@tmp=$$(mktemp); trap 'rm -f "$$tmp"' EXIT; \
	$(COMPOSE) exec -T api python -c 'from app.main import app; import yaml; print("# Снимок FastAPI /openapi.json; обновление: docs/TEST_SCENARIOS.md"); print(yaml.safe_dump(app.openapi(), allow_unicode=True, sort_keys=False), end="")' > "$$tmp" && mv "$$tmp" api.yaml
