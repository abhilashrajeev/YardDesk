import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useFetch, notificationsBus, titleCase } from '../lib/hooks';
import { Icon } from './Icon';
import QuickSearch from './QuickSearch';
import type { Permission } from '../types';

const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/sales': 'Sales & Billing',
  '/purchases': 'Purchases',
  '/payments': 'Payments',
  '/outstanding': 'Outstanding & Pending',
  '/inventory': 'Stock Monitoring',
  '/mixing': 'Mixing',
  '/customers': 'Customers',
  '/vendors': 'Vendors',
  '/materials': 'Materials',
  '/day-close': 'Day Close',
  '/reports': 'Reports & Analytics',
  '/notifications': 'Notifications',
  '/expenses': 'Expenses',
  '/vehicles': 'Vehicles',
  '/audit-log': 'Audit Log',
  '/users': 'Users',
  '/profile': 'My Profile',
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
  // SUPER_ADMIN always has full access; ADMIN/EMPLOYEE only see modules they've been granted.
  const can = (p: Permission) => user?.role === 'SUPER_ADMIN' || !!user?.permissions.includes(p);
  const { data: unread, refetch: refetchUnread } = useFetch<number>('/notifications/unread-count');
  useEffect(() => {
    notificationsBus.addEventListener('changed', refetchUnread);
    return () => notificationsBus.removeEventListener('changed', refetchUnread);
  }, [refetchUnread]);

  const [navOpen, setNavOpen] = useState(false);
  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [loc.pathname]);

  // Only pages this user can actually reach show up in quick-search — mirrors the sidebar's own gating.
  const searchItems = [
    { path: '/', label: TITLES['/'] },
    ...(can('SALES') ? [{ path: '/sales', label: TITLES['/sales'] }] : []),
    ...(can('PURCHASES') ? [{ path: '/purchases', label: TITLES['/purchases'] }] : []),
    ...(can('PAYMENTS') ? [{ path: '/payments', label: TITLES['/payments'] }] : []),
    { path: '/outstanding', label: TITLES['/outstanding'] },
    ...(can('STOCK') ? [{ path: '/inventory', label: TITLES['/inventory'] }] : []),
    ...(can('STOCK') ? [{ path: '/mixing', label: TITLES['/mixing'] }] : []),
    ...(can('EXPENSES') ? [{ path: '/expenses', label: TITLES['/expenses'] }] : []),
    { path: '/customers', label: TITLES['/customers'] },
    { path: '/vendors', label: TITLES['/vendors'] },
    { path: '/vehicles', label: TITLES['/vehicles'] },
    ...(isAdmin
      ? [
          { path: '/materials', label: TITLES['/materials'] },
          { path: '/day-close', label: TITLES['/day-close'] },
          { path: '/reports', label: TITLES['/reports'] },
        ]
      : []),
    ...(user?.role === 'SUPER_ADMIN'
      ? [
          { path: '/audit-log', label: TITLES['/audit-log'] },
          { path: '/users', label: TITLES['/users'] },
        ]
      : []),
    { path: '/profile', label: TITLES['/profile'] },
  ];

  return (
    <div className="app">
      {navOpen && <div className="nav-backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/brand/devi-header.png" alt="Devi Traders" className="brand-logo" />
          <button className="icon-btn nav-close" title="Close menu" onClick={() => setNavOpen(false)}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={link}>
            <Icon name="grid" size={18} /> Dashboard
          </NavLink>

          <div className="sect">Operations</div>
          {can('SALES') && (
            <NavLink to="/sales" className={link}>
              <Icon name="cart" size={18} /> Sales &amp; Billing
            </NavLink>
          )}
          {can('PURCHASES') && (
            <NavLink to="/purchases" className={link}>
              <Icon name="truck" size={18} /> Purchases
            </NavLink>
          )}
          {can('PAYMENTS') && (
            <NavLink to="/payments" className={link}>
              <Icon name="wallet" size={18} /> Payments
            </NavLink>
          )}
          <NavLink to="/outstanding" className={link}>
            <Icon name="clock" size={18} /> Outstanding
          </NavLink>
          {can('STOCK') && (
            <NavLink to="/inventory" className={link}>
              <Icon name="box" size={18} /> Stock
            </NavLink>
          )}
          {can('STOCK') && (
            <NavLink to="/mixing" className={link}>
              <Icon name="blend" size={18} /> Mixing
            </NavLink>
          )}
          {can('EXPENSES') && (
            <NavLink to="/expenses" className={link}>
              <Icon name="receipt" size={18} /> Expenses
            </NavLink>
          )}

          <div className="sect">Parties</div>
          <NavLink to="/customers" className={link}>
            <Icon name="users" size={18} /> Customers
          </NavLink>
          <NavLink to="/vendors" className={link}>
            <Icon name="briefcase" size={18} /> Vendors
          </NavLink>
          <NavLink to="/vehicles" className={link}>
            <Icon name="truck" size={18} /> Vehicles
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
              {user?.role === 'SUPER_ADMIN' && (
                <>
                  <NavLink to="/audit-log" className={link}>
                    <Icon name="history" size={18} /> Audit Log
                  </NavLink>
                  <NavLink to="/users" className={link}>
                    <Icon name="users" size={18} /> Users
                  </NavLink>
                </>
              )}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <span className="label">Powered by</span>
          <img src="/brand/logo-full.png" alt="YardDesk" />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="flex" style={{ gap: 10 }}>
            <button className="icon-btn nav-toggle" title="Menu" onClick={() => setNavOpen(true)}>
              <Icon name="menu" size={19} />
            </button>
            <div className="page-title">{TITLES[loc.pathname] ?? 'YardDesk'}</div>
          </div>
          <QuickSearch items={searchItems} />
          <div className="flex" style={{ gap: 16 }}>
            <NavLink to="/notifications" className="icon-btn" title="Notifications">
              <Icon name="bell" size={19} />
              {!!unread && <span className="badge">{unread}</span>}
            </NavLink>
            <NavLink to="/profile" className="user-chip" title="My Profile">
              <div className="avatar">{initials(user?.name)}</div>
              <div>
                <div className="nm">{user?.name}</div>
                <div className="rl">{user ? titleCase(user.role.replace('_', ' ')) : ''}</div>
              </div>
              <Icon name="chevron-down" size={15} className="muted" />
            </NavLink>
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
