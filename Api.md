# API

**Базовый URL:** `http://localhost:8000/api/v1`  
**Формат данных:** JSON. Точная схема: `/openapi.json` и её снимок [api.yaml](./api.yaml).
[Коллекция запросов и проверка](./docs/TEST_SCENARIOS.md).
**Аутентификация:** существующие пользователи входят через `POST /auth/login`. Для защищённых эндпоинтов передавайте JWT в HTTP-заголовке `Authorization: Bearer <access_token>`.

Поля ниже записаны в формате `имя_поля (тип)`. Поля с пометкой «необязательное» не обязательны, если иное не указано.
Структура сверена с таблицами из [DB.md](./DB.md). Имена полей используют snake_case как в БД. В текущей реализации первичные ключи — целые числа; при миграции существующей БД используйте её фактический тип ID.

## Продукт MVP

- `product_type`: `term_loan`
- Название: `Кредит на оборотные средства`
- Сумма: от `100000.00` до `5000000.00` рублей
- Срок: `6`, `12` или `24` месяца
- Выдача одна, срок фиксированный, платежи аннуитетные
- Денежные значения в JSON передаются строками рублей, например `"1500000.00"`;
  в БД суммы хранятся как `Numeric`, расчёты выполняются через `Decimal`.

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
  - `id` (integer, идентификатор `users.id`)
  - `email` (string)
  - `role` (string; `client` или `employee`)
- `client` (object или null) — профиль из `clients` для роли `client`
  - `id` (integer, идентификатор `clients.id`)
  - `inn` (string)
  - `company_name` (string)
  - `client_type` (string)
- `employee` (object или null) — профиль из `employees` для роли `employee`
  - `id` (integer, идентификатор `employees.id`)
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

- `POST /auth/login` и `GET /products` — публичные; остальные эндпоинты в этом документе требуют `Authorization: Bearer <access_token>`.
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
- `applications` — входные параметры заявки (`product_type`, `requested_amount`, `requested_term_months`, `purpose`), финансовые сведения (`business_data`) и результат расчета (`scoring_result`, полный JSON расчета; параллельно сохраняются `score`, `risk_grade`, `approved_amount`, `approved_rate`).
- `application_checks` — серверные результаты проверок внешних и внутренних источников (`check_type`, `status`, `response_data`); клиент их не передаёт. Для ФНС в `response_data` хранятся `is_active` (boolean или null) и `business_age_months` (integer или null), для БКИ — `current_overdue_days` (integer или null) и `monthly_debt_payments` (string рублей или null). У каждой попытки проверки создаётся отдельная запись.
- `application_documents` — метаданные файлов (`document_type`, `file_url`, `status`); сами файлы хранятся во внешнем файловом/объектном хранилище, ссылка на файл сохраняется в БД.
- `application_status_history` — серверная история смены статусов; сотрудник передаёт `comment` при действии по заявке, а `previous_status`, `new_status`, `changed_by` и `created_at` формирует сервер.

## Клиентские эндпоинты

Клиент создаёт заявку-черновик, может редактировать её, пока она находится в статусе `DRAFT`, а затем отдельным запросом отправляет на проверку. При обработке результатом могут быть условия финансирования, запрос дополнительных данных/документов или отказ.

### GET `/products` — Доступный продукт

Публичный маршрут возвращает единственный продукт MVP:

- `id` (string; `term_loan`)
- `name` (string; `Кредит на оборотные средства`)
- `min_amount` (string рублей; `"100000.00"`)
- `max_amount` (string рублей; `"5000000.00"`)
- `terms` (array of integer; `[6, 12, 24]`)
- `disbursement_count` (integer; `1`)
- `term_type` (string; `fixed`)
- `repayment_type` (string; `annuity`)

Условия продукта: одна выдача, фиксированный срок, аннуитетные платежи.

### POST `/applications` — Создание черновика заявки

**Запрос (`CreateApplicationRequest`):**

- `product_type` (string; только `term_loan`) — обязательно
- `requested_amount` (string или null) — необязательно; при заполнении от 100000.00 до 5000000.00 рублей
- `requested_term_months` (integer или null; `6`, `12` или `24`) — необязательно
- `purpose` (string) — необязательно
- `business_data` (object, JSON) — необязательно; при отсутствии финансовых данных сервер сохранит `{"financials": {}}`

