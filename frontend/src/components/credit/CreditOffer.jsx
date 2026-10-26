import { Card } from '../ui'
import { formatMoney, formatRate } from '../../lib/format'

export function CreditOffer({ application }) {
  const offer = application.offer
  if (!offer) return null
  const counter = offer.kind === 'COUNTER_OFFER'
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
    <div className="summary-note"><strong>{counter ? 'Почему предлагаем другую сумму' : 'Почему одобрили'}</strong><p>{offer.explanation}</p>
      <p className="muted">Покрытие платежей (DSCR): {Number(offer.dscr).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}. На каждый рубль кредитных платежей приходится минимум 1,35 ₽ денежного потока.</p>
    </div>
    <p className="muted">Демонстрационный расчёт на синтетических данных. Подписание и выдача смоделированы.</p>
  </Card>
}
