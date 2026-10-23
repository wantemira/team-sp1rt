# API

**Базовый URL:** `http://localhost:8000/api/v1`  
**Формат данных:** JSON  
**Аутентификация:** существующие пользователи входят через `POST /auth/login`. Для защищённых эндпоинтов передавайте JWT в HTTP-заголовке `Authorization: Bearer <access_token>`.

Поля ниже записаны в формате `имя_поля (тип)`. Поля с пометкой «необязательное» не обязательны, если иное не указано.
Структура сверена с таблицами из [DB.md](./DB.md). Имена полей используют snake_case как в БД; тип и формат первичных ключей в описании БД не заданы, поэтому ID указан как строка без привязки к UUID.

## Аутентификация и авторизация

Регистрация через API не предусмотрена: в личный кабинет входят уже существующие клиенты и сотрудники, чьи учётные записи и профили заранее заведены в БД.

### Как устроен вход

1. Клиент или сотрудник отправляет `email` и пароль в `POST /auth/login`.
2. Сервер ищет пользователя в `users` по `email` и сравнивает пароль с `users.password_hash`. Хранится только стойкий хеш, не исходный пароль.
3. Сервер читает `users.role` и загружает связанный профиль: `clients` по `clients.user_id = users.id` либо `employees` по `employees.user_id = users.id`.
4. При успешной проверке сервер выдаёт JWT. Клиентское приложение сохраняет токен и отправляет его как `Authorization: Bearer <access_token>` при каждом защищённом запросе.
5. Сервер проверяет подпись, срок действия и роль токена до выполнения операции. Роль и профиль нельзя выбирать или менять через запрос.

Учётные записи и связи `users` ↔ `clients` / `employees` должны быть заведены до входа доверенным банковским процессом. API этого документа не создаёт пользователей и не меняет профиль клиента.

### POST `/auth/login` — Вход

Публичный эндпоинт, JWT не требуется. Сервер проверяет пароль по хешу из `users.password_hash` и получает роль из `users.role`. Для сотрудника профиль берётся из `employees`; для клиента — из `clients`.

**Запрос:**

- `email` (string, email) — обязательно
- `password` (string) — обязательно

**Успешный ответ — 200:**

- `access_token` (string, JWT)
- `token_type` (string; `Bearer`)
- `expires_in` (integer, секунды)
- `user` (object)
  - `id` (string, идентификатор `users.id`)
  - `email` (string)
  - `role` (string; `client` или `employee`)
- `client` (object или null) — профиль из `clients` для роли `client`
  - `id` (string, идентификатор `clients.id`)
  - `inn` (string)
  - `company_name` (string)
  - `client_type` (string)
- `employee` (object или null) — профиль из `employees` для роли `employee`
  - `id` (string, идентификатор `employees.id`)
  - `full_name` (string)
  - `position` (string)

**Ошибка:**

- **401** — неверные учётные данные; сообщение не должно раскрывать, существует ли указанный `email`; тело `ErrorResponse`.
- **500** — отсутствует ожидаемый связанный профиль (`clients` или `employees`); это ошибка целостности данных на сервере, а не причина автоматически создавать профиль.

### GET `/auth/me` — Текущий пользователь

Проверяет выданный токен и возвращает пользователя и профиль, связанные через `users.id` и `clients.user_id` либо `employees.user_id`. Нужен клиентскому приложению после входа/перезагрузки страницы, чтобы определить роль и показать правильный кабинет.

**Успешный ответ — 200:**

- `user` (object) — `id`, `email`, `role` из `users`
- `client` (object или null) — для роли `client`: `id`, `inn`, `company_name`, `client_type` из `clients`
- `employee` (object или null) — для роли `employee`: `id`, `full_name`, `position` из `employees`

Токен повторно не выдаётся.

**Ошибки:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.

### Проверка JWT и разграничение доступа

