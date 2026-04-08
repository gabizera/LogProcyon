import { useState } from 'react';
import { Wifi, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
    } catch {
      setError('Usuário ou senha inválidos');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
      >
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(99,102,241,0.15))',
              border: '1px solid rgba(0,212,255,0.25)',
            }}
          >
            <Wifi size={24} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            LogProcyon
          </h1>
          <span
            className="text-[10px] font-medium tracking-widest uppercase mt-1"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
          >
            NAT · CGNAT · BPA
          </span>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs"
            style={{
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--accent-red)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Usuário
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Usuário"
              required
              autoFocus
              autoComplete="username"
              className="rounded-lg px-3 py-2.5"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              required
              autoComplete="current-password"
              className="rounded-lg px-3 py-2.5"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 mt-2 px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)',
              color: '#020617',
              fontFamily: 'var(--font-display)',
            }}
          >
            <LogIn size={15} />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div
          className="mt-6 text-center text-[10px]"
          style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}
        >
          LogProcyon v1.2.0
        </div>
      </div>
    </div>
  );
}
