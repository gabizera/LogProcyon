import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Shield,
  Radio,
  Users,
  Settings,
  Wifi,
  HardDrive,
  LogOut,
} from 'lucide-react';
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

const monitoringNav = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard'         },
  { to: '/logs',     icon: Search,          label: 'Busca de Logs'     },
  { to: '/judicial', icon: Shield,          label: 'Consulta Judicial' },
  { to: '/storage',  icon: HardDrive,       label: 'Armazenamento'     },
];

const systemNav = [
  { to: '/inputs',   icon: Radio,           label: 'Inputs'            },
  { to: '/users',    icon: Users,           label: 'Usuários'          },
  { to: '/settings', icon: Settings,        label: 'Configurações'     },
];

function NavSection({ title, items }: { title: string; items: typeof monitoringNav }) {
  const location = useLocation();
  return (
    <div>
      <div
        className="px-3 pb-1.5 text-[9px] font-semibold uppercase tracking-widest"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}
      >
        {title}
      </div>
      {items.map(({ to, icon: Icon, label }) => {
        const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            className={`nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${isActive ? 'active' : ''}`}
            style={{
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

export default function App() {
  const { user, logout, loading } = useAuth();
  const [online, setOnline] = useState(true);
  const [platformName, setPlatformName] = useState('LogProcyon');

  useEffect(() => {
    const check = () => api.get('/config/public')
      .then(({ data }) => { setOnline(true); if (data.platform_name) { setPlatformName(data.platform_name); document.title = data.platform_name; } })
      .catch(() => setOnline(false));
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return <LoginPage platformName={platformName} />;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="flex flex-col shrink-0 border-r"
        style={{ width: 'var(--sidebar-w)', background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-4 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
              border: '1px solid rgba(59,130,246,0.2)',
            }}
          >
            <Wifi size={15} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              {platformName}
            </div>
            <div className="text-[9px] font-medium tracking-widest uppercase truncate" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              NAT · CGNAT · BPA
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-3 p-2 pt-3 overflow-y-auto">
          <NavSection title="Monitoramento" items={monitoringNav} />
          <NavSection title="Sistema"       items={systemNav} />
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="rounded-xl px-3 py-2.5 mb-2"
            style={{
              background: online ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
              border: `1px solid ${online ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`,
            }}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${online ? 'live-dot' : ''}`} style={{ background: online ? 'var(--accent-green)' : 'var(--accent-red)' }} />
              <span className="text-[11px] font-semibold" style={{ color: online ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
                {online ? 'CONECTADO' : 'SEM CONEXÃO'}
              </span>
            </div>
            <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {online ? 'Backend operacional' : 'Verifique o backend'}
            </div>
          </div>

          {/* User info + logout */}
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                {user.name || user.username}
              </div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {user.role}
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg cursor-pointer hover:brightness-125 transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.15)' }}
              title="Sair"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/logs"      element={<LogSearch />} />
          <Route path="/judicial"  element={<JudicialSearch />} />
          <Route path="/storage"   element={<StoragePage />} />
          <Route path="/inputs"    element={<Inputs />} />
          <Route path="/users"     element={<UsersPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
