import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import { mockApplications } from '../../lib/mockData';

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader 
        title="Обзор" 
        description={`Добро пожаловать, ${user?.name || user?.email}`}
        action={<Button variant="secondary" onClick={logout}>Выйти</Button>} 
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Card title="Мои заявки">
          {mockApplications.length > 0 ? (
            <>
              <p>У вас есть активные заявки: <strong>{mockApplications.length}</strong></p>
              <Button style={{ marginTop: '16px' }}  onClick={() => navigate('/client/applications')}>Перейти к списку</Button>
            </>
          ) : (
            <>
              <p>У вас пока нет активных заявок.</p>
              <Button style={{ marginTop: '16px' }}  onClick={() => navigate('/client/applications/new')}>Создать заявку</Button>
            </>
          )}
        </Card>
        <Card title="Новости">
          <p>Здесь будут персональные новости.</p>
        </Card>
      </div>
    </>
  );
}