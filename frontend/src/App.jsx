import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

import { AppShell } from './components/layout/AppShell';
import { ComponentsDemo } from './demo/ComponentsDemo';
import { Card } from './components/ui';

// Импорт страниц клиента
import ClientDashboard from './pages/client/ClientDashBoard';
import ClientApplications from './pages/client/ClientApplications';
import ClientApplicationNew from './pages/client/ClientApplicationNew';
import ClientApplicationDetail from './pages/client/ClientApplicationDetail';
import ClientProducts from './pages/client/ClientProducts';

function ProtectedRoute({ children, allowedRole }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'client' ? '/client' : '/employee/applications'} replace />;
  }
  return children;
}

// Заглушка для документов
function ClientDocuments() {
  return <Card title="Документы">Здесь будут ваши документы (пока в разработке).</Card>;
}

function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Определяем активный пункт меню по URL
  let activeItem = 'dashboard';
  if (location.pathname.includes('/products')) activeItem = 'application';
  if (location.pathname.includes('/applications')) activeItem = 'applications';
  if (location.pathname.includes('/documents')) activeItem = 'documents';

  // Словарь: как кнопка в меню называется -> куда она ведет
  const pathMap = {
    'dashboard': '/client',
    'applications': '/client/applications',
    'application': '/client/products', // Кнопка "Продукты"
    'documents': '/client/documents',
  };

  return (
    <AppShell 
      role="client" 
      activeItem={activeItem} 
      userName={user?.name || user?.email} 
      onLogout={useAuth().logout}
      onNavigate={(menuItem) => {
        // Переводим 'dashboard' в '/client', 'applications' в '/client/applications' и т.д.
        navigate(pathMap[menuItem] || '/client');
      }}
    >
      <Routes>
        <Route path="/" element={<ClientDashboard />} />
        <Route path="/products" element={<ClientProducts />} />
        <Route path="/applications" element={<ClientApplications />} />
        <Route path="/applications/new" element={<ClientApplicationNew />} />
        <Route path="/applications/:id" element={<ClientApplicationDetail />} />
        <Route path="/documents" element={<ClientDocuments />} />
      </Routes>
    </AppShell>
  );
}

function EmployeeDashboard() {
  const { user, logout } = useAuth();
  return (
    <AppShell role="employee" activeItem="queue" userName={user?.name || user?.email} onLogout={logout} onNavigate={() => {}}>
      <h1>Кабинет сотрудника</h1>
      <p>Очередь заявок (в разработке)</p>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/client/*" element={
            <ProtectedRoute allowedRole="client">
              <ClientLayout />
            </ProtectedRoute>
          } />

          <Route path="/employee/*" element={
            <ProtectedRoute allowedRole="employee">
              <Routes>
                <Route path="/applications" element={<EmployeeDashboard />} />
              </Routes>
            </ProtectedRoute>
          } />

          <Route path="/dev" element={<div style={{ padding: 20 }}><ComponentsDemo /></div>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}