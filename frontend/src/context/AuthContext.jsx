import { createContext, useContext, useState, useEffect } from 'react';
import { createCreditApi } from '../api/creditApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Создаем API с правильными коллбэками
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
    
    api.me()
      .then(userData => setUser(userData))
      .catch(() => {
        sessionStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    // ВРЕМЕННАЯ ЗАГЛУШКА (Пока нет бэка)
    if (password === '123') {
      const fakeRole = email.includes('employee') ? 'employee' : 'client';
      const fakeResponse = { 
        token: 'fake-jwt-token', 
        user: { role: fakeRole, name: email, email: email } 
      };
      sessionStorage.setItem('token', fakeResponse.token);
      setUser(fakeResponse.user);
      return fakeResponse.user.role;
    }
    
    // РЕАЛЬНЫЙ КОД (раскомментировать, когда появится бэк)
    // const response = await api.login({ email, password });
    // sessionStorage.setItem('token', response.token);
    // setUser(response.user);
    // return response.user.role; 
    
    throw new Error('Неверный пароль (введите 123)');
  };

  const logout = () => {
    sessionStorage.removeItem('token');
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