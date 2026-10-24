import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

// Компоненты-заглушки для кабинетов (пока просто текст)
import { AppShell } from './components/layout/AppShell';
import { ComponentsDemo } from './demo/ComponentsDemo'; 

// Защитник маршрутов
function ProtectedRoute({ children, allowedRole }) {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) {
    // Если клиент пытается зайти к сотруднику — выкидываем его в его кабинет
    return <Navigate to={user.role === 'client' ? '/client' : '/employee/applications'} replace />;
  }
  return children;
}

// Заглушка для Главной клиента
function ClientDashboard() {
  const { user, logout } = useAuth();
  return (
    <AppShell role="client" activeItem="dashboard" userName={user.name || 'Клиент'} onNavigate={() => {}}>
      <h1>Кабинет клиента</h1>
      <p>Добро пожаловать, {user.email}</p>
      <button onClick={logout}>Выйти</button>
    </AppShell>
  );
}

// Заглушка для Кабинета сотрудника
function EmployeeDashboard() {
  const { user, logout } = useAuth();
  return (
    <AppShell role="employee" activeItem="applications" userName={user.name || 'Сотрудник'} onNavigate={() => {}}>
      <h1>Кабинет сотрудника</h1>
      <p>Очередь заявок</p>
      <button onClick={logout}>Выйти</button>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Публичный маршрут */}
          <Route path="/login" element={<LoginPage />} />

          {/* Маршруты клиента */}
          <Route path="/client/*" element={
            <ProtectedRoute allowedRole="client">
              <Routes>
                <Route path="/" element={<ClientDashboard />} />
                {/* Сюда позже добавим /applications, /applications/new и т.д. */}
              </Routes>
            </ProtectedRoute>
          } />

          {/* Маршруты сотрудника */}
          <Route path="/employee/*" element={
            <ProtectedRoute allowedRole="employee">
              <Routes>
                <Route path="/applications" element={<EmployeeDashboard />} />
                {/* Сюда позже добавим /applications/:id */}
              </Routes>
            </ProtectedRoute>
          } />

          {/* Страница разработки (сохраняем демо по ТЗ) */}
          <Route path="/dev" element={
            <div style={{ padding: 20 }}>
              <h1>Страница разработки</h1>
              <ComponentsDemo />
            </div>
          } />

          {/* Редиректы по умолчанию */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}