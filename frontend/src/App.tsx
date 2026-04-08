import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  BotMessageSquare,
  Radio,
  ChevronRight,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LogSearch from './pages/LogSearch';
import AiAnalysis from './pages/AiAnalysis';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/logs', icon: Search, label: 'Busca de Logs' },
  { to: '/ai', icon: BotMessageSquare, label: 'Análise IA' },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="scanline-overlay" />

      {/* Sidebar */}
      <aside
        className="flex flex-col w-64 shrink-0 border-r"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #00d4ff20, #3b82f620)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <Radio size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div>
            <h1
              className="text-sm font-bold tracking-wide"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--text-primary)',
              }}
            >
              LogPlatform
            </h1>
            <span
              className="text-[10px] font-medium tracking-widest uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              NAT / CGNAT / BPA
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-3 mt-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={`nav-link flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'active' : ''
                }`}
                style={{
                  color: isActive
                    ? 'var(--accent-cyan)'
                    : 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <ChevronRight
                    size={14}
                    style={{ color: 'var(--accent-cyan)' }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Status footer */}
        <div className="mt-auto p-4">
          <div
            className="rounded-lg px-4 py-3"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full live-indicator"
                style={{ background: 'var(--accent-green)' }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  color: 'var(--accent-green)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                SISTEMA ATIVO
              </span>
            </div>
            <span
              className="text-[10px]"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Coletando logs em tempo real
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: 'var(--bg-primary)' }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/logs" element={<LogSearch />} />
          <Route path="/ai" element={<AiAnalysis />} />
        </Routes>
      </main>
    </div>
  );
}
