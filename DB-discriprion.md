1. users — Пользователи системы
Роль: Единый вход для всех (клиенты и сотрудники).
Связи: От неё зависят clients и employees.
- id — Уникальный номер
- email — Логин (почта)
- password_hash — Зашифрованный пароль
- role — client или employee
- created_at — Дата создания

2. clients — Профили клиентов
Роль: Бизнес-данные клиента (ИНН, компания).
Связи: user_id → users.id. Один клиент → много applications.
- id — Уникальный номер профиля
- user_id — Ссылка на users
- inn — ИНН компании
- company_name — Название компании
- client_type — INDIVIDUAL (ИП) / LEGAL_ENTITY (ООО)
- created_at — Дата создания

3. employees — Профили сотрудников
Роль: Данные сотрудника банка (ФИО, должность). ИНН нет.
Связи: user_id → users.id. Действия фиксируются в application_status_history.
- id — Уникальный номер профиля
- user_id — Ссылка на users
- full_name — ФИО
- position — Должность
- created_at — Дата создания

4. applications — Заявки
Роль: Главная таблица — все кредитные заявки.
Связи: client_id → clients.id. Одна заявка → много записей в history, checks, documents.
- id — Уникальный номер заявки
- client_id — Кто подал (ссылка на clients)
- product_type — credit_line / overdraft / term_loan
- requested_amount — Запрошенная сумма
- requested_term_months — Срок в месяцах
- purpose — Цель кредита
- status — DRAFT / CHECKING / NEEDS_INFO / MANUAL_REVIEW / APPROVED / REJECTED
- business_data — JSON с доп. данными о бизнесе
- score — Балл скоринга (0–100)
- risk_grade — A / B / C / D / E
- decision_reason_code — Код причины решения
- approved_amount — Одобренная сумма
- approved_rate — Одобренная ставка
- created_at — Дата создания
- updated_at — Дата обновления

5. application_status_history — История статусов
Роль: Лог всех переходов статусов. Нужен для прозрачности для клиента и аудита для сотрудника.
Связи: application_id → applications.id.
- id — Уникальный номер записи
- application_id — Ссылка на заявку
- previous_status — Старый статус
- new_status — Новый статус
- changed_by — CLIENT / SYSTEM / EMPLOYEE
- comment — Комментарий
- created_at — Дата изменения

6. application_checks — Результаты проверок (Моки)
Роль: Сохранение ответов от моков ФНС и БКИ. Отделяет сырые данные от заявки.
Связи: application_id → applications.id.
- id — Уникальный номер записи
- application_id — Ссылка на заявку
- check_type — FNS / BKI
- status — SUCCESS / TIMEOUT / ERROR
- response_data — Сырой JSON-ответ от мока
- created_at — Дата проверки

7. application_documents — Документы
Роль: Файлы, приложенные к заявке (устав, отчеты). Для MVP можно оставить пустой.
Связи: application_id → applications.id.
- id — Уникальный номер документа
- application_id — Ссылка на заявку
- document_type — charter / financial_report / др.
- file_url — Ссылка на файл
- status — PENDING / VERIFIED / REJECTED
- created_at — Дата загрузки