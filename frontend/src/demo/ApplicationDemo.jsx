import { useState } from 'react'
import { InlineAlert } from '../components/ui'
import { ApplicationForm, OfferSummary, Stepper } from '../components/credit'
import { PageHeader } from '../components/layout/AppShell'
import { initialForm } from './fixtures'
export function ApplicationDemo() {
  const [values, setValues] = useState(initialForm)
  const [message, setMessage] = useState('')
  function showPayload(payload, verb) { setMessage(`Демонстрация: ${verb}. Обработчик получил сумму ${payload.requested_amount || 'не указана'} и продукт ${payload.product_type}. Сервер не вызывается.`) }
  return <>
    <PageHeader title="Новая заявка" description="Кредит на оборотные средства · Заполните параметры финансирования" />
    <Stepper steps={['Продукт', 'Параметры', 'О бизнесе', 'Проверка']} current={1} />
    {message && <InlineAlert>{message}</InlineAlert>}
    <div className="form-layout"><ApplicationForm values={values} onChange={setValues} onSubmit={payload => showPayload(payload, 'отправка заявки')} onSave={payload => showPayload(payload, 'сохранение черновика')} /><OfferSummary amount={values.requested_amount} term={values.requested_term_months} /></div>
  </>
}
