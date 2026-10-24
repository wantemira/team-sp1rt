import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button, StatusBadge } from '../../components/ui';
import { StatusTimeline, ApplicationActions, OfferSummary } from '../../components/credit';

export default function ClientApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Моковые данные для карточки
  const app = { 
    id, status: 'DRAFT', requested_amount: '1500000.00', 
    requested_term_months: 12, status_history: [], next_actions: [] 
  };

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
          <ApplicationActions 
            nextActions={['submit', 'edit']} 
            onAction={(action) => alert(`Действие: ${action}`)} 
          />
        </Card>
        <OfferSummary 
          amount={app.requested_amount} 
          term={app.requested_term_months} 
          approved={false} 
        />
      </div>
    </>
  );
}