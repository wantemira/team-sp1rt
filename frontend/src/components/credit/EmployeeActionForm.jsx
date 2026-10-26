import { useState } from 'react'
import { Button, Field, InlineAlert } from '../ui'
import { ACTIONS, FINANCIAL_FIELDS } from '../../lib/contracts'
import { normalizeMoneyInput } from '../../lib/format'
export function EmployeeActionForm({ action, application, onSubmit, busy = false, error }) {
  const [amount, setAmount] = useState(application.requested_amount || '')
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [fields, setFields] = useState([])
  const [validation, setValidation] = useState('')
  function submit(event) {
    event.preventDefault()
    const normalized = normalizeMoneyInput(amount)
    if (!comment.trim()) return setValidation('Добавьте комментарий')
    if (action === 'APPROVE' && (!normalized || BigInt(normalized.replace('.', '')) < 10000000n || BigInt(normalized.replace('.', '')) > BigInt(normalizeMoneyInput(application.requested_amount).replace('.', '')))) return setValidation('Сумма должна быть от 100 000 ₽ и не выше запрошенной')
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
  return <form onSubmit={submit} className="stack stack--compact">
    {(error || validation) && <InlineAlert tone="danger">{error || validation}</InlineAlert>}
    {action === 'APPROVE' && <><Field label="Одобренная сумма" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /><p className="muted">Ставку и допустимый платёж рассчитывает сервер. Срок не меняется.</p></>}
    {action === 'REJECT' && <Field label="Код причины отказа" value={reason} onChange={event => setReason(event.target.value)} maxLength={128} />}
    {action === 'REQUEST_INFO' && <fieldset className="checkbox-group"><legend>Какие сведения запросить</legend>{Object.entries(FINANCIAL_FIELDS).map(([path, label]) => <label key={path}><input type="checkbox" checked={fields.includes(path)} onChange={event => setFields(current => event.target.checked ? [...current, path] : current.filter(item => item !== path))} />{label}</label>)}</fieldset>}
    <Field as="textarea" rows={3} label="Комментарий" value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} />
    <Button type="submit" loading={busy}>{ACTIONS[action]?.label || 'Подтвердить'}</Button>
  </form>
}
