import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Payments from './pages/Payments';
import Outstanding from './pages/Outstanding';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Vendors from './pages/Vendors';
import Materials from './pages/Materials';
import DayClose from './pages/DayClose';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import Expenses from './pages/Expenses';
import Vehicles from './pages/Vehicles';
import AuditLog from './pages/AuditLog';
import Users from './pages/Users';
import Profile from './pages/Profile';
import UpdatePrompt from './components/UpdatePrompt';

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function SuperAdminOnly({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user?.role === 'SUPER_ADMIN' ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <>
    <UpdatePrompt />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="sales" element={<Sales />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="payments" element={<Payments />} />
        <Route path="outstanding" element={<Outstanding />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="customers" element={<Customers />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="materials" element={<Materials />} />
        <Route path="day-close" element={<DayClose />} />
        <Route path="reports" element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="audit-log" element={<SuperAdminOnly><AuditLog /></SuperAdminOnly>} />
        <Route path="users" element={<SuperAdminOnly><Users /></SuperAdminOnly>} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
