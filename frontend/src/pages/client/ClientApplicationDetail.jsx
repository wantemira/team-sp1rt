import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/layout/AppShell'
import { Button, Card, Field, InlineAlert, LoadingState, Modal, StatusBadge } from '../../components/ui'
import { CheckResults, StatusTimeline } from '../../components/credit'
import { CreditOffer } from '../../components/credit/CreditOffer'
import { FINANCIAL_FIELDS } from '../../lib/contracts'
import { decisionText } from '../../lib/decisionText'
import { normalizeMoneyInput } from '../../lib/format'

export default function ClientApplicationDetail() {
  const { id } = useParams()
  const { api } = useAuth()
  const navigate = useNavigate()
  const [app, setApp] = useState(null)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [values, setValues] = useState({})
  const [attempt, setAttempt] = useState(0)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const lock = useRef(false)
  const update = data => setApp(current => !current || data.version >= current.version ? data : current)

  useEffect(() => {
    const controller = new AbortController()
    let timer
    async function load() {
      try {
        const data = await api.applications.get(id, controller.signal)
        if (controller.signal.aborted) return
        setApp(current => !current || current.id !== data.id || data.version >= current.version ? data : current)
        setPollError(''); setLoading(false); setNeedsRefresh(false)
        if (['CHECKING', 'NEEDS_INFO', 'MANUAL_REVIEW'].includes(data.status)) timer = setTimeout(load, 5000)
      } catch (err) {
        if (controller.signal.aborted) return
        setPollError(err.message); setLoading(false)
      }
    }
    load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [api, id, attempt])

  async function perform(action) {
    if (lock.current || needsRefresh || !app.next_actions.includes(action)) return
    lock.current = true
    setBusy(true); setError('')
    try {
      if (action === 'SIGN') {
        update(await api.applications.sign(app.id, app.version))
        setConfirm(false)
      } else {
        const financials = {}
        for (const path of app.missing_fields) {
          const value = normalizeMoneyInput(values[path])
          if (!value) throw new Error(`Заполните поле «${FINANCIAL_FIELDS[path] || path}»`)
          financials[path.split('.').at(-1)] = value
        }
        update(await api.applications.fill(app.id, { financials }, app.version))
        setValues({})
      }
    } catch (err) {
      if (err.status === 409) {
        setConfirm(false)
        const latest = await api.applications.get(id).catch(() => null)
        if (latest) update(latest)
        setNeedsRefresh(!latest)
        setError(latest ? 'Условия или статус заявки изменились. Обновили данные; проверьте их ещё раз.' : 'Условия изменились, но загрузить их текущую версию не удалось. Обновите заявку перед следующим действием.')
      } else setError(err.message)
    } finally { lock.current = false; setBusy(false) }
  }

  if (loading) return <LoadingState />
  if (!app || String(app.id) !== id) return <InlineAlert tone="danger">{pollError || 'Заявка не найдена'}<Button onClick={() => setAttempt(value => value + 1)}>Повторить</Button></InlineAlert>
  const canSign = !needsRefresh && app.next_actions.includes('SIGN') && Boolean(app.offer)
  return <>
    <PageHeader title={`Заявка №${app.id}`} description="Кредит на оборотные средства" action={<StatusBadge status={app.status} />} />
    <Button variant="secondary" onClick={() => navigate('/client/applications')}>К списку заявок</Button>
    {error && <InlineAlert tone="danger">{error}</InlineAlert>}
    {needsRefresh && <Button onClick={() => setAttempt(value => value + 1)}>Обновить заявку</Button>}
    {pollError && <InlineAlert tone="warning">{pollError}<Button onClick={() => setAttempt(value => value + 1)}>Обновить</Button></InlineAlert>}
    {app.status === 'ISSUED' ? <InlineAlert tone="success" title="Предложение принято">Подписание и выдача смоделированы. Согласованные условия сохранены.</InlineAlert> :
      app.status !== 'DRAFT' && <InlineAlert tone={app.status === 'REJECTED' ? 'warning' : 'info'}>{decisionText(app.decision_reason_code)}</InlineAlert>}
    <div className="form-layout">
      <div className="stack">
        <CreditOffer application={app} />
        {app.next_actions.includes('EDIT') && <Card title="Черновик заявки"><Button onClick={() => navigate(`/client/applications/new?draft=${app.id}`)}>Продолжить заполнение</Button></Card>}
        {!needsRefresh && app.next_actions.includes('FILL') && <Card title="Требуются дополнительные сведения"><p>{app.info_comment === "Provide the requested financial information." ? "Заполните указанные ниже поля." : app.info_comment}</p>
          <form className="stack" onSubmit={event => { event.preventDefault(); perform('FILL') }}>
            {app.missing_fields.map(path => <Field key={path} label={FINANCIAL_FIELDS[path] || path} inputMode="decimal" value={values[path] || ''} required disabled={busy} onChange={event => setValues(current => ({ ...current, [path]: event.target.value }))} />)}
            <Button type="submit" loading={busy}>Отправить сведения</Button>
          </form>
        </Card>}
        {canSign && <Button onClick={() => setConfirm(true)} disabled={busy}>Согласен с предложением</Button>}
      </div>
      <div className="stack"><Card title="Проверки бизнеса">{app.status === 'CHECKING' && <LoadingState label="Ожидаем результаты ФНС и БКИ…" />}<CheckResults checks={app.checks} /></Card><Card title="Ход рассмотрения"><StatusTimeline history={app.status_history} /></Card></div>
    </div>
    <Modal open={confirm && canSign} dismissible={!busy} onClose={() => { if (!busy) setConfirm(false) }} title="Подтвердите условия">
      {confirm && canSign && <CreditOffer application={app} />}
      <Button loading={busy} onClick={() => perform('SIGN')}>Подтвердить согласие</Button>
    </Modal>
  </>
}
