import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/layout/AppShell'
import { Button, Card, InlineAlert, LoadingState } from '../../components/ui'
import { ApplicationsTable } from '../../components/credit'

export default function ClientApplications() {
  const { api } = useAuth()
  const navigate = useNavigate()
  const [applications, setApplications] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api.applications.list(controller.signal).then(data => {
      setApplications([...data].sort((a, b) => b.id - a.id)); setError('')
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [api, attempt])
  return <>
    <PageHeader title="Мои заявки" description="Черновики, текущие и завершённые обращения" action={<Button onClick={() => navigate('/client/products')}>Новая заявка</Button>} />
    <Card>{error ? <InlineAlert tone="danger">{error}<Button onClick={() => setAttempt(value => value + 1)}>Повторить</Button></InlineAlert> :
      applications ? <ApplicationsTable applications={applications} onOpen={id => navigate(`/client/applications/${id}`)} onCreate={() => navigate('/client/applications/new')} /> : <LoadingState />}</Card>
  </>
}
