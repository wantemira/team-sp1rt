import { useId } from 'react'
import { Card, Field } from '../ui'
import { formatDate, formatMoney, formatRate } from '../../lib/format'
import { PRODUCT } from '../../lib/contracts'
export function OfferSummary({ amount, term, rate, approved = false }) {
  return <Card title={approved ? 'Одобренные условия' : 'Ваша заявка'} className="offer-summary"><strong>{PRODUCT.name}</strong><div><p className="muted">{approved ? 'Одобренная сумма' : 'Запрашиваемая сумма'}</p><p className="offer-summary__amount">{formatMoney(amount)}</p></div><p>Срок · {term ? `${term} месяцев` : 'Не выбран'}</p>{approved && <strong>{formatRate(rate)}</strong>}<div className="summary-note"><strong>{approved ? 'Следующий шаг — подписание' : 'Индивидуальные условия'}</strong><p className="muted">{approved ? 'Подписание и выдача средств в прототипе смоделированы.' : 'Доступную сумму и ставку покажем после проверки заявки.'}</p></div></Card>
}
export function NewsFeed({ items = [] }) {
  return <Card title="Новости для бизнеса"><div className="news-feed">{items.length ? items.map(item => <details key={item.id}><summary><span>{item.title}</span><small className="muted">{item.excerpt}</small></summary><p>{item.body}</p></details>) : <p className="muted">Новостей пока нет.</p>}</div></Card>
}

export function DocumentList({ documents = [], onDownload, onDelete }) {
  if (!documents.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', color: '#6b7280' }}>
        {/* Красивая SVG-иконка документа вместо квадратика */}
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', color: '#d1d5db' }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <strong style={{ color: '#111827', marginBottom: '4px' }}>Документов пока нет</strong>
        <p style={{ margin: 0, fontSize: '14px' }}>Загруженные файлы появятся здесь.</p>
      </div>
    )
  }
  
  return (
    <ul className="document-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {documents.map(document => (
        <li key={document.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <strong style={{ display: 'block', color: '#111827', marginBottom: '4px' }}>{document.document_type}</strong>
            <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#6b7280' }}>{document.file_name}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{formatDate(document.created_at)}</p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button type="button" style={{ background: 'none', border: 'none', color: '#e11d48', cursor: 'pointer', fontWeight: '500' }} onClick={() => onDownload(document)}>Скачать</button>
            {onDelete && (
              <button type="button" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }} onClick={() => onDelete(document.id)}>Удалить</button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DocumentUpload({ onFile, busy = false, error }) {
  const id = useId()
  
  // Скрываем стандартный инпут и делаем красивую зону
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
        Прикрепить документ
      </label>
      
      <label 
        htmlFor={id} 
        className="custom-file-upload" 
        style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '32px 16px', border: '2px dashed #d1d5db', borderRadius: '12px',
          backgroundColor: busy ? '#f3f4f6' : '#f9fafb', cursor: busy ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s', opacity: busy ? 0.7 : 1
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span style={{ fontWeight: '500', color: '#111827', marginBottom: '4px' }}>
          {busy ? 'Загрузка...' : 'Нажмите, чтобы выбрать файл'}
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>PDF, PNG или JPEG, до 10 МБ</span>
      </label>
      
      <input 
        id={id} 
        type="file" 
        accept=".pdf,.png,.jpg,.jpeg" 
        disabled={busy} 
        style={{ display: 'none' }} // Скрываем стандартный уродливый инпут
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = '' // Сбрасываем, чтобы можно было загрузить тот же файл снова
        }} 
      />
      {error && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>{error}</p>}
    </div>
  )
}
