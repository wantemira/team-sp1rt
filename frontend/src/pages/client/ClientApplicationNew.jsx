import { useState, useEffect } from 'react';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { ApplicationForm } from '../../components/credit';
import { useNavigate } from 'react-router-dom';
import { mockBackend } from '../../api/mockBackend';
import { getFieldErrors } from '../../api/client';

export default function ClientApplicationNew() {
  const navigate = useNavigate();
  
  // Восстанавливаем ID из localStorage, если страницу обновили
  const [appId, setAppId] = useState(() => localStorage.getItem('current_draft_id'));
  const [version, setVersion] = useState(1); // Локально держим версию для отправки
  const [values, setValues] = useState({
    requested_amount: '', requested_term_months: '', purpose: '',
    annual_revenue: '', annual_expenses: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // При загрузке, если есть черновик, подтягиваем его данные
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
      }).catch(() => {
        // Если черновик не найден (например, почистили localStorage), сбрасываем
        localStorage.removeItem('current_draft_id');
        setAppId(null);
      });
    }
  }, [appId]);

  // Сохранение (PATCH или POST)
  const handleSave = async (data) => {
    setIsSaving(true);
    setError('');
    try {
      if (!appId) {
        const newApp = await mockBackend.create(data);
        setAppId(newApp.id);
        setVersion(newApp.version);
        localStorage.setItem('current_draft_id', newApp.id); // Запоминаем для перезагрузки
        alert(`Черновик №${newApp.id} создан!`);
      } else {
        const updatedApp = await mockBackend.update(appId, { ...data, version });
        setVersion(updatedApp.version);
        alert('Черновик обновлен!');
      }
    } catch (err) {
      if (err.status === 422) {
        setFieldErrors(getFieldErrors(err)); // Передаем в ApplicationForm пропс errors
      } else {
        setError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Отправка
  const handleSubmit = async (data) => {
    setIsSaving(true);
    setError('');
    try {
      let currentId = appId;
      let currentVersion = version;

      // 1. Если черновика нет, создаем
      if (!currentId) {
        const newApp = await mockBackend.create(data);
        currentId = newApp.id;
        currentVersion = newApp.version;
      } else {
        // 2. Если есть, но поля изменились — обновляем
        const updatedApp = await mockBackend.update(currentId, { ...data, version });
        currentVersion = updatedApp.version;
      }

      // 3. Отправляем
      await mockBackend.submit(currentId, currentVersion);
      
      localStorage.removeItem('current_draft_id'); // Очищаем память черновика
      alert('Заявка успешно отправлена на рассмотрение!');
      navigate(`/client/applications/${currentId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader 
        title={appId ? `Редактирование черновика №${appId}` : "Новая заявка"} 
        description="Кредит на оборотные средства" 
        action={<Button variant="secondary" onClick={() => navigate('/client/applications')}>Назад</Button>}
      />
      <Card>
        <ApplicationForm 
          values={values}
          onChange={setValues}
          onSave={handleSave}
          onSubmit={handleSubmit}
          busy={isSaving}
          error={error}
        />
      </Card>
    </>
  );
}