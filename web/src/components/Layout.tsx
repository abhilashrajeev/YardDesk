import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useFetch, notificationsBus } from '../lib/hooks';
import { Icon } from './Icon';

const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/sales': 'Sales & Billing',
  '/purchases': 'Purchases',
  '/payments': 'Payments',
  '/outstanding': 'Outstanding & Pending',
  '/inventory': 'Stock Monitoring',
  '/customers': 'Customers',
  '/vendors': 'Vendors',
  '/materials': 'Materials',
  '/day-close': 'Day Close',
  '/reports': 'Reports & Analytics',
  '/notifications': 'Notifications',
};

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const { data: unread, refetch: refetchUnread } = useFetch<number>('/notifications/unread-count');
  useEffect(() => {
    notificationsBus.addEventListener('changed', refetchUnread);
    return () => notificationsBus.removeEventListener('changed', refetchUnread);
  }, [refetchUnread]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div className="brand-name">
            Devi Traders
            <small>Yard ERP</small>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={link}>
            <Icon name="grid" size={18} /> Dashboard
          </NavLink>

          <div className="sect">Operations</div>
          <NavLink to="/sales" className={link}>
            <Icon name="cart" size={18} /> Sales &amp; Billing
          </NavLink>
          <NavLink to="/purchases" className={link}>
            <Icon name="truck" size={18} /> Purchases
          </NavLink>
          <NavLink to="/payments" className={link}>
            <Icon name="wallet" size={18} /> Payments
          </NavLink>
          <NavLink to="/outstanding" className={link}>
            <Icon name="clock" size={18} /> Outstanding
          </NavLink>
          <NavLink to="/inventory" className={link}>
            <Icon name="box" size={18} /> Stock
          </NavLink>

          <div className="sect">Parties</div>
          <NavLink to="/customers" className={link}>
            <Icon name="users" size={18} /> Customers
          </NavLink>
          <NavLink to="/vendors" className={link}>
            <Icon name="briefcase" size={18} /> Vendors
          </NavLink>

          {isAdmin && (
            <>
              <div className="sect">Admin</div>
              <NavLink to="/materials" className={link}>
                <Icon name="layers" size={18} /> Materials
              </NavLink>
              <NavLink to="/day-close" className={link}>
                <Icon name="calendar" size={18} /> Day Close
              </NavLink>
              <NavLink to="/reports" className={link}>
                <Icon name="chart" size={18} /> Reports
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="page-title">{TITLES[loc.pathname] ?? 'Yard ERP'}</div>
          <div className="flex" style={{ gap: 16 }}>
            <NavLink to="/notifications" className="icon-btn" title="Notifications">
              <Icon name="bell" size={19} />
              {!!unread && <span className="badge">{unread}</span>}
            </NavLink>
            <div className="user-chip">
              <div className="avatar">{initials(user?.name)}</div>
              <div>
                <div className="nm">{user?.name}</div>
                <div className="rl">{user?.role.replace('_', ' ')}</div>
              </div>
            </div>
            <button
              className="icon-btn"
              title="Logout"
              onClick={() => {
                logout();
                nav('/login');
              }}
            >
              <Icon name="logout" size={18} />
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
