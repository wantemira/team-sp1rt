import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/layout/AppShell'
import { Button, Card, Field, InlineAlert, LoadingState } from '../../components/ui'
import { getFieldErrors } from '../../api/client'
import { normalizeMoneyInput } from '../../lib/format'

export default function ClientApplicationNew() {
  const { api, client } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryId = params.get('draft')
  const draft = useRef(null)
  const lock = useRef(false)
  const [values, setValues] = useState({ requested_amount: '', requested_term_months: '24' })
  const [loading, setLoading] = useState(Boolean(queryId))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!queryId) return
    const controller = new AbortController()
    api.applications.get(queryId, controller.signal).then(data => {
      if (data.status !== 'DRAFT') return navigate(`/client/applications/${data.id}`, { replace: true })
      draft.current = data
      setValues({ requested_amount: data.requested_amount || '', requested_term_months: String(data.requested_term_months || 24) })
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [api, queryId, navigate])

  async function save(submit) {
    if (lock.current || loading || (queryId && !draft.current)) return
    const amount = normalizeMoneyInput(values.requested_amount)
    if ((values.requested_amount && !amount) || (submit && !amount) ||
      (amount && (BigInt(amount.replace('.', '')) < 10000000n || BigInt(amount.replace('.', '')) > 500000000n))) {
      setFields({ requested_amount: 'Укажите сумму от 100 000 до 5 000 000 ₽, не более двух знаков после запятой' })
      return
    }
    lock.current = true
    setBusy(submit ? 'submit' : 'save')
    setError(''); setFields({}); setNotice('')
    const payload = { requested_amount: amount, requested_term_months: Number(values.requested_term_months), purpose: 'Пополнение оборотных средств' }
    try {
      const saved = draft.current
        ? await api.applications.update(draft.current.id, payload, draft.current.version)
        : await api.applications.create({ product_type: 'term_loan', ...payload })
      draft.current = saved
      if (submit) {
        const result = await api.applications.submit(saved.id, saved.version)
        navigate(`/client/applications/${result.id}`)
      } else {
        navigate(`/client/applications/new?draft=${saved.id}`, { replace: true })
        setNotice(`Черновик №${saved.id} сохранён`)
      }
    } catch (err) {
      if (err.status === 409 && draft.current) {
        const latest = await api.applications.get(draft.current.id).catch(() => null)
        if (latest?.status === 'DRAFT') {
          draft.current = latest
          setValues({ requested_amount: latest.requested_amount || '', requested_term_months: String(latest.requested_term_months || 24) })
        } else if (latest) return navigate(`/client/applications/${latest.id}`)
        setError('Заявка уже изменена. Обновили данные; проверьте их перед отправкой.')
      } else {
        setError(err.message)
        setFields(getFieldErrors(err))
      }
      if (draft.current) navigate(`/client/applications/new?draft=${draft.current.id}`, { replace: true })
    } finally { lock.current = false; setBusy('') }
  }

  if (loading) return <LoadingState label="Восстанавливаем черновик…" />
  return <>
    <PageHeader title="Кредит на оборотные средства" description="Заполните параметры — сведения о бизнесе проверим по ИНН." />
    <div className="form-layout">
      <Card title="Параметры заявки">
        <form className="stack" onSubmit={event => { event.preventDefault(); save(true) }}>
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          {notice && <InlineAlert tone="success">{notice}</InlineAlert>}
          <Field label="Сумма кредита" inputMode="decimal" placeholder="1 000 000" value={values.requested_amount} disabled={Boolean(busy)} error={fields.requested_amount} onChange={event => setValues(current => ({ ...current, requested_amount: event.target.value }))} />
          <Field as="select" label="Срок кредита" value={values.requested_term_months} disabled={Boolean(busy)} onChange={event => setValues(current => ({ ...current, requested_term_months: event.target.value }))}>
            <option value="6">6 месяцев</option><option value="12">12 месяцев</option><option value="24">24 месяца</option>
          </Field>
          <Field label="ИНН" value={client?.inn || ''} readOnly hint="ИНН вашего бизнеса из профиля банка" />
          <div className="application-actions">
            <Button variant="secondary" disabled={Boolean(busy)} onClick={() => save(false)}>Сохранить черновик</Button>
            <Button type="submit" loading={busy === 'submit'} disabled={Boolean(busy)}>Отправить заявку</Button>
          </div>
        </form>
      </Card>
      <Card title="Что произойдёт дальше">
        <ol className="credit-checks"><li>Подтвердим статус бизнеса по ЕГРИП / ЕГРЮЛ (ФНС).</li><li>Запросим кредитную историю в БКИ.</li><li>Рассчитаем сумму и платёж с учётом денежного потока.</li></ol>
        <p className="muted">Если запрошенный платёж слишком велик, предложим доступную сумму и объясним расчёт. Проверки и данные на этом стенде смоделированы.</p>
      </Card>
    </div>
    {busy === 'submit' && <Card title="Проверяем заявку"><LoadingState label="Проверка по ЕГРИП (ФНС)… Запрос в БКИ…" /><p className="muted">Ожидаем результаты проверок и расчёт условий.</p></Card>}
  </>
}
