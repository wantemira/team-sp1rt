import { useState, useEffect, useCallback } from 'react';
import { Card, Button, StatusBadge, InlineAlert, Field } from '../../components/ui';
import { StatusTimeline } from '../../components/credit';
import { mockBackend } from '../../api/mockBackend';

export default function EmployeeApplicationDetail({ id, onActionComplete }) {
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // Вкладки: info, checks, history
  
  const [comment, setComment] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');

  const fetchApp = useCallback(async () => {
    setLoading(true);
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
      
      await mockBackend.employeeAction(app.id, actionData);
      alert('Действие успешно выполнено!');
      if (onActionComplete) onActionComplete(); // Обновляем список слева
      fetchApp(); // Обновляем карточку справа
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <Card>Загрузка...</Card>;
  if (!app) return <InlineAlert tone="danger">{error || 'Заявка не найдена'}</InlineAlert>;

  const canMakeDecision = ['MANUAL_REVIEW', 'CHECKING'].includes(app.status);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Шапка карточки */}
      <div style={{ padding: '24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>{app.company_name} · №{app.id}</h2>
          <StatusBadge status={app.status} />
        </div>
      </div>

      {/* Табы */}
      <div style={{ display: 'flex', gap: '24px', padding: '0 24px', borderBottom: '1px solid #f3f4f6' }}>
        {['info', 'checks', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              color: activeTab === tab ? '#dc2626' : '#6b7280',
              borderBottom: activeTab === tab ? '2px solid #dc2626' : '2px solid transparent'
            }}
          >
            {tab === 'info' && 'Общая информация'}
            {tab === 'checks' && 'Проверки'}
            {tab === 'history' && 'История'}
          </button>
        ))}
      </div>

      {/* Контент табов */}
      <div style={{ padding: '24px' }}>
        {error && <InlineAlert tone="danger" style={{ marginBottom: 20 }}>{error}</InlineAlert>}

        {activeTab === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '13px' }}>Запрошено</p>
              <strong style={{ fontSize: '20px' }}>{new Intl.NumberFormat('ru-RU').format(app.requested_amount)} ₽</strong>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '13px' }}>Срок</p>
              <strong style={{ fontSize: '20px' }}>{app.requested_term_months} месяцев</strong>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', color: '#6b7280', fontSize: '13px' }}>Скоринг</p>
              <strong style={{ fontSize: '20px' }}>{app.scoring} / 100</strong>
            </div>
            
            <div style={{ gridColumn: '1 / -1', marginTop: '16px', padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '8px', color: '#047857' }}>
              <strong style={{ display: 'block', marginBottom: '8px' }}>✓ Компания действительна</strong>
              <span style={{ fontSize: '14px' }}>Сведений о банкротстве не найдено</span>
            </div>
            
            <div style={{ gridColumn: '1 / -1', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Рекомендация системы: одобрить</strong>
              <span style={{ fontSize: '14px' }}>Высокий рейтинг и уровень платежеспособности сотрудника</span>
            </div>
          </div>
        )}

        {activeTab === 'checks' && (
          <div>
            <p>Результаты проверок ФНС/БКИ...</p>
          </div>
        )}

        {activeTab === 'history' && (
          <StatusTimeline history={app.status_history} />
        )}
      </div>

      {/* Панель действий */}
      {canMakeDecision && (
        <div style={{ padding: '24px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button onClick={() => handleAction('approve')} disabled={isProcessing} style={{ flex: 1, backgroundColor: '#dc2626', color: 'white' }}>
              Одобрить
            </Button>
            <Button onClick={() => handleAction('request_info')} disabled={isProcessing} variant="secondary" style={{ flex: 1 }}>
              Запросить сведения
            </Button>
            <Button onClick={() => handleAction('reject')} disabled={isProcessing} variant="secondary" style={{ flex: 1, color: '#dc2626' }}>
              Отказать
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}