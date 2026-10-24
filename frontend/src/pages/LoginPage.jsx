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
      if (role === 'employee') {
        navigate('/employee/applications');
      } else {
        navigate('/client');
      }
    } catch (err) {
      setError(err.message || 'Неверный email или пароль');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Card title="Вход в систему" style={{ width: 400 }}>
        {error && <InlineAlert type="error">{error}</InlineAlert>}
        
        <form onSubmit={handleSubmit} className="stack">
          <label>
            Email
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              disabled={isSubmitting}
            />
          </label>
          <label>
            Пароль
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              disabled={isSubmitting}
            />
          </label>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </Card>
    </div>
  );
}