Для создания достаточно передать:

```json
{"product_type": "term_loan"}
```

`client_id` берётся сервером из профиля `clients`, найденного по ID вошедшего пользователя. При создании заявка получает статус `DRAFT`. Отсутствующие сумма и срок хранятся как `null`; для отсутствующих финансовых показателей не подставляются нули. Данные внешних проверок сервер хранит в `application_checks.response_data`.

**Успешный ответ — 201 (`ApplicationResponse`):** заявка с `status = DRAFT`, `version = 1`; `requested_amount` и `requested_term_months` могут быть `null`; `business_data` по умолчанию равен `{"financials": {}}`. Первая запись истории создаётся вместе с черновиком: `previous_status = null`, `new_status = DRAFT`, `changed_by = CLIENT`.

**Ошибки:**

- **422** — ошибка проверки входных данных; тело `ErrorResponse`:
  - `error_code` (string)
  - `message` (string)
  - `details` (object или null)
- **401** — пользователь не авторизован; тело `ErrorResponse`.
- **403** — токен действителен, но профиль пользователя не является клиентским; тело `ErrorResponse`.

### GET `/applications` — Список заявок клиента

Возвращает все заявки, принадлежащие профилю текущего клиента, включая черновики. Чужие заявки не возвращаются.

**Успешный ответ — 200:** массив `ApplicationResponse`; если заявок нет, возвращается пустой массив.

**Ошибки:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — пользователь не является клиентом; тело `ErrorResponse`.

### GET `/applications/{id}` — Получение статуса заявки

**Параметры:**

- `id` (integer, идентификатор `applications.id`; path) — обязательно

**Успешный ответ — 200:** `ApplicationResponse` (поля перечислены выше).

**Ошибка:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — пользователь не является клиентом; тело `ErrorResponse`.
- **404** — заявка не найдена или недоступна текущему клиенту; тело `ErrorResponse`:
  - `error_code` (string)
  - `message` (string)
  - `details` (object или null)

### PATCH `/applications/{id}` — Редактирование черновика заявки

Редактировать можно только собственную заявку в статусе `DRAFT`. Передавайте последнюю полученную `version`; после каждого изменения сервер увеличивает её. Обновление не меняет статус и не создаёт новую запись истории статусов.

**Параметр пути:**

- `id` (integer, идентификатор `applications.id`) — обязательно

**Запрос (`application/json`):**

- `version` (integer) — обязательно; версия из последнего ответа
- `requested_amount` (string или null) — необязательно
- `requested_term_months` (integer или null; `6`, `12` или `24`) — необязательно
- `purpose` (string или null) — необязательно
- `business_data` (object) — необязательно; финансовые показатели `annual_revenue` и `annual_expenses` могут оставаться незаполненными

**Успешный ответ — 200:** обновлённый `ApplicationResponse` со статусом `DRAFT` и новой `version`.

**Ошибки:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — пользователь не является клиентом; тело `ErrorResponse`.
- **404** — заявка не найдена или принадлежит другому клиенту; тело `ErrorResponse`.
- **409** — заявка не в статусе `DRAFT` или `version` устарела; тело `ErrorResponse`.
- **422** — неверный формат или ограничения полей запроса; тело `ErrorResponse`.

### POST `/applications/{id}/submit` — Отправка заявки на проверку

Отдельное действие для кнопки отправки. Сумма должна быть от 100 000 до 5 000 000 рублей, срок — 6, 12 или 24 месяца. После проверки версии и состояния сервер синхронно вызывает моки ФНС/БКИ и `evaluate_credit`. Проверки, score, итоговый статус и обе записи истории (`DRAFT → CHECKING → результат`) сохраняются одной транзакцией.

Недоступность внешней проверки приводит к `MANUAL_REVIEW`, а не кредитному отказу. После успешных проверок недостающие финансовые данные запрашиваются через `NEEDS_INFO`. Пять факторов, PD, ставка и максимальная безопасная сумма рассчитываются по [демонстрационной политике](./CREDIT_POLICY.md). Итоговый DSCR не ниже 1.35; предложение и объяснение сохраняются в `scoring_result.offer`, сумма и ставка также в отдельных полях. Доступно полное одобрение и counter-offer.

