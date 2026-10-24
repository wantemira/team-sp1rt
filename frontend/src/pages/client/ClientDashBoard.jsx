import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import { mockBackend } from '../../api/mockBackend';

// Импортируем компонент новостей от друга
import { NewsFeed } from '../../components/credit';

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [news, setNews] = useState([]);
  const [appCount, setAppCount] = useState(0);

  useEffect(() => {
    // Загружаем новости и количество заявок
    mockBackend.getNews().then(setNews);
    mockBackend.getAll().then(apps => setAppCount(apps.length));
  }, []);

  return (
    <>
      <PageHeader 
        title="Обзор" 
        description={`Добро пожаловать, ${user?.name || user?.email}`}
        action={<Button variant="secondary" onClick={logout}>Выйти</Button>} 
      />
      
      {/* Сетка из двух колонок */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Левая колонка: Заявки */}
        <Card title="Мои заявки">
          {appCount > 0 ? (
            <>
              <p>У вас есть заявки: <strong>{appCount}</strong></p>
              <Button style={{ marginTop: '16px' }} onClick={() => navigate('/client/applications')}>
                Перейти к списку
              </Button>
            </>
          ) : (
            <>
              <p>У вас пока нет активных заявок.</p>
              <Button style={{ marginTop: '16px' }} onClick={() => navigate('/client/applications/new')}>
                Создать заявку
              </Button>
            </>
          )}
        </Card>
        
        {/* Правая колонка: Новости (используем компонент друга) */}
        <NewsFeed items={news} />
        
      </div>
    </>
  );
}