- `POST /auth/login` — публичный; остальные эндпоинты в этом документе требуют `Authorization: Bearer <access_token>`.
- Подпись и срок действия токена проверяются на каждом защищённом запросе. Подписанный токен должен содержать `sub` (значение `users.id`), `role` и срок действия `exp`; алгоритм подписи и время жизни задаются конфигурацией сервера.
- **401** — токен отсутствует, недействителен или просрочен.
- **403** — токен действителен, но `users.role` не даёт доступа к эндпоинту.
- При создании заявки сервер находит профиль по `clients.user_id` из авторизованного `users.id`, а не принимает `client_id` от клиента. Клиент может читать и менять только заявки, у которых `applications.client_id` связан с его профилем.
- Для сотрудника сервер использует профиль `employees` по `employees.user_id`; эндпоинты сотрудника проверяют `users.role = employee`.
- Никогда не возвращайте и не принимайте `password_hash` через API; пароли хешируйте стойким алгоритмом на сервере.
- Отдельный logout для stateless JWT не предусмотрен: клиент удаляет токен. Если требуется досрочное отозвание токенов, понадобится механизм отзыва/хранения сессий, которого сейчас нет в БД.

### Откуда берутся данные

- `users` — данные входа и права: `id`, `email`, `password_hash`, `role`, `created_at`. `password_hash` используется только сервером для проверки пароля и никогда не возвращается.
- `clients` — бизнес-профиль действующего клиента: `id`, `user_id`, `inn`, `company_name`, `client_type`, `created_at`.
- `employees` — профиль банковского сотрудника: `id`, `user_id`, `full_name`, `position`, `created_at`.
- Входящий запрос содержит только поля, которые пользователь вводит или изменяет. Связи с пользователем/клиентом, роли, статусы обработки, скоринговые результаты и даты выставляет сервер; идентификаторы внешних ключей нельзя принимать от клиента как доказательство доступа.
- `applications` — входные параметры заявки (`product_type`, `requested_amount`, `requested_term_months`, `purpose`) и введённые клиентом дополнительные финансовые сведения (`business_data`).
- `application_checks` — серверные результаты проверок внешних и внутренних источников (`check_type`, `status`, `response_data`); например, ответ БКИ или сведения о компании из ФНС/ЕГРЮЛ/ЕГРИП. Клиент эти результаты не передаёт.
- `application_documents` — метаданные файлов (`document_type`, `file_url`, `status`); сами файлы хранятся во внешнем файловом/объектном хранилище, ссылка на файл сохраняется в БД.
- `application_status_history` — серверная история смены статусов; сотрудник передаёт `comment` при действии по заявке, а `previous_status`, `new_status`, `changed_by` и `created_at` формирует сервер.

## Клиентские эндпоинты

Для кредитной заявки клиент указывает продукт, сумму, срок, цель и дополнительные бизнес-данные. Сервер связывает её с профилем вошедшего клиента, выполняет проверки и скоринг, затем возвращает текущий статус. Результатом рассмотрения могут быть условия финансирования, запрос дополнительных данных/документов или отказ. Набор проверок и необходимых документов может зависеть от продукта и клиента.

### POST `/applications` — Создание и подача кредитной заявки

**Запрос (`CreateApplicationRequest`):**

- `product_type` (string; `credit_line`, `overdraft` или `term_loan`) — обязательно
- `requested_amount` (number) — обязательно
- `requested_term_months` (integer) — обязательно
- `purpose` (string) — необязательно
- `business_data` (object, JSON) — обязательно; произвольные бизнес-данные, хранящиеся в `applications.business_data`

`client_id` берётся сервером из профиля `clients`, найденного по ID вошедшего пользователя. `inn`, `company_name` и `client_type` хранятся в профиле `clients`, а не в теле этой заявки. `business_data` предназначен только для дополнительных финансовых и бизнес-сведений, нужных для оценки заявки; он сохраняется в `applications.business_data`.

Пример JSON-запроса (ключи внутри `business_data` — пример структуры данных, а не отдельные столбцы БД):

```json
{
  "product_type": "credit_line",
  "requested_amount": 1500000,
  "requested_term_months": 12,
  "purpose": "Пополнение оборотных средств",
  "business_data": {
    "financials": {
      "annual_revenue": 5000000,
      "monthly_expenses": 300000
    },
    "existing_obligations": []
  }
}
```

Данные, которые банк получает из внешних источников (например, кредитная история или сведения ФНС/ЕГРЮЛ/ЕГРИП), получает сервер и хранит в `application_checks.response_data`, а не принимает от клиента как проверенный результат.

**Успешный ответ — 201 (`ApplicationStatusResponse`):**

