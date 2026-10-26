import { Card } from '../ui'
import { formatMoney, formatRate } from '../../lib/format'
import { commentText } from '../../lib/decisionText'

export function CreditOffer({ application }) {
  const offer = application.offer
  if (!offer) return null
  const counter = offer.kind === 'COUNTER_OFFER'
  const ratio = value => value == null ? '—' : Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  return <Card className="credit-offer" title={counter ? 'Предложение для вашего бизнеса' : 'Кредит одобрен'}>
    <p className="muted">{counter ? `Вы запросили ${formatMoney(application.requested_amount)}` : 'Одобрена запрошенная сумма'}</p>
    <p className="credit-offer__amount">{formatMoney(offer.amount)}</p>
    <p>{formatRate(offer.annual_rate_pct)} · {offer.term_months} мес.</p>
    <dl className="offer-details">
      <div><dt>Ежемесячный платёж</dt><dd>{formatMoney(offer.monthly_payment)}</dd></div>
      <div><dt>Денежный поток бизнеса в месяц</dt><dd>{formatMoney(offer.monthly_cash_flow)}</dd></div>
      <div><dt>Платежи по действующим кредитам</dt><dd>{formatMoney(offer.existing_debt_payments)}</dd></div>
      <div><dt>Безопасный лимит всех платежей</dt><dd>{formatMoney(offer.max_total_debt_service)}</dd></div>
    </dl>
    <div className="summary-note"><strong>{counter ? 'Почему предлагаем другую сумму' : 'Почему одобрили'}</strong><p>{commentText(offer.explanation, 'Сумма рассчитана по денежному потоку бизнеса и действующим обязательствам.')}</p>
      {counter && <p className="muted">Покрытие платежей при запрошенной сумме: {ratio(offer.requested_dscr)}.</p>}
      <p className="muted">Покрытие платежей по предложению: {ratio(offer.dscr)}. Минимум: {ratio(offer.target_dscr)} ₽ денежного потока на каждый рубль кредитных платежей.</p>
    </div>
    <p className="muted">Демонстрационный расчёт на синтетических данных. Подписание и выдача смоделированы.</p>
  </Card>
}