**Параметры:**

- `id` (integer, идентификатор `applications.id`; path) — обязательно
- Тело `application/json`: `{"version": 2}` — обязательно; текущая положительная
  целочисленная версия заявки. Legacy query `?version=2` временно поддерживается.

**Успешный ответ — 200:** карточка `ApplicationResponse` с итоговым статусом, увеличенной версией, результатами `checks` и историей переходов. `CHECKING` является промежуточным состоянием в той же транзакции и виден в истории.

**Ошибки:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — пользователь не является клиентом; тело `ErrorResponse`.
- **404** — заявка не найдена или принадлежит другому клиенту; тело `ErrorResponse`.
- **409** — заявка не в статусе `DRAFT` или `version` устарела; тело `ErrorResponse`.
- **422** — сумма или срок отсутствуют либо не соответствуют ограничениям продукта; тело `ErrorResponse`.

Ответ `ApplicationResponse` содержит `version` (integer). Передавайте актуальное значение этой версии при следующем изменении заявки или действии сотрудника.

`version` начинается с `1` и атомарно увеличивается при каждом изменении заявки. Обновление использует optimistic locking в БД: если другая операция уже изменила ту же версию, запрос возвращает `409`. `next_actions` рассчитывается сервером для роли текущего пользователя и текущего состояния:

- `DRAFT`, клиент: `EDIT`, `SUBMIT`
- `NEEDS_INFO`, клиент: `FILL`
- `MANUAL_REVIEW` после кредитного скоринга, сотрудник: `APPROVE`, `REJECT`, `REQUEST_INFO`
- `MANUAL_REVIEW` при сбое, неполных или некорректных данных источников, сотрудник: `RETRY_CHECKS`
- `APPROVED`, клиент: `SIGN`
- остальные сочетания роли и состояния: пустой список

`scoring_result` в карточке заявки — серверный JSON полного последнего расчета, включая модель, итог, входные финансовые данные и ответы проверок, факторы и причину. Его нельзя передавать в запросах. Поля `score`, `risk_grade`, `approved_amount` и `approved_rate` также сохраняются отдельно.

### POST `/applications/{id}/fill` — Заполнение запрошенных данных

Доступен владельцу заявки только в состоянии `NEEDS_INFO`. Принимает актуальную `version` и проверяет, что заполнены все поля из `missing_fields` в карточке заявки. Не передавайте для запрошенного поля `null`: денежные значения должны быть корректными строками рублей. Сервер дополняет `business_data`, очищает выполненный запрос информации, синхронно повторяет ФНС/БКИ и полный расчет; проверки, результат, статус и история сохраняются одной транзакцией. Итогом может быть `NEEDS_INFO`, `MANUAL_REVIEW`, `APPROVED` или `REJECTED`.

**Запрос (`application/json`):**

- `version` (integer) — обязательно
- `business_data` (object) — обязательно
  - `financials` (object) — обязательно
    - `annual_revenue` (string или null) — сумма в рублях; обязательна, если указана в `missing_fields`
    - `annual_expenses` (string или null) — сумма в рублях; обязательна, если указана в `missing_fields`

**Успешный ответ — 200:** обновлённая карточка `ApplicationResponse`.

**Ошибки:**

- **401** — нет действительного токена.
- **403** — пользователь не является клиентом.
- **404** — заявка отсутствует или принадлежит другому клиенту.
- **409** — заявка не в статусе `NEEDS_INFO` или версия устарела.
- **422** — нет финансовых данных или некорректное значение.

### POST `/applications/{id}/sign` — Подписание и выдача

Клиент-владелец может подписать только одобренную заявку (`APPROVED`), передав текущую целочисленную `version` в JSON-теле, например `{"version": 2}`. В одной транзакции сервер переводит её в `ISSUED`, записывает время имитации подписания и выдачи (`signed_at`, `issued_at`) и переход `APPROVED → ISSUED` в историю. Это демонстрационная фиксация; реальная электронная подпись и перевод денег не интегрированы. Отдельного статуса `SIGNED` нет.

