import { useId } from 'react'
import { Card, EmptyState, Field } from '../ui'
import { formatDate, formatMoney, formatRate } from '../../lib/format'
import { PRODUCT } from '../../lib/contracts'
export function OfferSummary({ amount, term, rate, approved = false }) {
  return <Card title={approved ? 'Одобренные условия' : 'Ваша заявка'} className="offer-summary"><strong>{PRODUCT.name}</strong><div><p className="muted">{approved ? 'Одобренная сумма' : 'Запрашиваемая сумма'}</p><p className="offer-summary__amount">{formatMoney(amount)}</p></div><p>Срок · {term ? `${term} месяцев` : 'Не выбран'}</p>{approved && <strong>{formatRate(rate)}</strong>}<div className="summary-note"><strong>{approved ? 'Следующий шаг — подписание' : 'Индивидуальные условия'}</strong><p className="muted">{approved ? 'Подписание и выдача средств в прототипе смоделированы.' : 'Доступную сумму и ставку покажем после проверки заявки.'}</p></div></Card>
}
export function NewsFeed({ items = [] }) {
  return <Card title="Новости для бизнеса"><div className="news-feed">{items.length ? items.map(item => <details key={item.id}><summary><span>{item.title}</span><small className="muted">{item.excerpt}</small></summary><p>{item.body}</p></details>) : <p className="muted">Новостей пока нет.</p>}</div></Card>
}

export function DocumentList({ documents = [], onDownload, onDelete }) {
  if (!documents.length) return <EmptyState title="Документов пока нет" description="Загруженные файлы появятся здесь." />
  return (
    <ul className="document-list">
      {documents.map(document => (
        <li key={document.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}>
          <div>
            <strong>{document.document_type}</strong>
            <p className="muted" style={{ margin: '4px 0', fontSize: '13px' }}>
              {document.file_name || 'Файл'} {/* <--- Показываем имя файла */}
            </p>
            <p className="muted" style={{ margin: 0, fontSize: '12px' }}>{formatDate(document.created_at)}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" className="text-link" onClick={() => onDownload(document)}>Скачать</button>
            {onDelete && (
              <button 
                type="button" 
                className="text-link" 
                style={{ color: 'var(--color-danger, #dc2626)' }} 
                onClick={() => onDelete(document.id)}
              >
                Удалить
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DocumentUpload({ onFile, busy = false, error }) {
  const id = useId()
  return <Field key={id} label="Прикрепить документ" type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} error={error} hint="PDF, PNG или JPEG, до 10 МБ. Проверка файла выполняется сервером." onChange={event => {
    const file = event.target.files?.[0]
    if (file) onFile(file)
    event.target.value = ''
  }} />
}
