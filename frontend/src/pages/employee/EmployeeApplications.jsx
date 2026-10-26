import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/layout/AppShell'
import { Button, Card, InlineAlert, LoadingState, StatusBadge } from '../../components/ui'
import { formatMoney } from '../../lib/format'
import { profileName } from '../../lib/displayText'
import EmployeeApplicationDetail from './EmployeeApplicationDetail'

export default function EmployeeApplications() {
  const { api } = useAuth()
  const [params, setParams] = useSearchParams()
  const filter = params.get('status') || 'QUEUE'
  const selectedId = params.get('application')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api.employee.queue(filter, controller.signal).then(items => {
      setData({ filter, items: [...items].sort((a, b) => b.id - a.id) }); setError('')
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [api, filter, attempt])
  const items = data?.filter === filter ? data.items : null
  const selected = items?.find(item => String(item.id) === selectedId) || items?.[0]
  return <>
    <PageHeader title={{ QUEUE: 'Очередь заявок', REVIEW: 'На рассмотрении', HISTORY: 'История решений' }[filter] || 'Заявки'} description="Данные заявок, результаты проверок и решения банка" action={<Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Обновить</Button>} />
    {error && <InlineAlert tone="danger">{error}<Button onClick={() => setAttempt(value => value + 1)}>Повторить</Button></InlineAlert>}
    {!items ? !error && <LoadingState /> : <div className="queue-layout">
      <Card title="Заявки"><ul className="application-queue">{items.map(item => <li key={item.id}>
        <button type="button" aria-current={selected?.id === item.id ? 'true' : undefined} onClick={() => setParams(current => {
          const next = new URLSearchParams(current)
          next.set('application', String(item.id))
          return next
        })}>
          <strong>{profileName(item.company_name)}</strong><span>{formatMoney(item.requested_amount)} · №{item.id}</span><StatusBadge status={item.status} />
        </button>
      </li>)}</ul>{!items.length && <p className="muted">В этой категории пока нет заявок.</p>}</Card>
      {selected ? <EmployeeApplicationDetail key={selected.id} id={selected.id} onActionComplete={() => setAttempt(value => value + 1)} /> : <Card>Выберите заявку из списка.</Card>}
    </div>}
  </>
}
