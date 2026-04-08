import { useState } from 'react';
import { Search, Shield, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
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
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <Shield size={20} style={{ color: '#fbbf24' }} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Consulta Judicial
          </h2>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Identifica o assinante por IP público, porta e data/hora
          </span>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl p-5 mb-6"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              IP Público
            </label>
            <input
              value={form.ip_publico}
              onChange={e => setForm(f => ({ ...f, ip_publico: e.target.value }))}
              placeholder="177.86.123.145"
              required
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Porta
            </label>
            <input
              value={form.porta}
              onChange={e => setForm(f => ({ ...f, porta: e.target.value }))}
              placeholder="29100"
              type="number"
              min="1"
              max="65535"
              required
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Data / Hora
            </label>
            <input
              value={form.timestamp}
              onChange={e => setForm(f => ({ ...f, timestamp: e.target.value }))}
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
          style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#0a0e14', fontFamily: 'var(--font-display)' }}
        >
          <Search size={15} />
          {loading ? 'Consultando...' : 'Identificar Assinante'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={16} style={{ color: 'var(--accent-red)' }} />
          <span className="text-sm" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          {/* Result header */}
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ background: result.total > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              {result.total > 0
                ? <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
                : <AlertCircle size={16} style={{ color: 'var(--accent-red)' }} />}
              <span className="text-sm font-semibold" style={{ color: result.total > 0 ? '#22c55e' : 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
                {result.total > 0 ? `${result.total} resultado(s) encontrado(s)` : 'Nenhum assinante identificado'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <Clock size={11} />
              Janela: ±5 minutos
            </div>
          </div>

          {/* Consulta info */}
          <div className="px-5 py-3 flex gap-6" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            {[
              { label: 'IP Público', value: result.consulta.ip_publico },
              { label: 'Porta', value: result.consulta.porta },
              { label: 'Data/Hora', value: new Date(result.consulta.timestamp).toLocaleString('pt-BR') },
            ].map(f => (
              <div key={f.label}>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.label}</div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{f.value}</div>
              </div>
            ))}
          </div>

          {/* Result rows */}
          {result.resultados.map((r, i) => (
            <div key={i} className="px-5 py-4" style={{ background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>IP Privado (Assinante)</div>
                  <div className="text-base font-bold" style={{ color: '#00d4ff', fontFamily: 'var(--font-mono)' }}>{r.ip_privado}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Bloco de Portas</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {r.porta_publica} – {r.porta_fim}
                    <span className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>({r.tamanho_bloco} portas)</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Protocolo / Tipo</div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{r.protocolo} / {r.tipo_nat}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Timestamp do Evento</div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(r.timestamp).toLocaleString('pt-BR')}
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
