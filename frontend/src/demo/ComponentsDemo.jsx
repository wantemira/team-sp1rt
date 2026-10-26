import { useState } from 'react'
import { Badge, Button, Card, EmptyState, ErrorState, Field, InlineAlert, LoadingState, Tabs } from '../components/ui'
import { StatusBadge } from '../components/ui/Badge'
import { APPLICATION_STATUSES } from '../lib/contracts'
import { PageHeader } from '../components/layout/AppShell'
export function ComponentsDemo() {
  const [tab, setTab] = useState('first')
  return <>
    <PageHeader title="Компоненты интерфейса" description="Примеры элементов и состояний интерфейса" />
    <div className="gallery-grid">
      <Card title="Кнопки"><div className="row"><Button>Основная</Button><Button variant="secondary">Вторичная</Button><Button variant="ghost">Текстовая</Button><Button variant="danger">Опасное действие</Button><Button loading>Загрузка</Button><Button disabled>Недоступно</Button></div></Card>
      <Card title="Статусы"><div className="row">{Object.keys(APPLICATION_STATUSES).map(status => <StatusBadge key={status} status={status} />)}<Badge>Дополнительная метка</Badge></div></Card>
      <Card title="Поля формы"><div className="stack"><Field label="Название компании" placeholder="ООО Вектор" hint="Пояснение к полю" /><Field label="Сумма кредита" defaultValue="-100" error="Сумма должна быть положительной" /><Field as="select" label="Срок"><option>12 месяцев</option><option>24 месяца</option></Field></div></Card>
      <Card title="Вкладки с клавиатурой"><Tabs value={tab} onChange={setTab} variant="pill" items={[{ value: 'first', label: 'Общая информация', content: <p className="muted">Вкладки поддерживают стрелки, Home и End.</p> }, { value: 'second', label: 'История', content: <p className="muted">Содержимое второй вкладки.</p> }]} /></Card>
      <Card title="Пустое состояние"><EmptyState title="Заявок пока нет" description="Понятное пояснение и следующее действие." /></Card>
      <Card title="Состояния запроса"><div className="stack"><LoadingState /><ErrorState message="Не удалось получить заявку" /><InlineAlert title="Черновик сохранен" tone="success">Вы сможете продолжить позже.</InlineAlert></div></Card>
    </div>
  </>
}
