# Команды Makefile

Выполняйте команды из корня репозитория. Для запуска нужны Make, Docker Engine
и Docker Compose v2. Для проверок фронтенда — Node.js 20.20 и Chromium.
Локальная разработка API дополнительно требует Python 3.12.15 и PostgreSQL 16.

## Запуск и проверка

```bash
make init
# Задайте пароли и JWT_SECRET в .env.
make up
make health
make install-browser
make check-all
```

`make check-all` выполняет линтер, весь API-набор с PostgreSQL, модульные тесты,
сборку фронтенда, браузерные сценарии и коллекцию запросов. Браузер и коллекция
работают через Nginx; Vite для этого не запускается. Пароль из .env используется
автоматически, без записи в коллекцию. Проверки создают синтетические заявки.
PostgreSQL-тесты применяют миграции в собственных временных схемах.
Тестовые библиотеки API устанавливаются во временный контейнер, рабочий образ
не изменяется. npm/Newman/Chromium при первой установке требуют сеть.

Полный перечень с описаниями — `make help`.

| Группа | Команды |
|---|---|
| Стенд | init, config, build, up, start, restart, down |
| Наблюдение | ps, logs, health |
| БД и аккаунты | migrate, seed, db-shell |
| Разработка | api-shell, venv, deps-api, deps-web, api-dev, web-dev |
| Проверки | lint, test-api, test-postgres, test-web, build-web, install-browser, test-ui, demo-api, check, check-all |
| Документация | export-openapi |
| Удаление данных | reset-data |

`down` сохраняет тома. `reset-data` удаляет БД и документы выбранного стенда.
`seed` добавляет отсутствующие аккаунты и сохраняет пароли существующих.
Перед api-dev установите зависимости через deps-api и задайте DATABASE_URL
и JWT_SECRET; перед web-dev выполните deps-web и запустите API.

## Другие настройки

```bash
make up ENV_FILE=/путь/к/стенду.env PROJECT=team-sp1rt-check
make check-all ENV_FILE=/путь/к/стенду.env PROJECT=team-sp1rt-check
make logs SERVICE=api
make deps-api PYTHON=python3.12
```

Порты WEB_PORT/API_PORT/DB_PORT берутся из выбранного файла. Для независимых
стендов задайте разные PROJECT и порты. Все команды обслуживания и остановки
используют те же ENV_FILE/PROJECT; не меняйте их между запуском и остановкой.

Дополнительные переменные окружения:

- PLAYWRIGHT_CHROMIUM_EXECUTABLE — существующий исполняемый файл Chromium.
- PLAYWRIGHT_BASE_URL — адрес интерфейса для браузерных тестов.
- DEMO_API_URL — базовый адрес API для коллекции, включая /api/v1.
- E2E_PASSWORD — переопределение пароля браузерных тестов; по умолчанию TEST_USERS_PASSWORD.
- NPM, PYTHON, VENV — команды npm/Python и каталог локальной Python-среды.

Для удалённого стенда задайте адреса явно. Тестовые аккаунты должны иметь
пароль, с которым они были созданы: повторный seed не сбрасывает пароль.
