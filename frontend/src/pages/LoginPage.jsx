import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, InlineAlert } from '../components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const role = await login(email, password);
      navigate(role === 'employee' ? '/employee/applications' : '/client');
    } catch (err) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-subtle, #f4f5f7)' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: 20 }}>
        <Card title="Вход в кредитный кабинет">
          <p className="muted">Демонстрационный ИП: demo.ip@example.com. Пароль указан в настройках запуска стенда.</p>
          <details><summary>Клиент и сотрудник: какой аккаунт выбрать</summary><p className="muted">demo.review@example.com — клиент, чья заявка передаётся на ручное рассмотрение.</p><p className="muted">test.employee1@example.com и test.employee2@example.com — сотрудники, которые рассматривают заявки.</p></details>
          <form onSubmit={handleSubmit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {error && <InlineAlert tone="danger">{error}</InlineAlert>}
            
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span>Электронная почта</span>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                disabled={isSubmitting}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                placeholder="demo.ip@example.com"
                autoComplete="username"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span>Пароль</span>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                disabled={isSubmitting}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                placeholder="Пароль учётной записи"
                autoComplete="current-password"
              />
            </label>
            <Button type="submit" disabled={isSubmitting} style={{ marginTop: '8px', width: '100%' }}>
              {isSubmitting ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
