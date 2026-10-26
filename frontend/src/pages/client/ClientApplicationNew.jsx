import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/layout/AppShell'
import { Button, Card, Field, InlineAlert, LoadingState } from '../../components/ui'
import { getFieldErrors } from '../../api/client'
import { normalizeMoneyInput } from '../../lib/format'
import { useProducts } from '../../hooks/useProducts'
import { validateLoan } from '../../lib/products'

export default function ClientApplicationNew() {
  const { api, client } = useAuth()
  const navigate = useNavigate()
  const catalog = useProducts()
  const product = catalog.products[0]
  const [params] = useSearchParams()
  const queryId = params.get('draft')
  const draft = useRef(null)
  const lock = useRef(false)
  const [values, setValues] = useState({ requested_amount: '', requested_term_months: '' })
  const [restored, setRestored] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const loading = Boolean(queryId && (restored?.id !== queryId || restored?.attempt !== attempt))

  useEffect(() => {
    draft.current = null
    if (!queryId) return
    const controller = new AbortController()
    api.applications.get(queryId, controller.signal).then(data => {
      if (controller.signal.aborted) return
      if (data.status !== 'DRAFT') return navigate(`/client/applications/${data.id}`, { replace: true })
      draft.current = data; setError('')
      setValues({ requested_amount: data.requested_amount || '', requested_term_months: String(data.requested_term_months || '') })
      setRestored({ id: queryId, attempt, failed: false })
    }).catch(err => {
      if (controller.signal.aborted) return
      setError(err.message); setRestored({ id: queryId, attempt, failed: true })
    })
    return () => controller.abort()
  }, [api, queryId, navigate, attempt])

  async function save(submit) {
    if (lock.current || loading || !product || (queryId && String(draft.current?.id) !== queryId)) return
    const term = values.requested_term_months || String(product.terms.at(-1))
    const errors = validateLoan({ ...values, requested_term_months: term }, product, submit)
    if (Object.keys(errors).length) { setFields(errors); return }
    const amount = normalizeMoneyInput(values.requested_amount)
    lock.current = true
    setBusy(submit ? 'prepare' : 'save')
    setError(''); setFields({}); setNotice('')
    const payload = { requested_amount: amount, requested_term_months: Number(term), purpose: 'Пополнение оборотных средств' }
    try {
      const saved = draft.current
        ? await api.applications.update(draft.current.id, payload, draft.current.version)
        : await api.applications.create({ product_type: product.id, ...payload })
      draft.current = saved
      if (submit) {
        setBusy('checks')
        const result = await api.applications.submit(saved.id, saved.version)
        navigate(`/client/applications/${result.id}`)
      } else {
        navigate(`/client/applications/new?draft=${saved.id}`, { replace: true })
        setNotice(`Черновик №${saved.id} сохранён`)
      }
    } catch (err) {
      if (err.status === 409 && draft.current) {
        const draftId = draft.current.id
        const latest = await api.applications.get(draftId).catch(() => null)
        if (latest?.status === 'DRAFT') {
          draft.current = latest
          setValues({ requested_amount: latest.requested_amount || '', requested_term_months: String(latest.requested_term_months || '') })
        } else if (latest) return navigate(`/client/applications/${latest.id}`)
        if (latest) setError('Заявка уже изменена. Обновили данные; проверьте их перед отправкой.')
        else {
          draft.current = null
          setRestored({ id: String(draftId), attempt, failed: true })
          setError('Заявка изменилась, но загрузить её текущую версию не удалось. Обновите черновик перед отправкой.')
          navigate(`/client/applications/new?draft=${draftId}`, { replace: true })
        }
      } else {
        setError(err.message)
        setFields(getFieldErrors(err))
      }
      if (draft.current) navigate(`/client/applications/new?draft=${draft.current.id}`, { replace: true })
    } finally { lock.current = false; setBusy('') }
  }

  if (catalog.loading) return <LoadingState label="Загружаем условия кредита…" />
  if (catalog.error || !product) return <InlineAlert tone="danger">{catalog.error || 'Сейчас нет доступного кредитного продукта.'}<Button onClick={catalog.reload}>Обновить условия</Button></InlineAlert>
  if (loading) return <LoadingState label="Восстанавливаем черновик…" />
  if (queryId && restored?.failed) return <InlineAlert tone="danger">{error || 'Не удалось загрузить черновик.'}<Button onClick={() => setAttempt(value => value + 1)}>Обновить черновик</Button></InlineAlert>
  return <>
    <PageHeader title={product.name} description="Заполните параметры — сведения о бизнесе проверим по ИНН." />
    <div className="form-layout">
      <Card title="Параметры заявки">
        <form className="stack" onSubmit={event => { event.preventDefault(); save(true) }}>
          {error && <InlineAlert tone="danger">{error}</InlineAlert>}
          {notice && <InlineAlert tone="success">{notice}</InlineAlert>}
          <Field label="Сумма кредита" inputMode="decimal" placeholder="1 000 000" value={values.requested_amount} disabled={Boolean(busy)} error={fields.requested_amount} onChange={event => setValues(current => ({ ...current, requested_amount: event.target.value }))} />
          <Field as="select" label="Срок кредита" value={values.requested_term_months || String(product.terms.at(-1))} error={fields.requested_term_months} disabled={Boolean(busy)} onChange={event => setValues(current => ({ ...current, requested_term_months: event.target.value }))}>
            {values.requested_term_months && !product.terms.includes(Number(values.requested_term_months)) && <option value={values.requested_term_months} disabled>{values.requested_term_months} мес. — недоступен</option>}
            {product.terms.map(term => <option key={term} value={term}>{term} мес.</option>)}
          </Field>
          <Field label="ИНН" value={client?.inn || ''} readOnly hint="ИНН вашего бизнеса из профиля банка" />
          <div className="application-actions">
            <Button variant="secondary" loading={busy === 'save'} disabled={Boolean(busy)} onClick={() => save(false)}>Сохранить черновик</Button>
            <Button type="submit" loading={busy === 'prepare' || busy === 'checks'} disabled={Boolean(busy)}>Отправить заявку</Button>
          </div>
        </form>
      </Card>
      <Card title="Что произойдёт дальше">
        <ol className="credit-checks"><li>Подтвердим статус бизнеса по ЕГРИП / ЕГРЮЛ (ФНС).</li><li>Запросим кредитную историю в БКИ.</li><li>Рассчитаем сумму и платёж с учётом денежного потока.</li></ol>
        <p className="muted">Если запрошенный платёж слишком велик, предложим доступную сумму и объясним расчёт. Проверки и данные на этом стенде смоделированы.</p>
      </Card>
    </div>
    {busy === 'prepare' && <LoadingState label="Сохраняем параметры заявки…" />}
    {busy === 'checks' && <Card title="Проверяем заявку"><LoadingState label="Проверка по ЕГРИП (ФНС)… Запрос в БКИ…" /><p className="muted">Ожидаем результаты проверок и расчёт условий.</p></Card>}
  </>
}
