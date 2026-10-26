import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/layout/AppShell'
import { Card, Button, InlineAlert, LoadingState, StatusBadge } from '../../components/ui'
import { ApplicationsTable, FinancingBanner, MetricCard, NewsFeed } from '../../components/credit'
import { formatMoney } from '../../lib/format'

export default function ClientDashboard() {
  const { api, client } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([api.applications.list(controller.signal), api.news(controller.signal)])
      .then(([applications, news]) => {
        setData({ applications: [...applications].sort((a, b) => b.id - a.id), news })
        setError('')
      }).catch(err => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [api, attempt])
  if (error) return <InlineAlert tone="danger">{error}<Button onClick={() => setAttempt(value => value + 1)}>Повторить</Button></InlineAlert>
  if (!data) return <LoadingState />
  const apps = data.applications
  const ready = apps.find(item => item.status === 'APPROVED')
  const next = apps.find(item => item.status === 'NEEDS_INFO') || ready || apps[0]
  return <>
    <PageHeader title="Кредитный кабинет" description={client?.company_name} />
    <FinancingBanner onApply={() => navigate('/client/applications/new')} />
    <div className="metrics-grid">
      <MetricCard label="Активные заявки" value={apps.filter(item => !['DRAFT', 'ISSUED', 'REJECTED'].includes(item.status)).length} />
      <MetricCard label="Готовое предложение" value={formatMoney(ready?.approved_amount)} hint={ready ? `Заявка №${ready.id}` : 'Появится после рассмотрения'} />
      <MetricCard label="Ваш следующий шаг" value={next?.status === 'NEEDS_INFO' ? 'Дополнить сведения' : ready ? 'Посмотреть условия' : 'Подать заявку'} />
    </div>
    <div className="dashboard-grid">
      <Card title="Мои заявки"><ApplicationsTable applications={apps.slice(0, 5)} onCreate={() => navigate('/client/applications/new')} onOpen={id => navigate(`/client/applications/${id}`)} /></Card>
      <Card title="Текущее обращение">{next ? <div className="stack"><p>Заявка №{next.id}</p><StatusBadge status={next.status} /><Button onClick={() => navigate(`/client/applications/${next.id}`)}>Открыть заявку</Button></div> : <p className="muted">Выберите продукт и создайте первую заявку.</p>}</Card>
    </div>
    <NewsFeed items={data.news.map(item => ({ ...item, excerpt: item.excerpt || item.text, body: item.body || item.text }))} />
  </>
}
