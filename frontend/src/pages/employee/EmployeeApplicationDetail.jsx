import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button, StatusBadge, InlineAlert, Field } from '../../components/ui';
import { StatusTimeline } from '../../components/credit';
import { mockBackend } from '../../api/mockBackend';

export default function EmployeeApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [comment, setComment] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');

  const fetchApp = useCallback(async () => {
    try {
      const data = await mockBackend.employeeGet(id);
      setApp(data);
      setApprovedAmount(data.requested_amount || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchApp(); }, [fetchApp]);

  const handleAction = async (actionType) => {
    if (!window.confirm(`Вы уверены, что хотите выполнить действие: ${actionType}?`)) return;
    setIsProcessing(true);
    setError('');
    
    try {
      const actionData = {
        action: actionType,
        comment: comment || undefined,
        approved_amount: actionType === 'approve' ? approvedAmount : undefined,
        approved_rate: actionType === 'approve' ? '15.0' : undefined,
        missing_fields: actionType === 'request_info' ? ['annual_revenue'] : undefined
      };
      
      const updated = await mockBackend.employeeAction(app.id, actionData);
      setApp(updated);
      setComment('');
      alert('Действие успешно выполнено!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Загрузка...</div>;
  if (!app) return <InlineAlert type="error">{error || 'Заявка не найдена'}</InlineAlert>;

  // Проверяем, можно ли принимать решения по этой заявке
  const canMakeDecision = ['MANUAL_REVIEW', 'CHECKING'].includes(app.status);

  return (
    <>
      <PageHeader 
        title={`Проверка заявки №${app.id}`} 
        action={<div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={() => navigate('/employee/applications')}>К очереди</Button>
          <StatusBadge status={app.status} />
        </div>} 
      />
      
      {error && <InlineAlert type="error" style={{ marginBottom: 20 }}>{error}</InlineAlert>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card title="Данные заявки">
            <p><strong>Сумма:</strong> {app.requested_amount} ₽</p>
            <p><strong>Срок:</strong> {app.requested_term_months} мес.</p>
            <p><strong>Цель:</strong> {app.purpose || 'Не указана'}</p>
          </Card>

          <Card title="История">
            <StatusTimeline history={app.status_history} />
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Если заявка требует решения, показываем панель */}
          {canMakeDecision ? (
            <Card title="Решение по заявке">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Field 
                  as="textarea" 
                  label="Комментарий (для клиента)" 
                  value={comment} 
                  onChange={e => setComment(e.target.value)} 
                  rows={3}
                />
                
                <Field 
                  label="Одобренная сумма" 
                  value={approvedAmount} 
                  onChange={e => setApprovedAmount(e.target.value)} 
                />
                <Button onClick={() => handleAction('approve')} disabled={isProcessing} style={{ backgroundColor: 'var(--color-success)' }}>
                  Одобрить
                </Button>
                
                <Button onClick={() => handleAction('request_info')} disabled={isProcessing} variant="secondary">
                  Запросить данные
                </Button>
                
                <Button onClick={() => handleAction('reject')} disabled={isProcessing} style={{ backgroundColor: 'var(--color-danger)' }}>
                  Отклонить
                </Button>
              </div>
            </Card>
          ) : (
            <Card title="Статус">
              <p>Заявка находится в статусе <strong>{app.status}</strong>. Действия недоступны (клиент должен выполнить свои шаги).</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}