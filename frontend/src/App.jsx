import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

import { AppShell } from './components/layout/AppShell';
import { ComponentsDemo } from './demo/ComponentsDemo';
import { Card } from './components/ui';

// Клиентские страницы
import ClientDashboard from './pages/client/ClientDashBoard';
import ClientApplications from './pages/client/ClientApplications';
import ClientApplicationNew from './pages/client/ClientApplicationNew';
import ClientApplicationDetail from './pages/client/ClientApplicationDetail';
import ClientDocuments from './pages/client/ClientDocuments';
import ClientProducts from './pages/client/ClientProducts';

// Страницы сотрудника (создадим ниже)
import EmployeeApplications from './pages/employee/EmployeeApplications';
import EmployeeApplicationDetail from './pages/employee/EmployeeApplicationDetail';

function ProtectedRoute({ children, allowedRole }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'client' ? '/client' : '/employee/applications'} replace />;
  }
  return children;
}

function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  let activeItem = 'dashboard';
  if (location.pathname.includes('/products')) activeItem = 'application';
  if (location.pathname.includes('/applications')) activeItem = 'applications';
  if (location.pathname.includes('/documents')) activeItem = 'documents';

  const pathMap = {
    'dashboard': '/client', 'applications': '/client/applications',
    'application': '/client/products', 'documents': '/client/documents',
  };

  return (
    <AppShell role="client" activeItem={activeItem} userName={user?.name || user?.email} onLogout={logout} onNavigate={(item) => navigate(pathMap[item] || '/client')}>
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

function EmployeeLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // Определяем активный пункт меню
  let activeItem = 'queue';
  if (location.search.includes('status=REVIEW')) activeItem = 'review';
  if (location.search.includes('status=HISTORY')) activeItem = 'history';

  const pathMap = {
    'queue': '/employee/applications', // Очередь
    'review': '/employee/applications?status=REVIEW', // На рассмотрении
    'history': '/employee/applications?status=HISTORY' // История
  };

  return (
    <AppShell role="employee" activeItem={activeItem} userName={user?.name || user?.email} onLogout={logout} onNavigate={(item) => navigate(pathMap[item] || '/employee/applications')}>
      <Routes>
        <Route path="/applications" element={<EmployeeApplications />} />
        <Route path="*" element={<Navigate to="/employee/applications" replace />} />
      </Routes>
    </AppShell>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/client/*" element={<ProtectedRoute allowedRole="client"><ClientLayout /></ProtectedRoute>} />
          <Route path="/employee/*" element={<ProtectedRoute allowedRole="employee"><EmployeeLayout /></ProtectedRoute>} />

          <Route path="/dev" element={<div style={{ padding: 20 }}><ComponentsDemo /></div>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}