import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, Field, InlineAlert, StatusBadge } from '../../components/ui';
import { Stepper, OfferSummary, StatusTimeline } from '../../components/credit';
import { useNavigate } from 'react-router-dom';
import { mockBackend } from '../../api/mockBackend';
import { PRODUCT } from '../../lib/contracts';
import { normalizeMoneyInput } from '../../lib/format';

export default function ClientApplicationNew() {
  const navigate = useNavigate();
  
  // 0 - Продукт, 1 - Параметры, 2 - О бизнесе, 3 - Проверка (Статус)
  const [step, setStep] = useState(0); 
  
  const [appId, setAppId] = useState(() => localStorage.getItem('current_draft_id'));
  const [version, setVersion] = useState(1);
  const [submittedApp, setSubmittedApp] = useState(null); // Для хранения данных после отправки
  
  const [values, setValues] = useState({
    requested_amount: '', requested_term_months: '', purpose: '',
    annual_revenue: '', annual_expenses: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Восстановление черновика
  useEffect(() => {
    if (appId) {
      mockBackend.getById(appId).then(app => {
        setValues({
          requested_amount: app.requested_amount || '',
          requested_term_months: app.requested_term_months || '',
          purpose: app.purpose || '',
          annual_revenue: app.business_data?.financials?.annual_revenue || '',
          annual_expenses: app.business_data?.financials?.annual_expenses || '',
        });
        setVersion(app.version);
        if (app.status !== 'DRAFT') {
          setSubmittedApp(app);
          setStep(3);
        }
      }).catch(() => {
        localStorage.removeItem('current_draft_id');
        setAppId(null);
      });
    }
  }, [appId]);

  const getPayload = () => {
    const financials = {};
    for (const key of ['annual_revenue', 'annual_expenses']) {
      if (values[key]?.trim()) financials[key] = normalizeMoneyInput(values[key]);
    }
    return {
      product_type: PRODUCT.product_type,
      requested_amount: values.requested_amount?.trim() ? normalizeMoneyInput(values.requested_amount) : null,
      requested_term_months: values.requested_term_months ? Number(values.requested_term_months) : null,
      purpose: values.purpose || null,
      business_data: { financials },
    };
  };

  const handleNext = () => {
    if (step === 1) {
      if (!values.requested_amount || !values.requested_term_months) {
        setError('Пожалуйста, укажите сумму и срок кредита');
        return;
      }
    }
    setError('');
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const data = getPayload();
      if (!appId) {
        const newApp = await mockBackend.create(data);
        setAppId(newApp.id);
        setVersion(newApp.version);
        localStorage.setItem('current_draft_id', newApp.id);
        alert(`Черновик №${newApp.id} создан!`);
      } else {
        const updatedApp = await mockBackend.update(appId, { ...data, version });
        setVersion(updatedApp.version);
        alert('Черновик обновлен!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError('');
    try {
      const data = getPayload();
      let currentId = appId;
      let currentVersion = version;

      if (!currentId) {
        const newApp = await mockBackend.create(data);
        currentId = newApp.id;
        currentVersion = newApp.version;
      } else {
        const updatedApp = await mockBackend.update(currentId, { ...data, version });
        currentVersion = updatedApp.version;
      }

      // Отправляем и сохраняем результат для 4-го шага
      const finalApp = await mockBackend.submit(currentId, currentVersion);
      localStorage.removeItem('current_draft_id');
      
      setSubmittedApp(finalApp);
      setStep(3); // Переходим на 4-й шаг, где показываем статус
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const steps = ['Продукт', 'Параметры', 'О бизнесе', 'Проверка'];

  // --- РЕНДЕР ШАГОВ ---
  const renderStep = () => {
    if (step === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '20px' }}>Кредит на оборотные средства</h3>
          <p style={{ color: '#6b7280', margin: 0, lineHeight: '1.6' }}>
            Финансирование текущей деятельности: закупка товаров, оплата аренды, выплата зарплат и другие операционные расходы.
          </p>
          <ul style={{ paddingLeft: '20px', margin: 0, color: '#374151', lineHeight: '1.8' }}>
            <li>Сумма: от 100 000 до 5 000 000 ₽</li>
            <li>Срок: 6, 12 или 24 месяца</li>
            <li>Решение за 1 день</li>
          </ul>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '20px' }}>Сколько нужно вашему бизнесу?</h3>
          <Field label="Сумма кредита" placeholder="От 100 000 ₽" value={values.requested_amount} onChange={e => setValues({...values, requested_amount: e.target.value})} />
          <Field as="select" label="Срок кредитования" value={values.requested_term_months} onChange={e => setValues({...values, requested_term_months: e.target.value})}>
            <option value="">Выберите срок</option>
            {PRODUCT.terms.map(t => <option key={t} value={t}>{t} месяцев</option>)}
          </Field>
          <Field label="Цель финансирования" placeholder="Например, закупка товаров" value={values.purpose} onChange={e => setValues({...values, purpose: e.target.value})} />
        </div>
      );
    }

    if (step === 2) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '20px' }}>Информация о бизнесе</h3>
          <p className="muted" style={{ margin: 0 }}>За последние 12 месяцев. Можно заполнить позже.</p>
          <Field label="Выручка за последние 12 месяцев" value={values.annual_revenue} onChange={e => setValues({...values, annual_revenue: e.target.value})} />
          <Field label="Расходы (без учета кредитов)" value={values.annual_expenses} onChange={e => setValues({...values, annual_expenses: e.target.value})} />
        </div>
      );
    }

    if (step === 3 && submittedApp) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '20px' }}>Статус заявки</h3>
            <StatusBadge status={submittedApp.status} />
          </div>
          <p className="muted" style={{ margin: 0 }}>Заявка №{submittedApp.id} успешно отправлена.</p>
          
          <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px' }}>
            <strong style={{ display: 'block', marginBottom: '8px' }}>История:</strong>
            <StatusTimeline history={submittedApp.status_history} />
          </div>
        </div>
      );
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <PageHeader 
        title={appId && step < 3 ? `Заявка №${appId}` : step === 3 ? `Заявка №${submittedApp?.id}` : "Новая заявка"} 
        description="Оборотный кредит · Заполните параметры финансирования" 
      />

      {/* Stepper */}
      <div style={{ margin: '24px 0', backgroundColor: 'white', padding: '16px 24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
        <Stepper steps={steps} current={step} onStepClick={(idx) => {
          // Не даем перепрыгнуть через шаги вперед, если заявка не отправлена
          if (idx <= step || submittedApp) setStep(idx);
        }} />
      </div>

      {error && <InlineAlert tone="danger" style={{ marginBottom: 20 }}>{error}</InlineAlert>}

      {/* Сетка: слева контент, справа карточка */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'stretch' }}>
        
        {/* Левая колонка */}
        <div className="clean-card" style={{ display: 'flex', flexDirection: 'column' }}>
          {renderStep()}
        </div>

        {/* Правая колонка */}
        <div style={{ position: 'sticky', top: '24px' }}>
          <OfferSummary 
            amount={submittedApp ? submittedApp.requested_amount : values.requested_amount} 
            term={submittedApp ? submittedApp.requested_term_months : values.requested_term_months} 
            approved={submittedApp?.status === 'APPROVED' || submittedApp?.status === 'ISSUED'} 
            rate={submittedApp?.approved_rate}
          />
        </div>

      </div>

      {/* Кнопки действий (вне окошка) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
        <div>
          {(step === 1 || step === 2) && (
            <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
              Сохранить черновик
            </Button>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {step > 0 && step < 3 && (
            <Button variant="secondary" onClick={handleBack} disabled={isSaving}>
              Назад
            </Button>
          )}
          
          {step === 0 && (
            <Button onClick={() => setStep(1)}>Продолжить →</Button>
          )}
          
          {step === 1 && (
            <Button onClick={handleNext}>Продолжить →</Button>
          )}
          
          {step === 2 && (
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Отправка...' : 'Отправить заявку'}
            </Button>
          )}

          {step === 3 && (
            <Button onClick={() => navigate('/client/applications')}>
              Перейти к моим заявкам
            </Button>
          )}
        </div>
      </div>

    </div>
  );
}