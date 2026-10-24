# Инструкция разработчику фронтенда

## Что уже готово

Компоненты React/Vite по макету:
https://www.figma.com/design/wgRN4B9mhnjYPYibo6FkoR?node-id=3-16

Три интерактивных примера и каталог компонентов:
- /?view=dashboard — обзор клиента;
- /?view=application — форма заявки;
- /?view=employee — очередь и карточка сотрудника;
- /?view=components — состояния базовых компонентов.

Текущий App.jsx — демонстрационная сборка. Она НЕ авторизует пользователей, НЕ сохраняет заявку, НЕ рассчитывает скоринг и НЕ отправляет решения.
Все такие действия явно помечены в интерфейсе. API-адаптер существует отдельно и не вызывает запросы сам.

## 1. Запусти и посмотри компоненты

```bash
git switch frontend-manager
git pull --ff-only
cd frontend
npm ci
npm run dev
```

Используй Node.js 22.12+ или 24 LTS. Шрифт Inter установлен локально.
Фронтенд не зависит от внешних шрифтов/CDN.

## 2. Сохрани структуру

```text
src/
  components/ui/       кнопки, поля, карточки, статусы, вкладки, диалог, состояния
  components/layout/   AppShell, PageHeader
  components/credit/   заявки, очередь, скоринг, действия, документы, новости
  styles/              tokens.css, components.css, layout.css
  lib/                 контракт MVP, форматирование денег/дат
  api/                 клиент HTTP и методы кредитного API
  demo/                синтетические примеры; не источник production-данных
```

Цвета и размеры меняй через tokens.css. Не добавляй отдельные зеленые/фиолетовые темы.
Сетка responsive: desktop — rail и карточки, планшет/телефон — колонки.
Данные Figma заменены согласованными term_loan и статусами MVP; бизнес-значения в макете не являются контрактом.

## 3. Что из чего собирать

| Экран / блок Figma | Компоненты |
| --- | --- |
| Белая шапка и вертикальная навигация | AppShell |
| Заголовок страницы | PageHeader |
| Красный баннер подачи | FinancingBanner |
| Показатели | MetricCard |
| Таблица заявок | ApplicationsTable |
| История и этапы | StatusTimeline |
| Форма кредита | ApplicationForm + Stepper |
| Сводка запроса / одобренные условия | OfferSummary |
| Очередь сотрудника | FilterChips + ApplicationQueue |
| Карточка сотрудника | EmployeeApplicationCard |
| Подробности скоринга | ScoringPanel |
| Проверки ФНС/БКИ | CheckResults |
| Доступные действия | ApplicationActions |
| Подтверждение решения сотрудника | Modal + EmployeeActionForm |
| Документы | DocumentUpload + DocumentList |
| Новости | NewsFeed |
| Загрузка, пусто, ошибка | LoadingState + EmptyState + ErrorState |

Импорт:
```jsx
import { Button, Card, Field, Modal, InlineAlert } from './components/ui'
import { ApplicationForm, OfferSummary, EmployeeApplicationCard } from './components/credit'
```

## 4. Props компонентов

- Button: children, variant=primary|secondary|ghost|danger, loading, disabled, type, onClick. По умолчанию type=button.
- Card: title, description, action, children, as, className.
- Field: label, value/onChange либо defaultValue, hint, error, as=input|select|textarea; остальные props идут HTML-полю. label и сообщения связаны через id.
- StatusBadge: status (семь статусов MVP).
- Tabs: items=[{value,label,content,disabled?}], value, onChange, variant=line|pill. Поддерживает стрелки, Home, End.
- FilterChips: items=[{value,label,count?}], value, onChange.
- Modal: open, onClose, title, children. Нативный dialog, Escape, удержание фокуса браузером.
- AppShell: role, activeItem, onNavigate, userName, onLogout?, children. onNavigate получает значение пункта.
- ApplicationsTable: applications, onOpen(id), onCreate.
- ApplicationForm: values, onChange(values), onSave(payload), onSubmit(payload), busy, errors, error.
- OfferSummary: amount, term, rate, approved. Для approved передавай approved_amount, approved_rate, срок заявки.
- ApplicationQueue: applications, selectedId, onSelect(id), query, onQueryChange.
- EmployeeApplicationCard: application, onAction(action), busy. Данные полной карточки, включая checks и scoring_result.
- EmployeeActionForm: action, application, onSubmit(payload), busy, error. payload уже включает version.
- ApplicationActions: nextActions, onAction(action), busy=false|action. Не выводит действий, которых нет в next_actions.
- StatusTimeline: history=[{id,new_status,comment,created_at}].
- NewsFeed: items=[{id,title,excerpt,body}]. Обычный текст, без HTML.
- DocumentList: documents=[{id,document_type,created_at,...}], onDownload(document).
- DocumentUpload: onFile(file), busy, error. Проверка типа/размера должна остаться и на сервере.

