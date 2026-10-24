import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { ApplicationsTable } from '../../components/credit';
import { useNavigate } from 'react-router-dom';
import { mockBackend } from '../../api/mockBackend';

export default function ClientApplications() {
  const navigate = useNavigate();
  
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockBackend.getAll().then(data => {
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
        action={
          // Ведем на страницу продуктов (или на 1-й шаг визарда, если страница продуктов удалена)
          <Button onClick={() => navigate('/client/products')}>
            Новая заявка
          </Button>
        } 
      />
      <Card>
        {loading ? (
          <div>Загрузка...</div>
        ) : applications.length === 0 ? (
          <div style={{ padding: '20px 0', color: '#6b7280' }}>У вас пока нет заявок.</div>
        ) : (
          <ApplicationsTable 
            applications={applications} 
            onOpen={(id) => navigate(`/client/applications/${id}`)} 
            onCreate={() => navigate('/client/products')} // <--- Тоже ведем на продукты
          />
        )}
      </Card>
    </>
  );
}