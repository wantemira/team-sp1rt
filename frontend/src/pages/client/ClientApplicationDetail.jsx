import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button, StatusBadge, InlineAlert, Field } from '../../components/ui';
import { StatusTimeline, OfferSummary } from '../../components/credit';
import { mockBackend } from '../../api/mockBackend';

export default function ClientApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Поля для формы дозаполнения (NEEDS_INFO)
  const [fillValues, setFillValues] = useState({ annual_revenue: '' });

  // Функция загрузки данных
  const fetchApp = useCallback(async () => {
    try {
      const data = await mockBackend.getById(id);
      setApp(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Первичная загрузка
  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  // Опрос каждые 5 секунд (Пункт 8 ТЗ)
  useEffect(() => {
    const pollingStatuses = ['CHECKING', 'MANUAL_REVIEW', 'NEEDS_INFO'];
    if (!app || !pollingStatuses.includes(app.status)) return;

    const timer = setInterval(() => {
      fetchApp();
    }, 5000);

    return () => clearInterval(timer);
  }, [app, fetchApp]);

  // Обработка дозаполнения (NEEDS_INFO)
  const handleFill = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setError('');
    try {
      const updated = await mockBackend.fill(app.id, { financials: { annual_revenue: fillValues.annual_revenue } }, app.version);
      setApp(updated); // Обновляем карточку результатом
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Обработка подписания (APPROVED)
  const handleSign = async () => {
    if (!window.confirm('Вы уверены, что хотите подписать договор с этими условиями?')) return;
    setIsProcessing(true);
    setError('');
    try {
      const updated = await mockBackend.sign(app.id, app.version);
      setApp(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Загрузка...</div>;
  if (!app) return <InlineAlert type="error">{error || 'Заявка не найдена'}</InlineAlert>;

  return (
    <>
      <PageHeader 
        title={`Заявка №${app.id}`} 
        action={<div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={() => navigate('/client/applications')}>Назад</Button>
          <StatusBadge status={app.status} />
        </div>} 
      />
      
      {error && <InlineAlert type="error" style={{ marginBottom: 20 }}>{error}</InlineAlert>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card title="Ход рассмотрения">
            <StatusTimeline history={app.status_history} />
          </Card>

          {/* Блок для NEEDS_INFO */}
          {app.status === 'NEEDS_INFO' && (
            <Card title="Требуются дополнительные данные">
              <div style={{ marginBottom: 16, color: 'var(--text-warning, #b45309)', backgroundColor: '#fef3c7', padding: 12, borderRadius: 6 }}>
                Комментарий сотрудника: <strong>{app.info_comment}</strong>
              </div>
              <form onSubmit={handleFill} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {app.missing_fields.includes('annual_revenue') && (
                  <Field 
                    label="Выручка за последние 12 месяцев" 
                    inputMode="decimal"
                    value={fillValues.annual_revenue}
                    onChange={e => setFillValues({ ...fillValues, annual_revenue: e.target.value })}
                    required
                  />
                )}
                <Button type="submit" disabled={isProcessing}>
                  {isProcessing ? 'Отправка...' : 'Отправить данные'}
                </Button>
              </form>
            </Card>
          )}

          {/* Блок для ISSUED */}
          {app.status === 'ISSUED' && (
            <Card title="Заявка завершена">
              <InlineAlert type="success" style={{ marginBottom: 16 }}>
                Кредит успешно выдан! (Это имитация выдачи средств на демо-стенде).
              </InlineAlert>
              <p>Вы можете закрыть эту страницу или перейти к списку своих заявок.</p>
            </Card>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <OfferSummary 
            amount={app.status === 'APPROVED' || app.status === 'ISSUED' ? app.approved_amount : app.requested_amount} 
            term={app.requested_term_months} 
            rate={app.approved_rate}
            approved={app.status === 'APPROVED' || app.status === 'ISSUED'} 
          />
          
          {/* Кнопка подписания для APPROVED */}
          {app.status === 'APPROVED' && (
            <Card title="Подписание">
              <p className="muted" style={{ marginBottom: 16 }}>Ознакомьтесь с условиями и подпишите договор.</p>
              <Button 
                style={{ width: '100%', backgroundColor: 'var(--color-success, #16a34a)' }} 
                onClick={handleSign}
                disabled={isProcessing}
              >
                {isProcessing ? 'Подписание...' : 'Подписать договор'}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}