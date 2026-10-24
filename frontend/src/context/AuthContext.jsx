import { createContext, useContext, useState, useEffect } from 'react';
import { createCreditApi } from '../api/creditApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const api = createCreditApi({
    getToken: () => sessionStorage.getItem('token'),
    onUnauthorized: () => {
      sessionStorage.removeItem('token');
      setUser(null);
    }
  });

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    
    // ЖЕСТКАЯ ЗАГЛУШКА для восстановления сессии
    if (token === 'fake-jwt-token') {
      const savedUser = sessionStorage.getItem('fake_user');
      if (savedUser) setUser(JSON.parse(savedUser));
      setLoading(false);
      return;
    }

    // api.me() временно отключен, чтобы не было ECONNREFUSED
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    if (password === '123') {
      const fakeRole = email.includes('employee') ? 'employee' : 'client';
      const fakeResponse = { 
        token: 'fake-jwt-token', 
        user: { role: fakeRole, name: email.split('@')[0], email: email } 
      };
      sessionStorage.setItem('token', fakeResponse.token);
      sessionStorage.setItem('fake_user', JSON.stringify(fakeResponse.user));
      setUser(fakeResponse.user);
      return fakeResponse.user.role;
    }
    throw new Error('Неверный пароль (введите 123)');
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('fake_user');
    setUser(null);
  };

  if (loading) return <div style={{ padding: 20 }}>Загрузка...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);