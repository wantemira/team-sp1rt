import { useState } from 'react';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { ApplicationForm } from '../../components/credit';
import { useNavigate } from 'react-router-dom';

export default function ClientApplicationNew() {
  const navigate = useNavigate();
  
  // Стейт для полей формы (обязательно для ApplicationForm)
  const [values, setValues] = useState({
    requested_amount: '',
    requested_term_months: '',
    purpose: '',
    annual_revenue: '',
    annual_expenses: ''
  });

  return (
    <>
      <PageHeader 
        title="Новая заявка" 
        description="Кредит на оборотные средства" 
        action={<Button variant="secondary" onClick={() => navigate('/client/applications')}>Назад</Button>}
      />
      <Card>
        <ApplicationForm 
          values={values}
          onChange={setValues}
          onSubmit={(data) => {
            console.log('Отправка (Submit):', data);
            alert('Форма отправлена! Проверь консоль.');
            navigate('/client/applications');
          }} 
          onSave={(data) => {
            console.log('Сохранение (Draft):', data);
            alert('Черновик сохранен! Проверь консоль.');
          }}
        />
      </Card>
    </>
  );
}