import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Button, InlineAlert, LoadingState, Modal } from '../../components/ui'
import { EmployeeApplicationCard, EmployeeActionForm } from '../../components/credit'
import { ACTIONS } from '../../lib/contracts'
import { useProducts } from '../../hooks/useProducts'

export default function EmployeeApplicationDetail({ id, onActionComplete }) {
  const { api } = useAuth()
  const catalog = useProducts()
  const lock = useRef(false)
  const [app, setApp] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [stale, setStale] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    api.employee.get(id, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setApp({ ...data, company_name: data.client.company_name }); setError(''); setStale(false)
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [api, id, attempt])
  async function perform(payload) {
    if (lock.current || stale || !app.next_actions.includes(payload.action)) return
    lock.current = true
    setBusy(true); setError('')
    try {
      if (payload.action === 'RETRY_CHECKS') await api.employee.retryChecks(app.id, app.version)
      else await api.employee.action(app.id, payload)
      setAction(null); setStale(true); setAttempt(value => value + 1)
      onActionComplete?.()
    } catch (err) {
      if (err.status === 409) {
        const latest = await api.employee.get(id).catch(() => null)
        if (latest) setApp({ ...latest, company_name: latest.client.company_name })
        setStale(!latest)
        setAction(null)
        setError(latest ? 'Заявка или условия изменились. Обновили карточку; проверьте результат.' : 'Заявка изменилась, но загрузить её текущую версию не удалось. Обновите карточку перед новым действием.')
      } else setError(err.message)
    } finally { lock.current = false; setBusy(false) }
  }
  if (!app) return error ? <InlineAlert tone="danger">{error}<Button onClick={() => setAttempt(value => value + 1)}>Повторить</Button></InlineAlert> : <LoadingState />
  return <div className="stack">
    {error && <InlineAlert tone="danger">{error}</InlineAlert>}
    {stale && <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Обновить карточку</Button>}
    <EmployeeApplicationCard application={app} busy={busy || stale} onAction={next => {
      if (!app.next_actions.includes(next)) return
      setError('')
      if (next === 'RETRY_CHECKS') perform({ action: next })
      else setAction(next)
    }} />
    <Modal open={Boolean(action)} dismissible={!busy} onClose={() => { if (!busy) setAction(null) }} title={ACTIONS[action]?.label || 'Действие по заявке'}>
      {action && <EmployeeActionForm key={`${app.id}-${app.version}-${action}`} action={action} application={app} catalog={catalog} busy={busy} error={error} onSubmit={perform} />}
    </Modal>
  </div>
}