- `id` (string, идентификатор `applications.id`)
- `product_type` (string)
- `requested_amount` (number)
- `requested_term_months` (integer)
- `purpose` (string или null)
- `status` (string; `DRAFT`, `CHECKING`, `NEEDS_INFO`, `MANUAL_REVIEW`, `APPROVED` или `REJECTED`)
- `business_data` (object, JSON)
- `score` (integer или null)
- `risk_grade` (string или null; `A`, `B`, `C`, `D` или `E`)
- `decision_reason_code` (string или null)
- `approved_amount` (number или null)
- `approved_rate` (number или null)
- `created_at` (string, date-time)
- `updated_at` (string, date-time)
- `documents` (array of object) — прикреплённые к заявке документы, их статус указан сервером
  - `id` (string, идентификатор `application_documents.id`)
  - `document_type` (string)
  - `file_url` (string, ссылка на файл во внешнем хранилище)
  - `status` (string; `PENDING`, `VERIFIED` или `REJECTED`)
  - `created_at` (string, date-time)
- `status_history` (array of object) — история из `application_status_history`; комментарий последнего перехода поясняет, какую дополнительную информацию запросил банк
  - `id` (string, идентификатор `application_status_history.id`)
  - `previous_status` (string или null)
  - `new_status` (string)
  - `changed_by` (string; `CLIENT`, `SYSTEM` или `EMPLOYEE`)
  - `comment` (string или null)
  - `created_at` (string, date-time)

**Ошибки:**

- **400** — ошибка валидации; тело `ErrorResponse`:
  - `error_code` (string)
  - `message` (string)
  - `details` (object или null)
- **401** — пользователь не авторизован; тело `ErrorResponse`.
- **403** — токен действителен, но профиль пользователя не является клиентским; тело `ErrorResponse`.
- **422** — недостаточно данных; тело `ApplicationStatusResponse`.

### GET `/applications/{id}` — Получение статуса заявки

**Параметры:**

- `id` (string, идентификатор `applications.id`; path) — обязательно

**Успешный ответ — 200:** `ApplicationStatusResponse` (поля перечислены выше).

**Ошибка:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — пользователь не является клиентом; тело `ErrorResponse`.
- **404** — заявка не найдена или недоступна текущему клиенту; тело `ErrorResponse`:
  - `error_code` (string)
  - `message` (string)
  - `details` (object или null)

### PATCH `/applications/{id}/fill` — Дозаполнение данных по заявке

**Параметры:**

- `id` (string, идентификатор `applications.id`; path) — обязательно

**Запрос (`application/json`):** передавайте бизнес-данные, которых не хватает. Они дополняют JSON-поле `applications.business_data`:

- `business_data` (object, JSON) — необязательное обновление бизнес-данных

Документы загружаются отдельно через `POST /applications/{id}/documents`. `file_url` и `status` не передаются при дозаполнении: ссылку на сохранённый файл и статус документа назначает сервер.

**Успешный ответ — 200:** `ApplicationStatusResponse` (поля перечислены выше). В ответе `business_data` содержит обновлённые данные; список документов и их статусы также возвращаются в `documents`.

**Ошибки:**

- **400** — неверный формат данных; тело `ErrorResponse`:
  - `error_code` (string)
  - `message` (string)
  - `details` (object или null)
- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — пользователь не является владельцем заявки или не является клиентом; тело `ErrorResponse`.
- **409** — заявка не находится в статусе `NEEDS_INFO`; тело `ErrorResponse`:
  - `error_code` (string)
  - `message` (string)
  - `details` (object или null)

### POST `/applications/{id}/documents` — Загрузка документа к заявке

Используется, когда клиенту нужно приложить запрошенный документ или оформить одобренное финансирование. Доступна только владельцу заявки; документ загружается отдельным запросом, не как URL в JSON.

**Параметры:**

- `id` (string, идентификатор `applications.id`; path) — обязательно

**Запрос (`multipart/form-data`):**

- `document_type` (string) — обязательно; например, `charter` или `financial_report`
- `file` (binary) — обязательно; содержимое файла

Сервер сохраняет файл в файловом/объектном хранилище, а запись `application_documents` — в БД. `file_url`, `status` и `created_at` назначает сервер. Клиенту нельзя передавать `file_url` напрямую или выбирать статус документа.

**Успешный ответ — 201 (`ApplicationDocument`):**

- `id` (string, идентификатор `application_documents.id`)
- `document_type` (string)
- `file_url` (string, ссылка на сохранённый файл)
- `status` (string; `PENDING`, `VERIFIED` или `REJECTED`)
- `created_at` (string, date-time)

**Ошибки:**