ApplicationForm.values содержит плоские строки:
```js
{
  requested_amount: '1500000.00',
  requested_term_months: '12',
  purpose: 'Пополнение оборотных средств',
  annual_revenue: '12000000.00',
  annual_expenses: '8400000.00'
}
```

На onSave/onSubmit форма собирает business_data.financials и нормализует деньги в строки рублей.
Она не отправляет запрос. onSave разрешает незаполненные поля; onSubmit требует корректные сумму и срок.
При onSubmit финансовые сведения могут отсутствовать — сервер вернет NEEDS_INFO.
Stepper только отображает этапы, не является готовым движком многошаговой формы.

## 5. Подключи авторизацию и маршруты

Замени демо-App реальным корневым компонентом. Демо сохрани на отдельном dev-маршруте.
Сделай маршруты:
- /login;
- /client — обзор;
- /client/applications — свои заявки;
- /client/applications/new — создание;
- /client/applications/:id — карточка;
- /employee/applications — очередь;
- /employee/applications/:id — карточка.

Регистрации, SMS и отправки писем нет. Аккаунты создает бэкенд.
После входа используй user.role из ответа, а не поле выбора роли.
Проверяй /auth/me при восстановлении сессии. 401 очищает сессию и возвращает на /login.
Решение о хранении токена держи в auth-слое, не внутри компонентов.

```js
import { createCreditApi } from './api/creditApi'
const api = createCreditApi({
  getToken: () => sessionStorage.getItem('access_token'),
  onUnauthorized: () => {
    sessionStorage.removeItem('access_token')
    window.location.assign('/login')
  }
})
```

Это пример локального MVP. API-адаптер не выбирает хранилище токена за приложение.

## 6. Подключи API вместо fixtures

Префикс /api/v1. Vite proxy уже настроен на localhost:8000.
API-адаптер отражает согласованный план MVP: часть маршрутов может еще отсутствовать в старой версии бэкенда.

Клиент:
- api.login({email,password}), api.me();
- api.products(), api.news();
- api.applications.list(), get(id);
- create({product_type:'term_loan'});
- update(id,payload,version);
- submit(id,version);
- fill(id,businessData,version);
- sign(id,version).

Сотрудник:
- api.employee.list(status);
- api.employee.get(id);
- api.employee.action(id,payload);
- api.employee.retryChecks(id,version).

Методы принимают необязательный AbortSignal последним аргументом.
Отмена запроса браузером не гарантирует отмену уже начатого изменения на сервере.

### Черновик → отправка

Сделай один обработчик сохранения:
1. Если заявки нет — create({product_type:'term_loan'}).
2. Сохранить поля через update(id,payload,version), взять НОВУЮ version из ответа.
3. Если нажата отправка — submit(id,новаяVersion).
4. Открыть карточку с фактическим ответом сервера.
5. В finally снять busy.

Не вызывай submit со старой version после PATCH.
Не создавай новый черновик при каждом сохранении.

При открытии существующего черновика преобразуй API-объект в ApplicationForm.values:
requested_amount/requested_term_months, purpose, business_data.financials.
null преобразуй в пустую строку, а не в ноль.

### Дозаполнение

Покажи application.info_comment и только поля из missing_fields:
- business_data.financials.annual_revenue;
- business_data.financials.annual_expenses.

Используй Field. Собери business_data.financials, вызови fill и обнови карточку ответом сервера.
Не открывай редактирование статуса, грейда, проверок и одобренных условий.

