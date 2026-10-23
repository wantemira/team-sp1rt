# Структура backend и перенос кода

Этот документ объясняет, где теперь находится backend, как читать его
структуру и что было добавлено при переносе из
`C:\Programing\team-sp1rt-backend-auth-api`.

Исходный каталог не изменялся. Код в текущем репозитории приведён к выбранным
контрактам [Api.md](./Api.md) и [DB.md](./DB.md): вход только существующих
пользователей, роли `client` и `employee`, без публичной регистрации.

## Как устроен запрос

```text
HTTP-запрос
    ↓
app/api/routes/          HTTP-маршрут, параметры и авторизация
    ↓
app/services/            бизнес-правила и сценарий операции
    ↓
app/repositories/        запросы к базе данных
    ↓
app/models/              SQLAlchemy-модели таблиц
```

Схемы Pydantic из `app/schemas/` проверяют входные данные и задают формат
ответов. Настройки, безопасность и обработка ошибок находятся в `app/core/`,
подключение к БД — в `app/db/`.

## Куда распределён прежний код

| Было в исходном проекте | Где искать сейчас | Назначение |
|---|---|---|
| `main.py` | [app/main.py](./app/main.py) | Создание FastAPI-приложения и подключение маршрутов |
| `auth.py` | [app/api/routes/auth.py](./app/api/routes/auth.py), [app/services/auth_service.py](./app/services/auth_service.py), [app/core/security.py](./app/core/security.py), [app/api/dependencies.py](./app/api/dependencies.py) | Маршруты входа, проверка пользователя и пароля, JWT, контроль ролей |
| `api_applications.py` | [app/api/routes/applications.py](./app/api/routes/applications.py), [app/api/routes/employee_applications.py](./app/api/routes/employee_applications.py) | Клиентские и сотруднические HTTP-маршруты |
| `services.py` | [app/services/application_service.py](./app/services/application_service.py) | Создание и изменение заявок, решения сотрудников, работа с документами |
| `models.py` | Файлы в [app/models/](./app/models/) | Каждая модель вынесена отдельно и соответствует таблице БД |
| `schemas.py` | Файлы в [app/schemas/](./app/schemas/) | Отдельные схемы запросов и ответов авторизации, заявок и ошибок |
| `db.py` | [app/db/base.py](./app/db/base.py), [app/db/session.py](./app/db/session.py) | Базовый класс моделей, движок SQLAlchemy и сессии БД |
| `errors.py` | [app/core/errors.py](./app/core/errors.py) | Единый формат HTTP- и validation-ошибок |
| `config.py` | [app/core/config.py](./app/core/config.py) | Настройки из переменных окружения |

Разделение на маршруты, сервисы, репозитории, схемы и модели заменяет плоскую
структуру отдельных файлов. Например, обработчик HTTP не содержит SQL-запрос
или всю бизнес-логику: он передаёт управление соответствующему сервису.

## Модели базы данных

Файлы в [app/models/](./app/models/) описывают таблицы из `DB.md`:

| Таблица | Модель |
|---|---|
| `users` | [user.py](./app/models/user.py) |
| `clients` | [client.py](./app/models/client.py) |
| `employees` | [employee.py](./app/models/employee.py) |
| `applications` | [application.py](./app/models/application.py) |
| `application_status_history` | [application_status_history.py](./app/models/application_status_history.py) |
| `application_checks` | [application_check.py](./app/models/application_check.py) |
| `application_documents` | [application_document.py](./app/models/application_document.py) |

Например, [ApplicationCheck](./app/models/application_check.py) описывает
результат внешней проверки заявки: тип проверки, её статус и JSON с ответом
системы. Сам файл является моделью данных и не выполняет проверку автоматически.

## Что добавлено при переносе

- **Аутентификация существующих пользователей.** `POST /auth/login` проверяет
  пароль по `users.password_hash`, возвращает JWT и профиль. `GET /auth/me`
  возвращает текущего пользователя. Публичного endpoint регистрации нет.
- **Разграничение доступа.** Клиентские запросы разрешены только клиенту, а
  сотруднические — только сотруднику. Сервер определяет профиль клиента по
  авторизованному пользователю; `client_id` не принимается от клиента как
  доверенное значение.
- **API жизненного цикла заявки.** Добавлены создание и чтение заявки,
  дозаполнение после `NEEDS_INFO`, очередь и карточка сотрудника, а также
  действия `APPROVE`, `REJECT` и `REQUEST_INFO`.
- **Работа с файлами документов.** Загрузка идёт через `multipart/form-data`;
  файл хранится вне БД, а в таблицу записываются его метаданные. Скачивание
  проходит через защищённый маршрут и доступно владельцу заявки или сотруднику.
- **Единые ошибки API.** Ошибки возвращаются с полями `error_code`, `message`
  и `details`.
- **Миграции БД.** [migrations/versions/0001_initial_schema.py](./migrations/versions/0001_initial_schema.py)
  создаёт начальную схему таблиц; конфигурация Alembic находится в
  [alembic.ini](./alembic.ini) и [migrations/env.py](./migrations/env.py).
- **Запуск и тестирование.** Добавлены [Dockerfile](./Dockerfile),
  [docker-compose.yml](./docker-compose.yml), [.env.example](./.env.example),
  файлы зависимостей и [API-тесты](./tests/test_api.py) на изолированной SQLite.
- **Тестовые пользователи Docker.** При запуске Compose после миграций
  выполняется [app/seed_test_users.py](./app/seed_test_users.py): создаются
  три клиента и два сотрудника, если их ещё нет. Общий пароль задаётся
  переменной `TEST_USERS_PASSWORD`; повторный запуск не меняет пароли уже
  существующих аккаунтов.
- **Синхронизация API-документации.** Обновлены [Api.md](./Api.md) и
  [api.yaml](./api.yaml), в частности типы ID и маршрут защищённого скачивания.

## Остальные важные каталоги и файлы

- [app/repositories/](./app/repositories/) — получение пользователей, заявок,
  очереди и документов из БД.
- [app/schemas/](./app/schemas/) — проверка DTO входящих запросов и структура
  API-ответов.
- [tests/](./tests/) — API-тесты; база тестов изолирована от рабочей БД.
- [frontend/](./frontend/) — существующее React-приложение; backend не заменяет
  и не переносит frontend.
- [README.md](./README.md) — краткие инструкции по архитектуре, запуску и тестам.

В репозитории также могут оставаться старые каталоги `app/Endpoints` и
`app/Services` от прежней раскладки. Актуальные маршруты подключаются из
`app/api/routes/`; ориентируйтесь на структуру и файлы, указанные выше.
Публичные маршруты старого проекта, не входящие в выбранный контракт (например,
регистрация и операции draft/submit/sign), в новый API не переносились.

## Запуск и тесты

Подробные шаги находятся в [README.md](./README.md). Кратко:

```powershell
docker compose up --build
```

Либо после установки зависимостей:

```powershell
alembic upgrade head
uvicorn app.main:app --reload
python -m pytest
```
