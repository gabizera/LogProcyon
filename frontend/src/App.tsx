import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import api from './api';
import LoginPage     from './pages/Login';
import Dashboard     from './pages/Dashboard';
import LogSearch     from './pages/LogSearch';
import JudicialSearch from './pages/JudicialSearch';
import Inputs        from './pages/Inputs';
import UsersPage     from './pages/Users';
import SettingsPage  from './pages/Settings';
import StoragePage   from './pages/Storage';

// Cada item declara quais roles podem enxergá-lo no nav.
// Admin ignora tudo e vê sempre, outros perfis filtram por roles.
const nav: { to: string; label: string; roles: string[] }[] = [
  { to: '/',         label: 'DASHBOARD',     roles: ['admin', 'operator', 'viewer'] },
  { to: '/logs',     label: 'LOGS',          roles: ['admin', 'operator', 'viewer'] },
  { to: '/judicial', label: 'JUDICIAL',      roles: ['admin', 'operator']           },
  { to: '/storage',  label: 'ARMAZENAMENTO', roles: ['admin', 'operator', 'viewer'] },
  { to: '/inputs',   label: 'INPUTS',        roles: ['admin', 'operator', 'viewer'] },
  { to: '/users',    label: 'USUÁRIOS',      roles: ['admin']                       },
  { to: '/settings', label: 'CONFIG',        roles: ['admin']                       },
];

export default function App() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const [online, setOnline] = useState(true);
  const [platformName, setPlatformName] = useState('LogProcyon');

  useEffect(() => {
    const check = () => api.get('/config/public')
      .then(({ data }) => {
        setOnline(true);
        if (data.platform_name) {
          setPlatformName(data.platform_name);
          document.title = data.platform_name;
        }
      })
      .catch(() => setOnline(false));
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-0)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--signal)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return <LoginPage platformName={platformName} />;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-0)' }}>

      {/* ── Top status bar (tmux-style) ─────────────────────────── */}
      <div className="statusbar">
        <span className="pill">LOGPROCYON</span>
        <span><span className="k">plataforma</span><b>{platformName}</b></span>
        <span><span className="k">modo</span><b>multi-tenant</b></span>
        <div className="right">
          <span><span className="k">usuário</span><b>{user.username}</b></span>
          <span><span className="k">perfil</span><b>{(user.role || 'viewer').toUpperCase()}</b></span>
          <span>
            <span className="k">backend</span>
            <b style={{ color: online ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {online ? '● ok' : '● down'}
            </b>
          </span>
          <button
            onClick={logout}
            className="topnav-link"
            style={{ marginLeft: 4, cursor: 'pointer', background: 'transparent' }}
            title="Sair"
          >
            SAIR
          </button>
        </div>
      </div>

      {/* ── Global nav strip ────────────────────────────────────── */}
      <nav
        className="flex items-center gap-2 px-6 hairline-b"
        style={{ height: 'var(--nav-h)', background: 'var(--bg-0)' }}
      >
        {nav.filter(item => item.roles.includes(user.role)).map(item => {
          const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
          return (
            <NavLink key={item.to} to={item.to} className={`topnav-link ${isActive ? 'active' : ''}`}>
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-0)' }}>
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/logs"      element={<LogSearch />} />
          <Route path="/judicial"  element={<RoleGate role={user.role} allow={['admin', 'operator']}><JudicialSearch /></RoleGate>} />
          <Route path="/storage"   element={<StoragePage />} />
          <Route path="/inputs"    element={<Inputs />} />
          <Route path="/users"     element={<RoleGate role={user.role} allow={['admin']}><UsersPage /></RoleGate>} />
          <Route path="/settings"  element={<RoleGate role={user.role} allow={['admin']}><SettingsPage /></RoleGate>} />
        </Routes>
      </main>
    </div>
  );
}

function RoleGate({ role, allow, children }: { role: string; allow: string[]; children: React.ReactNode }) {
  if (allow.includes(role)) return <>{children}</>;
  return (
    <div className="max-w-md mx-auto">
      <div className="title-row">
        <h2>acesso<span className="accent"> / negado</span></h2>
        <span className="meta">perfil {role.toUpperCase()} não tem permissão</span>
      </div>
      <div className="px-6 pt-8">
        <div className="hairline p-6" style={{ background: 'var(--bg-1)' }}>
          <p className="text-xs" style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
            Esta área só está disponível para perfis: <strong style={{ color: 'var(--signal)' }}>{allow.join(', ').toUpperCase()}</strong>.
            Fale com um administrador se você precisar de acesso.
          </p>
        </div>
      </div>
    </div>
  );
}
