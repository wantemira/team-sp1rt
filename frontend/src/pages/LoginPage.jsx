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
        <Card title="Вход в систему">
          <form onSubmit={handleSubmit} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {error && <InlineAlert type="error">{error}</InlineAlert>}
            
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span>Email</span>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                disabled={isSubmitting}
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                placeholder="client@test.com"
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
                placeholder="Введите 123"
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