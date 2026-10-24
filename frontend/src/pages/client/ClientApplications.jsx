import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { ApplicationsTable } from '../../components/credit';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { mockApplications } from '../../lib/mockData';

// Временные данные, пока нет API (потом заменим на запрос)
const mockApps = [
  { id: 1042, status: 'DRAFT', requested_amount: '1500000.00', created_at: new Date().toISOString() }
];

export default function ClientApplications() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <>
      <PageHeader 
        title="Мои заявки" 
        description="Черновики, текущие и завершенные обращения" 
        action={<div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={logout}>Выйти</Button>
          <Button onClick={() => navigate('/client/applications/new')}>Новая заявка</Button>
        </div>} 
      />
      <Card>
        <ApplicationsTable 
            applications={mockApplications}
            onOpen={(id) => navigate(`/client/applications/${id}`)} 
            onCreate={() => navigate('/client/applications/new')} 
        />
      </Card>
    </>
  );
}