- **401** — нет действительного токена; тело `ErrorResponse`.
- **403** — заявка принадлежит другому клиенту или у пользователя нет роли `client`; тело `ErrorResponse`.
- **404** — заявка не найдена или недоступна текущему клиенту; тело `ErrorResponse`.
- **409** — заявка закрыта отказом и больше не принимает документы; тело `ErrorResponse`.
- **413** — файл превышает настроенный сервером предел размера; тело `ErrorResponse`.

## Эндпоинты сотрудника

### GET `/employee/applications` — Очередь заявок на ручной разбор

**Параметры:**

- `status` (string; `MANUAL_REVIEW`, `CHECKING` или `NEEDS_INFO`; query) — необязательно, по умолчанию `MANUAL_REVIEW`

**Успешный ответ — 200:** массив `EmployeeApplicationShort`:

- `id` (string, идентификатор `applications.id`)
- `company_name` (string; из `clients.company_name`)
- `requested_amount` (number)
- `risk_grade` (string)
- `status` (string)
- `created_at` (string, date-time)

**Ошибка:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — доступ запрещён (нет роли `employee`); тело `ErrorResponse`.

### GET `/employee/applications/{id}` — Карточка заявки

**Параметры:**

- `id` (string, идентификатор `applications.id`; path) — обязательно

**Успешный ответ — 200 (`EmployeeApplicationDetail`):**

- `id` (string, идентификатор `applications.id`)
- `status` (string)
- `client_id` (string, внешний ключ `applications.client_id`)
- `client` (object)
  - `id` (string, идентификатор `clients.id`)
  - `inn` (string; `clients.inn`)
  - `company_name` (string; `clients.company_name`)
  - `client_type` (string; `INDIVIDUAL` или `LEGAL_ENTITY`)
- `product_type` (string)
- `requested_amount` (number)
- `requested_term_months` (integer)
- `purpose` (string или null)
- `business_data` (object, JSON)
- `score` (integer или null)
- `risk_grade` (string или null; `A`, `B`, `C`, `D` или `E`)
- `decision_reason_code` (string или null)
- `approved_amount` (number или null)
- `approved_rate` (number или null)
- `checks` (array of object; записи `application_checks`)
  - `id` (string, идентификатор `application_checks.id`)
  - `check_type` (string; `FNS` или `BKI`)
  - `status` (string; `SUCCESS`, `TIMEOUT` или `ERROR`)
  - `response_data` (object, JSON)
  - `created_at` (string, date-time)
- `documents` (array of object; записи `application_documents`)
  - `id` (string, идентификатор `application_documents.id`)
  - `document_type` (string)
  - `file_url` (string)
  - `status` (string; `PENDING`, `VERIFIED` или `REJECTED`)
  - `created_at` (string, date-time)
- `status_history` (array of object)
  - `id` (string, идентификатор `application_status_history.id`)
  - `previous_status` (string или null)
  - `new_status` (string)
  - `changed_by` (string; `CLIENT`, `SYSTEM` или `EMPLOYEE`)
  - `comment` (string)
  - `created_at` (string, date-time)

**Ошибка:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — доступ запрещён (нет роли `employee`); тело `ErrorResponse`.
- **404** — заявка не найдена; тело `ErrorResponse`.

### POST `/employee/applications/{id}/action` — Действие сотрудника по заявке

**Параметры:**

- `id` (string, идентификатор `applications.id`; path) — обязательно

**Запрос (`EmployeeActionRequest`):**

- `action` (string; `APPROVE`, `REJECT` или `REQUEST_INFO`) — обязательно
- `decision_reason_code` (string) — необязательно; требуется для `REJECT` и `REQUEST_INFO`; сохраняется в `applications.decision_reason_code`
- `approved_amount` (number) — необязательно; сохраняется в `applications.approved_amount`
- `approved_rate` (number) — необязательно; сохраняется в `applications.approved_rate`
- `comment` (string) — необязательно

Статус и комментарий действия фиксируются в `application_status_history`; `changed_by` определяется сервером по роли пользователя.

**Успешный ответ — 200:** `ApplicationStatusResponse` (поля перечислены выше).

**Ошибка:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — доступ запрещён (нет роли `employee`); тело `ErrorResponse`.
- **404** — заявка не найдена; тело `ErrorResponse`.
- **400** — некорректное действие (например, попытка одобрить уже отклонённую заявку); тело `ErrorResponse`:
  - `error_code` (string)
  - `message` (string)
  - `details` (object или null)
