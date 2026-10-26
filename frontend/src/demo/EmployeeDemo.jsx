import { useState } from 'react'
import { Button, EmptyState, FilterChips, InlineAlert, Modal } from '../components/ui'
import { ApplicationQueue, EmployeeActionForm, EmployeeApplicationCard } from '../components/credit'
import { PageHeader } from '../components/layout/AppShell'
import { ACTIONS, PRODUCT } from '../lib/contracts'
import { demoQueue } from './fixtures'
export function EmployeeDemo({ historyOnly = false }) {
  const [selectedId, setSelectedId] = useState(demoQueue[0].id)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('MANUAL_REVIEW')
  const [action, setAction] = useState(null)
  const [message, setMessage] = useState('')
  const visible = demoQueue.filter(item => filter === 'ALL' || item.status === filter)
  const selected = visible.find(item => item.id === selectedId) || visible[0]
  function handleAction(nextAction) {
    if (nextAction === 'RETRY_CHECKS') setMessage(`Повтор проверки заявки №${selected.id} показан только в галерее.`)
    else setAction(nextAction)
  }
  return <>
    <PageHeader title={historyOnly ? 'История решений' : 'Очередь заявок'} description="Проверяйте данные и принимайте обоснованные решения" />
    {message && <InlineAlert>{message}</InlineAlert>}
    {historyOnly ? <EmptyState title="Пример истории решений" description="Здесь разработчик подключает завершенные заявки из API. История отдельной заявки уже доступна в ее карточке." /> : <>
      <FilterChips value={filter} onChange={setFilter} items={[{ value: 'ALL', label: 'Все', count: demoQueue.length }, { value: 'MANUAL_REVIEW', label: 'Ручная проверка', count: demoQueue.length }, { value: 'NEEDS_INFO', label: 'Нужны сведения', count: 0 }]} />
      <div className="queue-layout"><ApplicationQueue applications={visible} selectedId={selected?.id} onSelect={id => { setSelectedId(id); setMessage('') }} query={query} onQueryChange={setQuery} /><EmployeeApplicationCard key={selected?.id || 'empty'} application={selected} onAction={handleAction} /></div>
    </>}
    <Modal open={Boolean(action)} onClose={() => setAction(null)} title={ACTIONS[action]?.label || 'Действие сотрудника'}>
      {action && selected && <EmployeeActionForm key={`${selected.id}-${action}`} action={action} application={{ ...selected, product_type: 'term_loan' }} catalog={{ products: [{ ...PRODUCT, id: 'term_loan' }] }} onSubmit={payload => { setMessage(`Действие «${ACTIONS[payload.action]?.label || "Решение"}» по заявке №${selected.id} показано только в галерее.`); setAction(null) }} />}
      <Button variant="ghost" onClick={() => setAction(null)}>Отмена</Button>
    </Modal>
  </>
}
