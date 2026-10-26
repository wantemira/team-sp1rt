import { useState } from 'react'
import { Button, Card, Field, InlineAlert } from '../ui'
import { PRODUCT } from '../../lib/contracts'
import { normalizeMoneyInput } from '../../lib/format'
export function Stepper({ steps, current, onStepClick }) {
  return (
    <ol className="stepper" aria-label="Этапы заявки">
      {steps.map((label, index) => (
        <li 
          key={label} 
          aria-current={index === current ? 'step' : undefined}
          onClick={() => onStepClick && onStepClick(index)}
          style={{ cursor: onStepClick ? 'pointer' : 'default', opacity: index > current && !onStepClick ? 0.5 : 1 }}
        >
          <span>{index + 1}</span>{label}
        </li>
      ))}
    </ol>
  )
}
/** Controlled values. onSubmit/onSave receive an API-shaped payload, money stays a string. */
export function ApplicationForm({ values, onChange, onSubmit, onSave, busy = false, errors = {}, error }) {
  const [localErrors, setLocalErrors] = useState({})
  function change(name, value) { setLocalErrors(current => ({ ...current, [name]: undefined })); onChange({ ...values, [name]: value }) }
  function payload() {
    const financials = {}
    for (const key of ['annual_revenue', 'annual_expenses']) {
      if (values[key]?.trim()) financials[key] = normalizeMoneyInput(values[key])
    }
    return {
      product_type: PRODUCT.product_type,
      requested_amount: values.requested_amount?.trim() ? normalizeMoneyInput(values.requested_amount) : null,
      requested_term_months: values.requested_term_months ? Number(values.requested_term_months) : null,
      purpose: values.purpose || null,
      business_data: { financials },
    }
  }
  function validate(submitting) {
    const next = {}
    const amount = normalizeMoneyInput(values.requested_amount)
    if (submitting && !amount) next.requested_amount = 'Укажите сумму кредита'
    else if (values.requested_amount && (!amount || BigInt(amount.split('.')[0]) < 100000n || BigInt(amount.replace('.', '')) > 500000000n)) next.requested_amount = 'От 100 000 до 5 000 000 ₽'
    if (submitting && !values.requested_term_months) next.requested_term_months = 'Выберите срок'
    if (values.requested_term_months && !PRODUCT.terms.includes(Number(values.requested_term_months))) next.requested_term_months = 'Выберите 6, 12 или 24 месяца'
    for (const key of ['annual_revenue', 'annual_expenses']) {
      if (values[key] && normalizeMoneyInput(values[key]) === null) next[key] = 'Введите неотрицательную сумму, не более двух знаков после запятой'
    }
    setLocalErrors(next)
    return !Object.keys(next).length
  }
  const allErrors = { ...localErrors, ...errors,
    annual_revenue: errors['business_data.financials.annual_revenue'] || errors.annual_revenue || localErrors.annual_revenue,
    annual_expenses: errors['business_data.financials.annual_expenses'] || errors.annual_expenses || localErrors.annual_expenses,
  }
  return <form className="stack" noValidate onSubmit={event => { event.preventDefault(); if (validate(true)) onSubmit(payload()) }}>
    <Card title="Сколько нужно вашему бизнесу?" className="stack">
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      <Field label="Сумма кредита" inputMode="decimal" autoComplete="off" placeholder="От 100 000 ₽" value={values.requested_amount ?? ''} onChange={event => change('requested_amount', event.target.value)} error={allErrors.requested_amount} />
      <Field as="select" label="Срок кредитования" value={values.requested_term_months ?? ''} onChange={event => change('requested_term_months', event.target.value)} error={allErrors.requested_term_months}>
        <option value="">Выберите срок</option>{PRODUCT.terms.map(term => <option key={term} value={term}>{term} месяцев</option>)}
      </Field>
      <Field label="Цель финансирования" value={values.purpose ?? ''} onChange={event => change('purpose', event.target.value)} maxLength={500} placeholder="Например, закупка товаров" />
      <details className="financial-details"><summary>Данные о бизнесе</summary><div className="stack stack--compact">
        <p className="muted">За последние 12 месяцев. Можно заполнить позже.</p>
        <Field label="Выручка за последние 12 месяцев" inputMode="decimal" value={values.annual_revenue ?? ''} onChange={event => change('annual_revenue', event.target.value)} error={allErrors.annual_revenue} />
        <Field label="Расходы за последние 12 месяцев" hint="Без платежей по кредитам" inputMode="decimal" value={values.annual_expenses ?? ''} onChange={event => change('annual_expenses', event.target.value)} error={allErrors.annual_expenses} />
      </div></details>
      <p className="muted">Можно сохранить черновик и вернуться к нему позже.</p>
    </Card>
    <div className="form-actions">{onSave && <Button variant="secondary" disabled={busy} onClick={() => { if (validate(false)) onSave(payload()) }}>Сохранить черновик</Button>}<Button type="submit" loading={busy}>Отправить заявку →</Button></div>
  </form>
}
