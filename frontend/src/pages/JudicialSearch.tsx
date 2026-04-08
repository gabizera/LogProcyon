import { useState } from 'react';
import { Search, Shield, AlertCircle, CheckCircle2, Clock, User } from 'lucide-react';
import api from '../api';

interface JudicialResult {
  ip_privado: string;
  ip_publico: string;
  porta_publica: number;
  tamanho_bloco: number;
  porta_fim: number;
  protocolo: string;
  tipo_nat: string;
  equipamento_origem: string;
  timestamp: string;
}

interface JudicialResponse {
  consulta: { ip_publico: string; porta: number; timestamp: string };
  resultados: JudicialResult[];
  total: number;
}

export default function JudicialSearch() {
  const [form, setForm] = useState({ ip_publico: '', porta: '', timestamp: '' });
  const [result, setResult] = useState<JudicialResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ip_publico || !form.porta || !form.timestamp) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await api.get<JudicialResponse>('/logs/judicial', {
        params: {
          ip_publico: form.ip_publico,
          porta:      parseInt(form.porta),
          timestamp:  new Date(form.timestamp).toISOString(),
        },
      });
      setResult(data);
    } catch {
      setError('Erro ao realizar a consulta. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <Shield size={18} style={{ color: 'var(--accent-amber)' }} />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Consulta Judicial
          </h2>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Identifica o assinante por IP público, porta e data/hora
          </span>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl p-5 mb-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {[
            { key: 'ip_publico', label: 'IP Público',  placeholder: 'Ex: 200.0.0.1', type: 'text'   },
            { key: 'porta',      label: 'Porta',        placeholder: 'Ex: 1024',        type: 'number' },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {f.label}
              </label>
              <input
                value={(form as Record<string, string>)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                type={f.type}
                min={f.type === 'number' ? 1 : undefined}
                max={f.type === 'number' ? 65535 : undefined}
                required
                className="rounded-lg px-3 py-2"
                style={inputStyle}
              />
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <label
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Data / Hora
            </label>
            <input
              value={form.timestamp}
              onChange={e => setForm(p => ({ ...p, timestamp: e.target.value }))}
              type="datetime-local"
              required
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:brightness-110 cursor-pointer disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#020617',
            fontFamily: 'var(--font-display)',
          }}
        >
          <Search size={14} />
          {loading ? 'Consultando...' : 'Identificar Assinante'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <AlertCircle size={15} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
          <span className="text-sm" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          {/* Result status bar */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{
              background: result.total > 0 ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-2">
              {result.total > 0
                ? <CheckCircle2 size={15} style={{ color: 'var(--accent-green)' }} />
                : <AlertCircle  size={15} style={{ color: 'var(--accent-red)' }} />}
              <span
                className="text-sm font-semibold"
                style={{
                  color: result.total > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {result.total > 0
                  ? `${result.total} resultado(s) encontrado(s)`
                  : 'Nenhum assinante identificado'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <Clock size={10} />
              Janela ±5 min
            </div>
          </div>

          {/* Query summary */}
          <div
            className="px-5 py-3 grid grid-cols-3 gap-4"
            style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            {[
              { label: 'IP Público',  value: result.consulta.ip_publico },
              { label: 'Porta',       value: result.consulta.porta },
              { label: 'Data / Hora', value: new Date(result.consulta.timestamp).toLocaleString('pt-BR') },
            ].map(f => (
              <div key={f.label}>
                <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  {f.label}
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          {/* Results list */}
          {result.resultados.map((r, i) => (
            <div
              key={i}
              className="px-5 py-5"
              style={{
                background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-card)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              {/* Subscriber highlight */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}
                >
                  <User size={14} style={{ color: 'var(--accent-cyan)' }} />
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    IP Privado (Assinante)
                  </div>
                  <div
                    className="text-xl font-bold tabular-nums"
                    style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}
                  >
                    {r.ip_privado}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Bloco de Portas
                  </div>
                  <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {r.porta_publica} – {r.porta_fim}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {r.tamanho_bloco} portas
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Protocolo / Tipo
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="badge"
                      style={{ color: 'var(--accent-cyan)', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}
                    >
                      {r.protocolo}
                    </span>
                    <span
                      className="badge"
                      style={{ color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      {r.tipo_nat?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Timestamp do Evento
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(r.timestamp).toLocaleString('pt-BR')}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {r.equipamento_origem}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
