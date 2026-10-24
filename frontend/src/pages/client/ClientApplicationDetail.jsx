import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button, StatusBadge, InlineAlert } from '../../components/ui';
import { StatusTimeline, ApplicationActions, OfferSummary } from '../../components/credit';
import { mockBackend } from '../../api/mockBackend';

export default function ClientApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    mockBackend.getById(id)
      .then(data => {
        setApp(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div style={{ padding: 20 }}>Загрузка...</div>;
  if (error) return <InlineAlert type="error">{error}</InlineAlert>;
  if (!app) return null;

  return (
    <>
      <PageHeader 
        title={`Заявка №${app.id}`} 
        action={<div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={() => navigate('/client/applications')}>Назад</Button>
          <StatusBadge status={app.status} />
        </div>} 
      />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <Card title="Ход рассмотрения">
          <StatusTimeline history={app.status_history} />
          {/* Пока кнопки действий не работают, оставим заглушку */}
          <ApplicationActions 
            nextActions={app.next_actions || []} 
            onAction={(action) => alert(`Действие ${action} будет реализовано в следующем пункте ТЗ`)} 
          />
        </Card>
        <OfferSummary 
          amount={app.status === 'APPROVED' ? app.approved_amount : app.requested_amount} 
          term={app.requested_term_months} 
          rate={app.approved_rate}
          approved={app.status === 'APPROVED'} 
        />
      </div>
    </>
  );
}