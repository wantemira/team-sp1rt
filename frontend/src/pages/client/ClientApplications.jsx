import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { ApplicationsTable } from '../../components/credit';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { mockBackend } from '../../api/mockBackend';

export default function ClientApplications() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загружаем заявки из эмулятора при открытии страницы
    mockBackend.getAll().then(data => {
      // Сортируем: новые сверху
      const sorted = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setApplications(sorted);
      setLoading(false);
    });
  }, []);

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
        {loading ? (
          <div>Загрузка...</div>
        ) : applications.length === 0 ? (
          <div>У вас пока нет заявок.</div>
        ) : (
          <ApplicationsTable 
            applications={applications} 
            onOpen={(id) => navigate(`/client/applications/${id}`)} 
            onCreate={() => navigate('/client/applications/new')} 
          />
        )}
      </Card>
    </>
  );
}