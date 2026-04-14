import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../auth';

export default function LoginPage({ platformName = 'LogProcyon' }: { platformName?: string }) {
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
    background: 'var(--bg-0)',
    border: '1px solid var(--rule-2)',
    color: 'var(--ink-0)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    borderRadius: 0,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 9,
    color: 'var(--ink-2)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 10,
    fontFamily: 'var(--font-mono)',
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-0)' }}
    >
      <div
        className="w-full max-w-[360px] hairline"
        style={{ background: 'var(--bg-1)', padding: '30px 30px 26px', fontFamily: 'var(--font-mono)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex items-center justify-center w-[36px] h-[36px] shrink-0"
            style={{
              background: 'var(--signal)',
              color: '#050505',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono)',
            }}
          >
            LP
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="font-semibold"
              style={{ fontSize: 16, color: 'var(--ink-0)', letterSpacing: '0.04em' }}
            >
              {platformName}
            </div>
            <div
              className="uppercase"
              style={{
                fontSize: 9,
                color: 'var(--ink-1)',
                letterSpacing: '0.14em',
                marginTop: 3,
                lineHeight: 1.5,
              }}
            >
              sistema de logs<br />da procyon tecnologia
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-3 flex items-center gap-2 px-3 py-2"
            style={{
              background: 'rgba(217, 59, 59, 0.07)',
              border: '1px solid rgba(217, 59, 59, 0.3)',
              color: 'var(--accent-red)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}
          >
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Usuário</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
            className="w-full px-3 py-2"
            style={inputStyle}
          />

          <label style={labelStyle}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2"
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-2.5 font-bold cursor-pointer disabled:opacity-50 transition-all"
            style={{
              background: 'var(--signal)',
              color: '#050505',
              border: 'none',
              borderRadius: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.06em',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div
          className="mt-5 text-center uppercase"
          style={{
            fontSize: 9,
            color: 'var(--ink-2)',
            letterSpacing: '0.16em',
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
          }}
        >
          v1.0 · procyon tecnologia
        </div>
      </div>
    </div>
  );
}
