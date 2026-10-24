import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/AppShell';
import { Card, Button } from '../../components/ui';
import { mockBackend } from '../../api/mockBackend';

export default function EmployeeApplications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'ALL';

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Имитируем загрузку по фильтру. В реальном API здесь был бы Promise.all если ALL.
    mockBackend.employeeList(statusFilter).then(data => {
      setApps(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setLoading(false);
    });
  }, [statusFilter]);

  const handleFilterChange = (status) => {
    if (status === 'ALL') setSearchParams({});
    else setSearchParams({ status });
  };

  return (
    <>
      <PageHeader title="Очередь заявок" description="Заявки клиентов, требующие внимания" />
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Button variant={statusFilter === 'ALL' ? 'primary' : 'secondary'} onClick={() => handleFilterChange('ALL')}>Все активные</Button>
        <Button variant={statusFilter === 'MANUAL_REVIEW' ? 'primary' : 'secondary'} onClick={() => handleFilterChange('MANUAL_REVIEW')}>На проверке</Button>
        <Button variant={statusFilter === 'NEEDS_INFO' ? 'primary' : 'secondary'} onClick={() => handleFilterChange('NEEDS_INFO')}>Ждут клиента</Button>
        <Button variant={statusFilter === 'APPROVED' ? 'primary' : 'secondary'} onClick={() => handleFilterChange('APPROVED')}>Одобренные</Button>
      </div>

      <Card>
        {loading ? <div>Загрузка...</div> : apps.length === 0 ? (
          <div>Нет заявок с таким статусом.</div>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <th style={{ padding: '10px' }}>ID</th>
                <th style={{ padding: '10px' }}>Сумма</th>
                <th style={{ padding: '10px' }}>Статус</th>
                <th style={{ padding: '10px' }}>Дата</th>
                <th style={{ padding: '10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>№{app.id}</td>
                  <td style={{ padding: '10px' }}>{app.requested_amount} ₽</td>
                  <td style={{ padding: '10px' }}>{app.status}</td>
                  <td style={{ padding: '10px' }}>{new Date(app.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <Button variant="secondary" onClick={() => navigate(`/employee/applications/${app.id}`)}>Открыть</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}