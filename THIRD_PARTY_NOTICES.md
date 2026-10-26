# Сторонние компоненты и синтетические данные

Перечень для версии хакатона от 26.10.2026. Он описывает используемые
компоненты и не заменяет их исходные LICENSE/NOTICE/COPYING и условия
распространения. Лицензии Python сверены с метаданными установленного
проверенного образа, frontend — с package-lock.json и пакетами node_modules.
При обновлении зависимостей обновляйте этот перечень вместе с lock-файлами.

## Среда и инфраструктура

| Компонент | Использование | Лицензия/уведомления |
|---|---|---|
| CPython 3.12.15 | Сервер | PSF License и уведомления в дистрибутиве Python |
| PostgreSQL 16 | Постоянная БД | PostgreSQL License; встроенные зависимости — по уведомлениям образа |
| Node.js 20 | Сборка frontend и инструменты проверки | MIT и лицензии встроенных компонентов Node.js |
| Nginx | Статические файлы и proxy | BSD-2-Clause; сопутствующие компоненты — по уведомлениям образа |
| Debian / Alpine Linux | Базовые контейнеры | Лицензии отдельных системных пакетов в дистрибутивах |
| Docker / Compose | Внешние инструменты запуска, не код приложения | Условия установленного движка/дистрибутива; Docker Desktop не включён в репозиторий |

Точные digest образов закреплены в Dockerfile, frontend/Dockerfile и
docker-compose.yml. При распространении готовых образов сохраняйте также
уведомления и лицензии их ОС, PostgreSQL/libpq, OpenSSL и других включённых
компонентов; прикладной список ниже не является перечнем всех пакетов ОС.

## Backend: рабочие библиотеки и транзитивные зависимости

Точные версии устанавливаются из [requirements.txt](requirements.txt).

| Компонент | Версия | Лицензия по пакету |
|---|---|---|
| alembic | 1.20.1 | MIT |
| annotated-doc | 0.0.5 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.15.1 | MIT |
| bcrypt | 5.0.0 | Apache-2.0 |
| click | 8.5.0 | BSD-3-Clause |
| dnspython | 2.9.0 | ISC |
| email-validator | 2.3.0 | Unlicense |
| fastapi | 0.162.0 | MIT |
| h11 | 0.16.0 | MIT |
| httptools | 0.9.0 | MIT |
| idna | 3.20 | BSD-3-Clause |
| Mako | 1.4.3 | MIT |
| MarkupSafe | 3.0.4 | BSD-3-Clause |
| opentelemetry-api | 1.45.1 | Apache-2.0 |
| psycopg2-binary | 2.9.13 | LGPL с исключениями (см. LICENSE в пакете) |
| pydantic | 2.14.1 | MIT |
| pydantic_core | 2.50.1 | MIT |
| PyJWT | 2.15.1 | MIT |
| python-dotenv | 1.0.1 | BSD-3-Clause |
| python-multipart | 0.0.32 | Apache-2.0 |
| PyYAML | 6.0.3 | MIT |
| SQLAlchemy | 2.1.6 | MIT |
| starlette | 1.10.0 | BSD-3-Clause |
| typing-inspection | 0.4.4 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| uvicorn | 0.54.0 | BSD-3-Clause |
| uvloop | 0.23.0 | MIT / Apache-2.0 (см. LICENSE-MIT и LICENSE-APACHE) |
| watchfiles | 1.3.0 | MIT |
| websockets | 17.3 | BSD-3-Clause |
| colorama (только Windows) | 0.4.6 | BSD-3-Clause |

Для psycopg2 сохранены условия LGPL с исключениями из пакета; бинарный wheel
также содержит libpq и связанные библиотеки со своими уведомлениями.
Метаданные email-validator указывают Unlicense.

## Инструменты API-тестов

Устанавливаются только из [requirements-dev.txt](requirements-dev.txt),
не входят в рабочий образ приложения.

| Компонент | Версия | Лицензия по пакету |
|---|---|---|
| certifi | 2026.10.23 | MPL-2.0 |
| httpcore | 1.0.9 | BSD-3-Clause |
| httpx | 0.28.1 | BSD-3-Clause |
| iniconfig | 2.3.1 | MIT |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| pluggy | 1.7.0 | MIT |
| Pygments | 2.21.0 | BSD-2-Clause |
| pytest | 9.1.1 | MIT |

Newman 6.2.1 (Apache-2.0) — необязательный внешний инструмент исполнения
коллекции Postman, ставится отдельно через npm. Postman — альтернативный
внешний клиент, не включён в приложение. Схемы написаны в Mermaid; библиотека
Mermaid не включается в клиентский bundle или серверный образ как зависимость
приложения.

## Frontend: полный перечень из lock-файла

Основные компоненты: React/React DOM, React Router, Vite, React Vite plugin,
Inter, Playwright, Oxlint и типы React. Ниже перечислены также транзитивные и
необязательные пакеты разных платформ из [package-lock.json](frontend/package-lock.json).
Это перечень lock-файла; в конкретной сборке устанавливаются пакеты её платформы.
Тексты лицензий сохраняются в исходных пакетах. Inter распространяется локально
по SIL Open Font License 1.1; сетевого подключения к сервису шрифтов нет.

