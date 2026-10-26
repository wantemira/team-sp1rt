import { useState } from 'react'
import { Button, Field, InlineAlert, LoadingState } from '../ui'
import { ACTIONS, FINANCIAL_FIELDS } from '../../lib/contracts'
import { normalizeMoneyInput } from '../../lib/format'
import { approvalError } from '../../lib/products'
export function EmployeeActionForm({ action, application, onSubmit, busy = false, error, catalog }) {
  const product = catalog?.products.find(item => item.id === application.product_type)
  const [amount, setAmount] = useState(application.requested_amount || '')
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [fields, setFields] = useState([])
  const [validation, setValidation] = useState('')
  function submit(event) {
    event.preventDefault()
    if (busy || (action === 'APPROVE' && !product)) return
    const normalized = normalizeMoneyInput(amount)
    if (!comment.trim()) return setValidation('Добавьте комментарий')
    if (action === 'APPROVE') {
      const message = approvalError(amount, application.requested_amount, product)
      if (message) return setValidation(message)
    }
    if (action === 'REJECT' && !reason.trim()) return setValidation('Укажите причину отказа')
    if (action === 'REQUEST_INFO' && !fields.length) return setValidation('Выберите хотя бы одно поле')
    setValidation('')
    onSubmit({
      action, version: application.version, comment: comment.trim(),
      ...(action === 'APPROVE' ? { approved_amount: normalized } : {}),
      ...(action === 'REJECT' ? { decision_reason_code: reason.trim() } : {}),
      ...(action === 'REQUEST_INFO' ? { decision_reason_code: 'MISSING_FINANCIALS', missing_fields: fields } : {}),
    })
  }
  if (action === 'APPROVE' && !product) return catalog?.loading ? <LoadingState label="Загружаем ограничения продукта…" /> : <InlineAlert tone="danger">{catalog?.error || 'Условия продукта недоступны. Одобрение заблокировано.'}{catalog?.reload && <Button onClick={catalog.reload}>Обновить условия</Button>}</InlineAlert>
  return <form onSubmit={submit} className="stack stack--compact" aria-busy={busy}>
    {(error || validation) && <InlineAlert tone="danger">{error || validation}</InlineAlert>}
    {action === 'APPROVE' && <><Field label="Одобренная сумма" disabled={busy} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /><p className="muted">Ставку и допустимый платёж рассчитывает сервер. Срок не меняется.</p></>}
    {action === 'REJECT' && <Field as="select" label="Причина отказа" disabled={busy} value={reason} onChange={event => setReason(event.target.value)}>
      <option value="">Выберите причину</option><option value="EMPLOYEE_RISK_DECLINED">Повышенный кредитный риск</option><option value="INSUFFICIENT_CASH_FLOW">Недостаточный денежный поток</option><option value="OTHER_REASON">Другая причина — поясните в комментарии</option>
    </Field>}
    {action === 'REQUEST_INFO' && <fieldset className="checkbox-group" disabled={busy}><legend>Какие сведения запросить</legend>{Object.entries(FINANCIAL_FIELDS).map(([path, label]) => <label key={path}><input type="checkbox" checked={fields.includes(path)} onChange={event => setFields(current => event.target.checked ? [...current, path] : current.filter(item => item !== path))} />{label}</label>)}</fieldset>}
    <Field as="textarea" rows={3} label="Комментарий" disabled={busy} value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} />
    <Button type="submit" loading={busy}>{ACTIONS[action]?.label || 'Подтвердить'}</Button>
  </form>
}