**Ошибки:** `401` — нет токена; `403` — нет роли клиента; `404` — заявка отсутствует/чужая; `409` — заявка не одобрена или версия устарела.

### POST `/applications/{id}/documents` — Загрузка документа к заявке

Используется, когда клиенту нужно приложить запрошенный документ или оформить одобренное финансирование. Доступна только владельцу заявки; документ загружается отдельным запросом, не как URL в JSON.

**Параметры:**

- `id` (integer, идентификатор `applications.id`; path) — обязательно

**Запрос (`multipart/form-data`):**

- `document_type` (string) — обязательно; например, `charter` или `financial_report`
- `file` (binary) — обязательно; содержимое файла

Сервер сохраняет файл в файловом/объектном хранилище, а запись `application_documents` — в БД. `file_url`, `status` и `created_at` назначает сервер. Клиенту нельзя передавать `file_url` напрямую или выбирать статус документа.

**Успешный ответ — 201 (`ApplicationDocument`):**

- `id` (integer, идентификатор `application_documents.id`)
- `document_type` (string)
- `file_url` (string, ссылка на сохранённый файл)
- `status` (string; `PENDING`, `VERIFIED` или `REJECTED`)
- `created_at` (string, date-time)

**Ошибки:**

- **401** — нет действительного токена; тело `ErrorResponse`.
- **403** — заявка принадлежит другому клиенту или у пользователя нет роли `client`; тело `ErrorResponse`.
- **404** — заявка не найдена или недоступна текущему клиенту; тело `ErrorResponse`.
- **409** — заявка закрыта отказом и больше не принимает документы; тело `ErrorResponse`.
- **413** — файл превышает настроенный сервером предел размера (по умолчанию 10 MiB); тело `ErrorResponse`.

### GET `/applications/{id}/documents/{document_id}/file` — Скачивание документа

Защищённый эндпоинт выдаёт файл только владельцу заявки или пользователю с ролью `employee`. Путь файла берётся из серверного хранилища по записи `application_documents`; переданный клиентом путь не используется.

**Параметры:**

- `id` (integer, идентификатор `applications.id`; path) — обязательно
- `document_id` (integer, идентификатор `application_documents.id`; path) — обязательно

**Успешный ответ — 200:** бинарное содержимое файла (`application/octet-stream`).

**Ошибки:**

- **401** — нет действительного токена; тело `ErrorResponse`.
- **403** — пользователь не владелец заявки и не сотрудник; тело `ErrorResponse`.
- **404** — заявка/документ не найдены или файл отсутствует в файловом хранилище; тело `ErrorResponse`.

## Эндпоинты сотрудника

### GET `/employee/applications` — Очередь заявок на ручной разбор

**Параметры:**

- `status` (string; `MANUAL_REVIEW`, `CHECKING`, `NEEDS_INFO`, `APPROVED`, `REJECTED` или `ISSUED`; query) — необязательно, по умолчанию `MANUAL_REVIEW`

**Успешный ответ — 200:** массив `EmployeeApplicationShort`:

- `id` (integer, идентификатор `applications.id`)
- `company_name` (string; из `clients.company_name`)
- `requested_amount` (string или null; рубли)
- `risk_grade` (string или null)
- `status` (string)
- `created_at` (string, date-time)

**Ошибка:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — доступ запрещён (нет роли `employee`); тело `ErrorResponse`.

### GET `/employee/applications/{id}` — Карточка заявки

**Параметры:**

- `id` (integer, идентификатор `applications.id`; path) — обязательно

**Успешный ответ — 200 (`EmployeeApplicationDetail`):**

- `id` (integer, идентификатор `applications.id`)
- `status` (string)
- `version` (integer; передаётся в действиях сотрудника)
- `created_at` (string, date-time)
- `updated_at` (string, date-time)
- `client_id` (integer, внешний ключ `applications.client_id`)
- `client` (object)
  - `id` (integer, идентификатор `clients.id`)
  - `inn` (string; `clients.inn`)
  - `company_name` (string; `clients.company_name`)
  - `client_type` (string; `INDIVIDUAL` или `LEGAL_ENTITY`)
