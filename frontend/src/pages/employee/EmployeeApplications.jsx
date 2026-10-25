import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui';
import { mockBackend } from '../../api/mockBackend';
import EmployeeApplicationDetail from './EmployeeApplicationDetail';
import { PageHeader } from '../../components/layout/AppShell'; // Для красивого заголовка

export default function EmployeeApplications() {
  const [searchParams] = useSearchParams();
  
  // Получаем статус из URL. Если пусто, то по умолчанию 'QUEUE'
  const statusFilter = searchParams.get('status') || 'QUEUE';

  const [apps, setApps] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    mockBackend.employeeList(statusFilter).then(data => {
      const sorted = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setApps(sorted);
      
      // Автовыбор первой заявки
      if (sorted.length > 0) {
        // Если текущая выбранная заявка есть в новом списке, оставляем её, иначе берем первую
        const currentExists = sorted.find(a => a.id === selectedId);
        setSelectedId(currentExists ? selectedId : sorted[0].id);
      } else {
        setSelectedId(null);
      }
      setLoading(false);
    });
  }, [statusFilter]);

  // Определяем заголовок для страницы
  let pageTitle = "Очередь заявок";
  let pageDesc = "Требуют ручной проверки";
  if (statusFilter === 'REVIEW') {
    pageTitle = "На рассмотрении";
    pageDesc = "Заявки на проверке и ожидающие ответа от клиента";
  } else if (statusFilter === 'HISTORY') {
    pageTitle = "История решений";
    pageDesc = "Одобренные и отклоненные заявки";
  }

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDesc} />

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', alignItems: 'start', marginTop: '24px' }}>
        
        {/* ЛЕВАЯ КОЛОНКА: СПИСОК ЗАЯВОК */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? <div style={{ padding: '20px' }}>Загрузка...</div> : apps.map(app => (
            <div 
              key={app.id}
              onClick={() => setSelectedId(app.id)}
              style={{
                padding: '16px', borderRadius: '12px', cursor: 'pointer',
                backgroundColor: selectedId === app.id ? '#fff1f2' : 'white',
                border: selectedId === app.id ? '2px solid #e11d48' : '1px solid #f3f4f6',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ color: '#111827' }}>{app.company_name}</strong>
                {app.status === 'NEEDS_INFO' && (
                  <span style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px' }}>Ждет данных</span>
                )}
                {app.status === 'APPROVED' && (
                  <span style={{ fontSize: '11px', backgroundColor: '#ecfdf5', color: '#047857', padding: '2px 6px', borderRadius: '4px' }}>Одобрено</span>
                )}
                {app.status === 'REJECTED' && (
                  <span style={{ fontSize: '11px', backgroundColor: '#fef2f2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px' }}>Отклонено</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280' }}>
                <span>{new Intl.NumberFormat('ru-RU').format(app.requested_amount)} ₽</span>
                <span>№{app.id}</span>
              </div>
            </div>
          ))}
          
          {apps.length === 0 && !loading && (
            <Card>
              <div style={{ padding: '30px 20px', textAlign: 'center', color: '#6b7280' }}>
                В этой категории пока нет заявок.
              </div>
            </Card>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА: КАРТОЧКА ЗАЯВКИ */}
        <div>
          {selectedId ? (
            <EmployeeApplicationDetail 
              id={selectedId} 
              onActionComplete={() => {
                // Принудительно обновляем список после действия
                mockBackend.employeeList(statusFilter).then(data => setApps(data));
              }} 
            />
          ) : (
            <Card>
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6b7280' }}>
                Выберите заявку из списка слева
              </div>
            </Card>
          )}
        </div>
        
      </div>
    </div>
  );
}