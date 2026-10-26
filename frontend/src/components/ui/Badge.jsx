import { APPLICATION_STATUSES } from '../../lib/contracts'
export function Badge({ children, tone = 'neutral', className = '', ...props }) {
  return <span {...props} className={`badge badge--${tone} ${className}`}><span className="badge__dot" aria-hidden="true" />{children}</span>
}
export function StatusBadge({ status }) {
  const config = APPLICATION_STATUSES[status] || { label: 'Неизвестный статус', tone: 'neutral' }
  return <Badge tone={config.tone} title={config.label}>{config.label}</Badge>
}
