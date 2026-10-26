import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Button, InlineAlert, LoadingState, Modal } from '../../components/ui'
import { EmployeeApplicationCard, EmployeeActionForm } from '../../components/credit'
import { ACTIONS } from '../../lib/contracts'

export default function EmployeeApplicationDetail({ id, onActionComplete }) {
  const { api } = useAuth()
  const [app, setApp] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api.employee.get(id, controller.signal).then(data => {
      setApp({ ...data, company_name: data.client.company_name }); setError('')
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [api, id, attempt])
  async function perform(payload) {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (payload.action === 'RETRY_CHECKS') await api.employee.retryChecks(app.id, app.version)
      else await api.employee.action(app.id, payload)
      setAction(null); setAttempt(value => value + 1)
      onActionComplete?.()
    } catch (err) {
      if (err.status === 409) {
        const latest = await api.employee.get(id).catch(() => null)
        if (latest) setApp({ ...latest, company_name: latest.client.company_name })
        setAction(null)
        setError('Заявка или условия изменились. Обновили карточку; проверьте результат.')
      } else setError(err.message)
    } finally { setBusy(false) }
  }
  if (!app) return error ? <InlineAlert tone="danger">{error}<Button onClick={() => setAttempt(value => value + 1)}>Повторить</Button></InlineAlert> : <LoadingState />
  return <div className="stack">
    {error && <InlineAlert tone="danger">{error}</InlineAlert>}
    <EmployeeApplicationCard application={app} busy={busy} onAction={next => {
      if (!app.next_actions.includes(next)) return
      setError('')
      if (next === 'RETRY_CHECKS') perform({ action: next })
      else setAction(next)
    }} />
    <Modal open={Boolean(action)} onClose={() => { if (!busy) setAction(null) }} title={ACTIONS[action]?.label || 'Действие по заявке'}>
      {action && <EmployeeActionForm key={`${app.id}-${app.version}-${action}`} action={action} application={app} busy={busy} error={error} onSubmit={perform} />}
    </Modal>
  </div>
}