| Пакет | Версия | Лицензия из lock-файла |
|---|---|---|
| @fontsource/inter | 5.3.0 | OFL-1.1 |
| @oxc-project/types | 0.155.0 | MIT |
| @oxlint/binding-android-arm-eabi | 1.89.0 | MIT |
| @oxlint/binding-android-arm64 | 1.89.0 | MIT |
| @oxlint/binding-darwin-arm64 | 1.89.0 | MIT |
| @oxlint/binding-darwin-x64 | 1.89.0 | MIT |
| @oxlint/binding-freebsd-x64 | 1.89.0 | MIT |
| @oxlint/binding-linux-arm-gnueabihf | 1.89.0 | MIT |
| @oxlint/binding-linux-arm-musleabihf | 1.89.0 | MIT |
| @oxlint/binding-linux-arm64-gnu | 1.89.0 | MIT |
| @oxlint/binding-linux-arm64-musl | 1.89.0 | MIT |
| @oxlint/binding-linux-ppc64-gnu | 1.89.0 | MIT |
| @oxlint/binding-linux-riscv64-gnu | 1.89.0 | MIT |
| @oxlint/binding-linux-riscv64-musl | 1.89.0 | MIT |
| @oxlint/binding-linux-s390x-gnu | 1.89.0 | MIT |
| @oxlint/binding-linux-x64-gnu | 1.89.0 | MIT |
| @oxlint/binding-linux-x64-musl | 1.89.0 | MIT |
| @oxlint/binding-openharmony-arm64 | 1.89.0 | MIT |
| @oxlint/binding-win32-arm64-msvc | 1.89.0 | MIT |
| @oxlint/binding-win32-ia32-msvc | 1.89.0 | MIT |
| @oxlint/binding-win32-x64-msvc | 1.89.0 | MIT |
| @playwright/test | 1.64.1 | Apache-2.0 |
| @rolldown/binding-android-arm-eabi | 1.2.15 | MIT |
| @rolldown/binding-android-arm64 | 1.2.15 | MIT |
| @rolldown/binding-darwin-arm64 | 1.2.15 | MIT |
| @rolldown/binding-darwin-x64 | 1.2.15 | MIT |
| @rolldown/binding-freebsd-x64 | 1.2.15 | MIT |
| @rolldown/binding-linux-arm-gnueabihf | 1.2.15 | MIT |
| @rolldown/binding-linux-arm64-gnu | 1.2.15 | MIT |
| @rolldown/binding-linux-arm64-musl | 1.2.15 | MIT |
| @rolldown/binding-linux-ppc64-gnu | 1.2.15 | MIT |
| @rolldown/binding-linux-s390x-gnu | 1.2.15 | MIT |
| @rolldown/binding-linux-x64-gnu | 1.2.15 | MIT |
| @rolldown/binding-linux-x64-musl | 1.2.15 | MIT |
| @rolldown/binding-openharmony-arm64 | 1.2.15 | MIT |
| @rolldown/binding-win32-arm64-msvc | 1.2.15 | MIT |
| @rolldown/binding-win32-x64-msvc | 1.2.15 | MIT |
| @rolldown/pluginutils | 1.0.1 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| @vitejs/plugin-react | 6.1.2 | MIT |
| cookie | 1.1.1 | MIT |
| csstype | 3.2.3 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| fdir | 6.5.0 | MIT |
| fsevents | 2.3.3 | MIT |
| lightningcss | 1.33.0 | MPL-2.0 |
| lightningcss-android-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-freebsd-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm-gnueabihf | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-win32-arm64-msvc | 1.33.0 | MPL-2.0 |
| lightningcss-win32-x64-msvc | 1.33.0 | MPL-2.0 |
| nanoid | 3.3.20 | MIT |
| oxlint | 1.89.0 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.7 | MIT |
| playwright | 1.64.1 | Apache-2.0 |
| playwright-core | 1.64.1 | Apache-2.0 |
| postcss | 8.5.31 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| react-router | 7.18.4 | MIT |
| react-router-dom | 7.18.4 | MIT |
| rolldown | 1.2.15 | MIT |
| scheduler | 0.28.0 | MIT |
| set-cookie-parser | 2.7.3 | MIT |
| source-map-js | 1.2.2 | BSD-3-Clause |
| tinyglobby | 0.2.17 | MIT |
| vite | 8.3.5 | MIT |

## Данные, модели, источники и сервисы

- Профили компаний, ИНН, заявки, доходы, расходы и платёжная история —
  синтетические данные команды в [seed](app/seed_test_users.py) и
  [моках ФНС](app/integrations/fns_mock.py)/[БКИ](app/integrations/bki_mock.py).
  Реальные персональные и банковские данные не требуются.
- ФНС/ЕГРИП и БКИ смоделированы локальными функциями. Подключения к реальным
  реестрам, кредитным бюро и платным API нет. Названия обозначают роль источника,
  а не наличие официальной интеграции.
- Согласие, подписание договора и выдача смоделированы: сохраняются условия,
  даты и статус. ЭП и перевод денег не выполняются.
- Скоринг, логистическая PD, ставка и DSCR — детерминированная демонстрационная
  политика команды, [CREDIT_POLICY.md](CREDIT_POLICY.md). Обученных моделей,
  LLM, внешних весов и датасетов в приложении нет. PD не калибрована на дефолтах.
- Новости рабочего кабинета — синтетические информационные материалы команды.
  Подбор определяется типом бизнеса и последней заявкой текущего клиента;
  внешние новостные источники и обученные модели не используются. Примеры
  frontend/src/demo синтетические и используются только в галерее.
- Дизайн — концепт для хакатона, не официальный интерфейс банка. Временные
  картинки/URL Figma не используются. Inter включён через @fontsource/inter.
- GitHub используется для исходников и истории, PyPI/npm и registry Docker —
  для получения зависимостей при сборке. Во время кредитного сценария внешние
  сетевые сервисы не требуются.