### Подписание

OfferSummary получает approved_amount, approved_rate и requested_term_months.
Покажи подтверждение с этими условиями в Modal.
После подтверждения вызови sign(id,version); ISSUED обозначай как имитацию выдачи.

### Решение сотрудника

ApplicationActions получает ТОЛЬКО next_actions сервера.
APPROVE/REJECT/REQUEST_INFO открывают Modal с EmployeeActionForm.
После api.employee.action перечитай карточку и очередь.
RETRY_CHECKS вызывает retryChecks, затем перечитывает карточку.
Техническому MANUAL_REVIEW не подставляй APPROVE локально.
Фронтенд не заменяет серверную проверку прав и условий.

Полная карточка сотрудника ожидает company_name. Если ответ содержит client.company_name:
```js
const viewModel = { ...response, company_name: response.client.company_name }
```

scoring_result.factors для отображения: [{code,label,points,explanation}].
Если бэкенд хранит другой формат факторов — преобразуй в адаптере, не меняй универсальный компонент.

### Ошибки

Лови ApiError из api/client.js.
- 401: возврат на вход.
- 409: перечитать карточку и показать «Заявка уже изменена, данные обновлены».
- 422: getFieldErrors(error) и передать errors форме.
- Сеть/500: ErrorState или InlineAlert, введенные данные сохраняются.

### Опрос

В CHECKING, NEEDS_INFO и MANUAL_REVIEW обновляй карточку раз в 5 секунд.
Убирай таймер при уходе со страницы. Не запускай параллельные запросы опроса.
На APPROVED/REJECTED/ISSUED останавливай опрос. При submit показывай busy без искусственной задержки.

### Фильтры очереди

Бэкенд принимает конкретный status. Для «Все» загрузи нужные статусы отдельно и объедини по id.
Не отправляй status=ALL: это значение только демонстрационного фильтра.
Для истории сотрудника потребуется список APPROVED/REJECTED/ISSUED в API — не имитируй готовую историю.

### Документы

Существующие маршруты:
POST /applications/{id}/documents (FormData: document_type, file).
GET /applications/{id}/documents/{document_id}/file.

Загружай FormData без ручного Content-Type.
Для скачивания используй fetch с Authorization, затем Blob/ObjectURL, а не обычную ссылку без токена.
Обработай ошибку, после скачивания освободи ObjectURL.
API-адаптер JSON не используется для бинарного скачивания.

## 7. Контракт MVP

- Один term_loan, 100 000–5 000 000 ₽, 6/12/24 месяца.
- Деньги — строки рублей, не целые копейки и не float.
- Ставка — процент годовых.
- Роли client/employee.
- Статусы DRAFT/CHECKING/NEEDS_INFO/MANUAL_REVIEW/APPROVED/REJECTED/ISSUED.
- version передается в изменениях, новый номер берется из ответа.
- Скоринг вычисляется только на сервере. Цвет бейджа — не решение банка.
- Новости синтетические, подборка определяется сервером по клиенту.
- Вводимые финансовые показатели за последние 12 месяцев, расходы без кредитных платежей.

## 8. Что осталось сделать человеку

1. Реальная авторизация и маршрутизация.
2. Подключение API, обработка загрузок/ошибок/401/409.
3. Создание, сохранение и восстановление черновика.
4. Дозаполнение и подтверждение выдачи.
5. Подключение очереди, действий сотрудника и повторных проверок.
6. Реальная загрузка/скачивание документов и персональные новости.
7. Интеграция production Nginx/API в общий Docker Compose.
8. Сквозной прогон с PostgreSQL и бэкендом.

Не переносить fixtures в production-страницы. Примеры показывают композицию компонентов, не готовый кредитный процесс.

## 9. Проверки перед сдачей

npm run lint, npm test, npm run build.
npx playwright install chromium && npm run test:ui.

Проверить реальный путь: вход → черновик → отправка → результат → подписание.
Отдельно: NEEDS_INFO → fill, MANUAL_REVIEW → решение, TIMEOUT → retry, чужая заявка → отказ доступа.
Компонентные браузерные тесты проверяют демонстрационные интерфейсы, а не готовность всего MVP.
