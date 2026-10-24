import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui';
import { useNavigate } from 'react-router-dom';

export default function ClientProducts() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader 
        title="Продукты" 
        description="Финансовые решения для вашего бизнеса" 
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
        
        <div className="clean-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#111827' }}>
              Кредит на оборотные средства
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: '1.5' }}>
              Финансирование текущей деятельности: закупка товаров, оплата аренды, выплата зарплат и другие операционные расходы.
            </p>
            <ul style={{ paddingLeft: '20px', margin: '0 0 24px 0', color: '#374151', lineHeight: '1.8' }}>
              <li>Сумма: от 100 000 до 5 000 000 ₽</li>
              <li>Срок: 6, 12 или 24 месяца</li>
              <li>Решение за 1 день</li>
            </ul>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              onClick={() => navigate('/client/applications/new')}
              style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold' }}
            >
              Оформить заявку
            </Button>
          </div>
        </div>
        
      </div>
    </div>
  );
}