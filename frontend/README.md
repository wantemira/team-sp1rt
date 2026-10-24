# Кредитный кабинет · React/Vite UI kit

Готовые компоненты и интерактивные примеры по [макету Figma](https://www.figma.com/design/wgRN4B9mhnjYPYibo6FkoR?node-id=3-16).
Это библиотека для сборки кабинетов. Примеры используют синтетические данные и **не выполняют банковские операции и авторизацию**.

## Запуск

Node.js 22.12+ или 24 LTS.

```bash
cd frontend
npm ci
npm run dev
```

Откройте адрес Vite. Переключатели над макетом: клиент, новая заявка, сотрудник, компоненты.
Прямые ссылки: `/?view=dashboard`, `/?view=application`, `/?view=employee`, `/?view=components`.

## Разработчику

[FRONTEND_HANDOFF.md](./FRONTEND_HANDOFF.md) — порядок сборки рабочего фронтенда, props компонентов, карта Figma → React, API и оставшиеся задачи.

- `src/components/ui` — базовые элементы.
- `src/components/layout` — каркас и навигация.
- `src/components/credit` — кредитные блоки и формы.
- `src/styles/tokens.css` — единые цвета и размеры.
- `src/demo` — исключительно примеры, не production-данные.
- `src/api` — отдельный адаптер согласованного HTTP API; сам ничего не вызывает.

## Проверки

```bash
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

На Linux с системным Chromium можно задать `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`.
Шрифт Inter поставляется локально через `@fontsource/inter`; внешние CDN не нужны.
Дизайн — концепт для хакатона, не официальный интерфейс банка.
