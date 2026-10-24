import { Button } from './Button'
export function InlineAlert({ title, children, tone = 'info' }) {
  return <div className={`inline-alert inline-alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>{title && <strong>{title}</strong>}{children && <div>{children}</div>}</div>
}
export function EmptyState({ title = 'Пока ничего нет', description, actionLabel, onAction }) {
  return <div className="empty-state"><span className="empty-state__icon" aria-hidden="true">□</span><h3>{title}</h3>{description && <p className="muted">{description}</p>}{actionLabel && onAction && <Button variant="secondary" onClick={onAction}>{actionLabel}</Button>}</div>
}
export function LoadingState({ label = 'Загружаем данные…' }) {
  return <div className="loading-state" role="status"><span className="spinner" aria-hidden="true" />{label}</div>
}
export function ErrorState({ message = 'Не удалось загрузить данные', onRetry }) {
  return <InlineAlert title={message} tone="danger">{onRetry && <Button variant="secondary" onClick={onRetry}>Попробовать еще раз</Button>}</InlineAlert>
}
