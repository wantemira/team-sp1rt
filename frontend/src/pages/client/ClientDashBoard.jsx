import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { mockBackend } from '../../api/mockBackend';
import { Button } from '../../components/ui';

// Функция для красивых статусов и их цветов
function getStatusBadge(status) {
  const config = {
    DRAFT: { label: 'Черновик', bg: '#f3f4f6', color: '#4b5563' },
    CHECKING: { label: 'На проверке', bg: '#e0e7ff', color: '#4338ca' },
    MANUAL_REVIEW: { label: 'На рассмотрении', bg: '#e0e7ff', color: '#4338ca' },
    NEEDS_INFO: { label: 'Нужны данные', bg: '#fef3c7', color: '#b45309' },
    APPROVED: { label: 'Одобрено', bg: '#ecfdf5', color: '#047857' },
    ISSUED: { label: 'Выдан', bg: '#ecfdf5', color: '#047857' },
    REJECTED: { label: 'Отклонено', bg: '#fef2f2', color: '#b91c1c' },
  };
  
  const current = config[status] || { label: 'В процессе', bg: '#f3f4f6', color: '#4b5563' };
  
  return (
    <span style={{ 
      padding: '6px 12px', 
      borderRadius: '16px', 
      fontSize: '13px', 
      fontWeight: '500',
      backgroundColor: current.bg, 
      color: current.color,
      display: 'inline-block'
    }}>
      {current.label}
    </span>
  );
}

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockBackend.getAll().then(data => {
      setApps(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Загрузка...</div>;

  // Считаем метрики
  const activeApps = apps.filter(a => !['DRAFT', 'ISSUED', 'REJECTED'].includes(a.status)).length;
  const approvedAmount = apps.filter(a => a.approved_amount).reduce((sum, a) => sum + Number(a.approved_amount), 0);
  
  const actionRequiredApp = apps.find(a => a.status === 'NEEDS_INFO');
  const latestApp = apps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  // Логика для бизнеса
  const companyName = user?.company_name || user?.company;
  const subtitle = companyName 
    ? `${companyName} · Ваш бизнес движется вперед` 
    : 'Вдохновляем ваш бизнес на новые высоты';

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Приветствие */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', color: '#111827' }}>
            Добрый день, {user?.name || 'Александр'}
          </h1>
          <p style={{ margin: 0, color: '#6b7280' }}>{subtitle}</p>
        </div>
      </div>

      {/* Баннер */}
      <div className="hero-banner">
        <div>
          <h2>Финансирование для роста бизнеса</h2>
          <p>На оборотные средства, оборудование и новые возможности</p>
        </div>
        <Button 
          onClick={() => navigate('/client/applications/new')}
          style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold' }}
        >
          Подать заявку
        </Button>
      </div>

      {/* Метрики */}
      <div className="dashboard-grid">
        <div className="metric-card">
          <span style={{ color: '#6b7280', fontSize: '14px' }}>Активные заявки</span>
          <p className="metric-card__value">{activeApps}</p>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>
            {actionRequiredApp ? 'Одна заявка требует вашего ответа' : 'Все заявки в процессе'}
          </span>
        </div>
        
        <div className="metric-card">
          <span style={{ color: '#6b7280', fontSize: '14px' }}>Одобренная сумма</span>
          <p className="metric-card__value">{new Intl.NumberFormat('ru-RU').format(approvedAmount)} ₽</p>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>Предложение готово к просмотру</span>
        </div>

        <div className="metric-card">
          <span style={{ color: '#6b7280', fontSize: '14px' }}>Ваш следующий шаг</span>
          <p className="metric-card__value">
            {actionRequiredApp ? 'Дополнить данные' : 'Подать заявку'}
          </p>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>
            {actionRequiredApp ? `Заявка №${actionRequiredApp.id} · оборотный кредит` : 'Выберите подходящий продукт'}
          </span>
        </div>
      </div>

      {/* Нижняя часть: Список заявок и Карточка действия */}
      <div className="bottom-layout">
        <div className="clean-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Мои заявки</h3>
            <button type="button" className="text-link" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} onClick={() => navigate('/client/applications')}>
              Все заявки →
            </button>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#6b7280', fontSize: '13px', borderBottom: '1px solid #f3f4f6' }}>
                <th style={{ paddingBottom: '12px', fontWeight: 'normal' }}>Продукт</th>
                <th style={{ paddingBottom: '12px', fontWeight: 'normal' }}>Сумма</th>
                <th style={{ paddingBottom: '12px', fontWeight: 'normal' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {apps.slice(0, 3).map(app => (
                <tr key={app.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 0' }}>
                    <strong style={{ display: 'block', color: '#111827', marginBottom: '4px' }}>Оборотный кредит</strong>
                    <span style={{ color: '#dc2626', fontSize: '12px', cursor: 'pointer' }} onClick={() => navigate(`/client/applications/${app.id}`)}>
                      Открыть заявку →
                    </span>
                  </td>
                  <td style={{ padding: '16px 0', fontWeight: 'bold' }}>
                    {new Intl.NumberFormat('ru-RU').format(app.requested_amount || 0)} ₽
                  </td>
                  <td style={{ padding: '16px 0' }}>
                    {/* Используем нашу новую функцию статусов */}
                    {getStatusBadge(app.status)}
                  </td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr><td colSpan="3" style={{ padding: '20px 0', color: '#6b7280' }}>У вас пока нет заявок</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Правая колонка - Текущий шаг */}
        <div className="clean-card">
          {latestApp ? (
            <>
              <h3>Заявка №{latestApp.id}</h3>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>Что происходит сейчас</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ color: '#10b981' }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Заявка отправлена</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ color: '#10b981' }}>✓</span>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Проверки выполнены</span>
                </div>
                
                {latestApp.status === 'NEEDS_INFO' && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ color: '#dc2626' }}>●</span>
                    <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: 'bold' }}>Нужны сведения о выручке</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', opacity: 0.5 }}>
                  <span style={{ color: '#9ca3af' }}>○</span>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Решение банка</span>
                </div>
              </div>

              <Button 
                onClick={() => navigate(`/client/applications/${latestApp.id}`)}
                style={{ width: '100%', backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold' }}
              >
                {latestApp.status === 'NEEDS_INFO' ? 'Дополнить заявку' : 'Открыть заявку'}
              </Button>
            </>
          ) : (
            <p style={{ color: '#6b7280' }}>У вас пока нет активных заявок.</p>
          )}
        </div>
      </div>
    </div>
  );
}