- `product_type` (string; `term_loan`)
- `requested_amount` (string или null; сумма в рублях)
- `requested_term_months` (integer или null)
- `purpose` (string или null)
- `business_data` (object, JSON)
- `score` (integer или null)
- `risk_grade` (string или null; `A`, `B`, `C`, `D` или `E`)
- `decision_reason_code` (string или null)
- `scoring_result` (object JSON или null; полный результат расчета с входными данными и факторами)
- `approved_amount` (string или null; рубли)
- `approved_rate` (number или null)
- `signed_at` (string date-time или null; время имитации подписания)
- `issued_at` (string date-time или null; время имитации выдачи)
- `missing_fields` (array of string; поля, запрошенные у клиента)
- `info_comment` (string или null; комментарий к запросу информации)
- `version` (integer; начальное значение `1`, атомарно увеличивается при каждом изменении)
- `next_actions` (array of string; зависит от роли и статуса текущего пользователя)
- `checks` (array of object; записи `application_checks`)
  - `id` (integer, идентификатор `application_checks.id`)
  - `check_type` (string; `FNS` или `BKI`)
  - `status` (string; `SUCCESS`, `TIMEOUT` или `ERROR`)
  - `response_data` (object, JSON)
  - `created_at` (string, date-time)
- `documents` (array of object; записи `application_documents`)
  - `id` (integer, идентификатор `application_documents.id`)
  - `document_type` (string)
  - `file_url` (string)
  - `status` (string; `PENDING`, `VERIFIED` или `REJECTED`)
  - `created_at` (string, date-time)
- `status_history` (array of object)
  - `id` (integer, идентификатор `application_status_history.id`)
  - `previous_status` (string или null)
  - `new_status` (string)
  - `changed_by` (string; `CLIENT`, `SYSTEM` или `EMPLOYEE`)
  - `changed_by_user_id` (integer или null; ID пользователя, выполнившего переход, для `SYSTEM` — `null`)
  - `comment` (string или null)
  - `created_at` (string, date-time)

**Ошибка:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — доступ запрещён (нет роли `employee`); тело `ErrorResponse`.
- **404** — заявка не найдена; тело `ErrorResponse`.

### POST `/employee/applications/{id}/action` — Действие сотрудника по заявке

**Параметры:**

- `id` (integer, идентификатор `applications.id`; path) — обязательно

**Запрос (`EmployeeActionRequest`):**

- `action` (string; `APPROVE`, `REJECT` или `REQUEST_INFO`) — обязательно; доступно при статусе `MANUAL_REVIEW` после успешных обязательных проверок и только если причина не техническая
- `version` (integer) — обязательно; версия из последнего ответа по заявке
- `decision_reason_code` (string) — необязательно; требуется для `REJECT` и `REQUEST_INFO`; сохраняется в `applications.decision_reason_code`
- `missing_fields` (array of string) — обязательно для `REQUEST_INFO`; допустимые значения: `business_data.financials.annual_revenue`, `business_data.financials.annual_expenses`
- `approved_amount` (string, рубли) — обязательно для `APPROVE`; должна быть положительной, не превышать запрошенную сумму и лимит продукта; сохраняется в `applications.approved_amount`
- `approved_rate` (number) — необязательно; ставка рассчитывается сервером по сохранённым проверкам. Если поле передано, оно должно совпасть с рассчитанным; произвольная ставка отклоняется
- `comment` (string) — обязательно; непустой после удаления пробелов по краям

Для `APPROVE` сервер дополнительно требует отсутствие стоп-факторов: активную компанию возрастом не менее 12 месяцев и отсутствие текущей просрочки. Срок одобрения остается равен `requested_term_months`; изменить его решением сотрудника нельзя. Сотрудник не может принять решение до успешного получения обязательных проверок. Для технического сбоя в проверках разрешен только `RETRY_CHECKS`.

Статус, комментарий и ID сотрудника (`changed_by_user_id`) фиксируются в `application_status_history`; `changed_by` определяется сервером по роли пользователя. При `REQUEST_INFO` значения `missing_fields` и `info_comment` сохраняются в карточке заявки.

**Успешный ответ — 200:** `ApplicationResponse` (поля перечислены выше).

**Ошибка:**

