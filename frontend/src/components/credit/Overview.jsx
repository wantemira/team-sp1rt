import { Button, Card, EmptyState, StatusBadge } from '../ui'
import { APPLICATION_STATUSES, PRODUCT } from '../../lib/contracts'
import { formatDate, formatMoney } from '../../lib/format'
import { historyText } from '../../lib/decisionText'
export function FinancingBanner({ onApply }) {
  return <section className="financing-banner"><div><h2>Финансирование для роста бизнеса</h2><p className="muted">На оборотные средства и новые возможности вашего бизнеса</p></div><Button onClick={onApply}>Подать заявку</Button></section>
}
export function MetricCard({ label, value, hint }) {
  return <Card className="metric-card"><p className="muted">{label}</p><p className="metric-card__value">{value}</p>{hint && <p className="muted">{hint}</p>}</Card>
}
export function ApplicationsTable({ applications = [], onOpen, onCreate }) {
  if (!applications.length) return <EmptyState title="Заявок пока нет" description="Выберите финансирование под задачу вашего бизнеса." actionLabel="Подать заявку" onAction={onCreate} />
  return <div className="table-scroll"><table className="applications-table"><caption className="sr-only">Ваши кредитные заявки</caption><thead><tr><th>Продукт</th><th>Сумма</th><th>Статус</th><th><span className="sr-only">Действие</span></th></tr></thead><tbody>
    {applications.map(application => <tr key={application.id}><td><strong>{PRODUCT.name}</strong><small className="muted">№{application.id} · {formatDate(application.created_at)}</small></td><td className="money">{formatMoney(application.requested_amount)}</td><td><StatusBadge status={application.status} /></td><td><button type="button" className="text-link" onClick={() => onOpen(application.id)} aria-label={`Открыть заявку №${application.id}`}>Открыть →</button></td></tr>)}
  </tbody></table></div>
}
export function StatusTimeline({ history = [] }) {
  if (!history.length) return <p className="muted">История появится после первого действия.</p>
  return <ol className="timeline">{history.map((event, index) => <li key={event.id ?? index} className={index === history.length - 1 ? 'timeline__current' : ''}><span className="timeline__point" aria-hidden="true">{index === history.length - 1 ? '●' : '✓'}</span><div><strong>{APPLICATION_STATUSES[event.new_status]?.label || event.new_status}</strong>{event.comment && <p className="muted">{historyText(event.comment)}</p>}{event.created_at && <small className="muted">{formatDate(event.created_at)}</small>}</div></li>)}</ol>
}
