import { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
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
import CgnatPools    from './pages/CgnatPools';

// Cada item declara quais roles podem enxergá-lo no nav.
// Admin ignora tudo e vê sempre, outros perfis filtram por roles.
type NavLeaf = { to: string; label: string; roles: string[] };
type NavGroup = { label: string; match: string[]; children: NavLeaf[]; roles: string[] };
type NavItem = NavLeaf | NavGroup;

const isGroup = (i: NavItem): i is NavGroup => 'children' in i;

const nav: NavItem[] = [
  { to: '/', label: 'DASHBOARD', roles: ['admin', 'operator', 'viewer'] },
  {
    label: 'MONITORAMENTO',
    match: ['/logs', '/judicial'],
    roles: ['admin', 'operator', 'viewer'],
    children: [
      { to: '/logs',     label: 'LOGS',     roles: ['admin', 'operator', 'viewer'] },
      { to: '/judicial', label: 'JUDICIAL', roles: ['admin', 'operator']           },
    ],
  },
  {
    label: 'CONFIGURAÇÃO',
    match: ['/inputs', '/storage', '/users', '/settings', '/cgnat-pools'],
    roles: ['admin', 'operator', 'viewer'],
    children: [
      { to: '/inputs',      label: 'INPUTS',        roles: ['admin', 'operator', 'viewer'] },
      { to: '/cgnat-pools', label: 'POOLS CGNAT',   roles: ['admin', 'operator']           },
      { to: '/storage',     label: 'ARMAZENAMENTO', roles: ['admin', 'operator', 'viewer'] },
      { to: '/users',       label: 'USUÁRIOS',      roles: ['admin']                       },
      { to: '/settings',    label: 'CONFIG',        roles: ['admin']                       },
    ],
  },
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
        <span className="pill">{platformName.toUpperCase()}</span>
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
        className="flex items-center justify-center gap-2 px-6 hairline-b"
        style={{ height: 'var(--nav-h)', background: 'var(--bg-0)' }}
      >
        {nav
          .filter(item => item.roles.includes(user.role))
          .map(item => {
            if (isGroup(item)) {
              const children = item.children.filter(c => c.roles.includes(user.role));
              if (children.length === 0) return null;
              return (
                <NavDropdown
                  key={item.label}
                  label={item.label}
                  match={item.match}
                  children={children}
                  pathname={location.pathname}
                />
              );
            }
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
          <Route path="/cgnat-pools" element={<RoleGate role={user.role} allow={['admin', 'operator']}><CgnatPools /></RoleGate>} />
          <Route path="/users"     element={<RoleGate role={user.role} allow={['admin']}><UsersPage /></RoleGate>} />
          <Route path="/settings"  element={<RoleGate role={user.role} allow={['admin']}><SettingsPage /></RoleGate>} />
        </Routes>
      </main>
    </div>
  );
}

function NavDropdown({
  label,
  match,
  children,
  pathname,
}: {
  label: string;
  match: string[];
  children: NavLeaf[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = match.some(m => pathname.startsWith(m));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`topnav-link flex items-center gap-1.5 ${isActive ? 'active' : ''}`}
        style={{ background: 'transparent', cursor: 'pointer' }}
      >
        {label}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div
          className="absolute left-1/2 -translate-x-1/2 mt-1 min-w-[180px] z-50"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--rule-1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {children.map(c => {
            const active = pathname.startsWith(c.to);
            return (
              <NavLink
                key={c.to}
                to={c.to}
                className="block px-4 py-2.5 text-[10px] font-medium tracking-widest uppercase transition-colors"
                style={{
                  color: active ? 'var(--signal)' : 'var(--ink-2)',
                  borderBottom: '1px solid var(--rule-2)',
                  fontFamily: 'var(--font-mono)',
                  background: active ? 'var(--bg-2)' : 'transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? 'var(--bg-2)' : 'transparent'; }}
              >
                {c.label}
              </NavLink>
            );
          })}
        </div>
      )}
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