- **401** — токен отсутствует, недействителен или просрочен; тело `ErrorResponse`.
- **403** — доступ запрещён (нет роли `employee`); тело `ErrorResponse`.
- **404** — заявка не найдена; тело `ErrorResponse`.
- **409** — заявка не в `MANUAL_REVIEW`, обязательные проверки не завершены успешно, есть стоп-фактор при одобрении либо версия устарела; тело `ErrorResponse`.
- **422** — некорректные параметры решения, например сумма одобрения выше запрошенной.
- **422** — некорректные поля действия; тело `ErrorResponse`:
  - `error_code` (string)
  - `message` (string)
  - `details` (object или null)

### POST `/employee/applications/{id}/retry-checks` — Повтор проверок

Доступен сотруднику для заявки `MANUAL_REVIEW`, если последние обязательные ответы недоступны, неполны или некорректны. Причины: `EXTERNAL_CHECK_UNAVAILABLE`, `EXTERNAL_DATA_INCOMPLETE`, `INVALID_SOURCE_DATA`. Статус источника `SUCCESS` сам по себе не означает пригодность данных для расчёта. Повтор запускает новые моки ФНС/БКИ и полный `evaluate_credit` синхронно, добавляет записи проверок и переходы статуса одной транзакцией. Если источник снова не дал пригодные данные, заявка остаётся на повторе. Последняя попытка определяется по наибольшему id каждого источника. Сценарий `test.client3@example.com` возвращает таймаут при первой проверке ФНС и успех при повторе.

**Параметры:** `id` (integer; path), JSON `{"version": 2}`. Query-версия временно поддерживается для старых клиентов.

**Успешный ответ — 200:** карточка `ApplicationResponse` с итоговым статусом, версия увеличена.

**Ошибки:** `401` — нет токена; `403` — нет роли сотрудника; `404` — заявка не найдена; `409` — последние проверки уже пригодны, неверный статус или устаревшая версия.


## Контракт подключения кабинетов

Основной контракт `POST /applications/{id}/submit`, `POST /applications/{id}/sign`
и `POST /employee/applications/{id}/retry-checks`: JSON `{"version": 2}`.
Query-параметр временно сохранён для старых клиентов. Если версии отсутствуют
или JSON и query противоречат друг другу — 422; устаревшая версия — 409.
JSON-версия должна быть положительным целым числом: строки, дробные числа
и boolean отклоняются. Неизвестные поля business_data и financials не игнорируются.
Условия одобрения допустимы только в APPROVE, missing_fields — только в REQUEST_INFO.
Дозаполнение: `POST /applications/{id}/fill` с business_data и version;
PATCH сохранён как совместимый маршрут.

`ApplicationResponse.offer` — типизированное предложение или null.
В APPROVED/ISSUED содержит kind (ORIGINAL/COUNTER_OFFER), amount,
annual_rate_pct, term_months, monthly_payment, dscr, requested_dscr,
target_dscr, monthly_cash_flow, existing_debt_payments,
max_total_debt_service и explanation. Деньги и числовые показатели — строки;
срок — число месяцев. Ставка 20 означает 20% годовых. Предложение берётся из
сохранённого результата; при чтении или согласии заново не рассчитывается.

Очередь сотрудника принимает также APPROVED/REJECTED/ISSUED для истории.
Виртуальные UI-фильтры QUEUE/REVIEW/HISTORY не передаются серверу: клиент
запрашивает нужные статусы и объединяет ответы по id. Сервер определяет
доступные действия через next_actions.

Перед согласием проверяется согласованность сохранённых суммы, ставки, срока,
вида предложения и DSCR. Ошибка 409 `OFFER_INCONSISTENT` не меняет статус и
историю; она требует проверки условий сотрудником. Скоринг при согласии
не запускается повторно.

Ошибки используют JSON `{error_code, message, details}`. При нехватке
запрошенных финансовых сведений код `MISSING_FINANCIAL_FIELDS` сопровождается
`details.missing_fields` и `details.fields` (field/message). Необработанная
ошибка возвращает 500 `INTERNAL_ERROR` без внутренних сведений; подробности
остаются в серверном журнале. Ответы 422/500 в `/openapi.json` описывают этот
конверт, а не стандартный HTTPValidationError FastAPI. Живой `/openapi.json`
— источник точных схем работающего сервера; `api.yaml` — обзорный контракт.
