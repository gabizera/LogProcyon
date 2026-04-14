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

const nav = [
  { to: '/',         label: 'OVERVIEW'  },
  { to: '/logs',     label: 'QUERY'     },
  { to: '/judicial', label: 'FORENSIC'  },
  { to: '/storage',  label: 'STORAGE'   },
  { to: '/inputs',   label: 'SOURCES'   },
  { to: '/users',    label: 'USERS'     },
  { to: '/settings', label: 'CONF'      },
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
        <span><span className="k">source</span><b>{platformName}</b></span>
        <span><span className="k">mode</span><b>multi-tenant</b></span>
        <div className="right">
          <span><span className="k">user</span><b>{user.username}</b></span>
          <span><span className="k">role</span><b>{(user.role || 'viewer').toUpperCase()}</b></span>
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
            LOGOUT
          </button>
        </div>
      </div>

      {/* ── Global nav strip ────────────────────────────────────── */}
      <nav
        className="flex items-center gap-2 px-6 hairline-b"
        style={{ height: 'var(--nav-h)', background: 'var(--bg-0)' }}
      >
        {nav.map(item => {
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
