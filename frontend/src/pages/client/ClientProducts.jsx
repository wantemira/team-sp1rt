import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { useNavigate } from 'react-router-dom';

export default function ClientProducts() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader 
        title="Продукты" 
        description="Финансовые решения для вашего бизнеса" 
      />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <Card title="Кредит на оборотные средства">
          {/* Убрали жесткую высоту и flex-раздутие */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p className="muted">
              Финансирование текущей деятельности: закупка товаров, оплата аренды, выплата зарплат и другие операционные расходы.
            </p>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              <li>Сумма: от 100 000 до 5 000 000 ₽</li>
              <li>Срок: 6, 12 или 24 месяца</li>
              <li>Решение за 1 день</li>
            </ul>
            
            <div style={{ marginTop: '8px' }}>
              <Button 
                style={{ width: '100%' }} 
                onClick={() => navigate('/client/applications/new')}
              >
                Оформить заявку
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}