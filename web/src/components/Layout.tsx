import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useFetch } from '../lib/hooks';

const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const { data: unread } = useFetch<number>('/notifications/unread-count');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          Yard<span>ERP</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={link}>
            Dashboard
          </NavLink>
          <div className="sect">Operations</div>
          <NavLink to="/sales" className={link}>
            Sales &amp; Billing
          </NavLink>
          <NavLink to="/purchases" className={link}>
            Purchases
          </NavLink>
          <NavLink to="/payments" className={link}>
            Payments
          </NavLink>
          <NavLink to="/inventory" className={link}>
            Stock
          </NavLink>
          <div className="sect">Parties</div>
          <NavLink to="/customers" className={link}>
            Customers
          </NavLink>
          <NavLink to="/vendors" className={link}>
            Vendors
          </NavLink>
          {isAdmin && (
            <>
              <div className="sect">Admin</div>
              <NavLink to="/materials" className={link}>
                Materials
              </NavLink>
              <NavLink to="/day-close" className={link}>
                Day Close
              </NavLink>
              <NavLink to="/reports" className={link}>
                Reports
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="flex">
            <NavLink to="/notifications" className="flex">
              🔔
              {!!unread && <span className="badge">{unread}</span>}
            </NavLink>
          </div>
          <div className="flex">
            <span className="muted" style={{ fontSize: 13 }}>
              {user?.name} · {user?.role.replace('_', ' ')}
            </span>
            <button
              className="btn sm gray"
              onClick={() => {
                logout();
                nav('/login');
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
