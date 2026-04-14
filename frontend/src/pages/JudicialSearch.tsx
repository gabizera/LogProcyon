import { useState, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle2, Clock, User } from 'lucide-react';
import api, { fetchInputs, fetchCgnatPools } from '../api';

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
  consulta: { ip_publico: string; porta: number; data_inicio: string; data_fim: string; equipamento_origem: string | null };
  resultados: JudicialResult[];
  total: number;
  source?: 'logs' | 'static_pool';
}

export default function JudicialSearch() {
  const [form, setForm] = useState({ ip_publico: '', porta: '', data: '', hora_inicio: '00:00', hora_fim: '23:59', equipamento_origem: '' });
  const [result, setResult] = useState<JudicialResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [equipamentos, setEquipamentos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [ins, pools] = await Promise.all([fetchInputs(), fetchCgnatPools()]);
        const merged = Array.from(new Set([
          ...ins.map(i => i.name),
          ...pools.map(p => p.equipamento_origem),
        ])).filter(Boolean).sort();
        setEquipamentos(merged);
      } catch {
        setEquipamentos([]);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ip_publico || !form.porta || !form.data) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Envia em formato local naive (sem Z) — o collector grava timestamps
      // alinhados ao TZ_OFFSET_HOURS, não em UTC. Se chamássemos toISOString()
      // aqui a string vira UTC e a comparação no ClickHouse fica deslocada
      // pelo fuso do browser (3h em BRT).
      const dataInicio = `${form.data}T${form.hora_inicio}:00`;
      const dataFim    = `${form.data}T${form.hora_fim}:59`;
      const { data } = await api.get<JudicialResponse>('/logs/judicial', {
        params: {
          ip_publico:   form.ip_publico,
          porta:        parseInt(form.porta),
          data_inicio:  dataInicio,
          data_fim:     dataFim,
          ...(form.equipamento_origem ? { equipamento_origem: form.equipamento_origem } : {}),
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
    <div className="max-w-4xl mx-auto">
      <div className="title-row">
        <h2>monitoramento<span className="accent"> / judicial</span></h2>
        <span className="meta">identifica o assinante por ip público + porta + período</span>
      </div>
      <div className="px-6 pt-4 pb-8">

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl p-5 mb-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        {/* Row 1: IP + Porta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              IP Público
            </label>
            <input
              value={form.ip_publico}
              onChange={e => setForm(p => ({ ...p, ip_publico: e.target.value }))}
              placeholder="Ex: 200.0.0.1"
              required
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Porta
            </label>
            <input
              value={form.porta}
              onChange={e => setForm(p => ({ ...p, porta: e.target.value }))}
              placeholder="Ex: 1024"
              type="number"
              min={1}
              max={65535}
              required
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Row 2: Equipamento */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Equipamento
            </label>
            <select
              value={form.equipamento_origem}
              onChange={e => setForm(p => ({ ...p, equipamento_origem: e.target.value }))}
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            >
              <option value="">Todos</option>
              {equipamentos.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Data + Hora Início + Hora Fim */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Data
            </label>
            <input
              value={form.data}
              onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
              type="date"
              required
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Hora Início
            </label>
            <input
              value={form.hora_inicio}
              onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))}
              type="time"
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Hora Fim
            </label>
            <input
              value={form.hora_fim}
              onChange={e => setForm(p => ({ ...p, hora_fim: e.target.value }))}
              type="time"
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:brightness-110 cursor-pointer disabled:opacity-50"
            style={{
              background: 'var(--signal)',
              color: '#050505',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <Search size={14} />
            {loading ? 'Consultando...' : 'Identificar Assinante'}
          </button>
          <span className="text-[10px]" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            Deixe os horários em 00:00–23:59 para buscar o dia inteiro
          </span>
        </div>
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
                  : 'Nenhum assinante identificado nesse intervalo'}
              </span>
              {result.total > 0 && result.source && (
                <span
                  className="badge ml-2"
                  style={{
                    color: result.source === 'static_pool' ? 'var(--signal)' : 'var(--accent-cyan)',
                    background: result.source === 'static_pool' ? 'rgba(255,176,0,0.08)' : 'rgba(59,130,246,0.08)',
                    border: `1px solid ${result.source === 'static_pool' ? 'rgba(255,176,0,0.25)' : 'rgba(59,130,246,0.25)'}`,
                  }}
                >
                  {result.source === 'static_pool' ? 'pool estático' : 'log real'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <Clock size={10} />
              {new Date(result.consulta.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – {new Date(result.consulta.data_fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Query summary */}
          {result.total > 0 && (
          <div
            className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4"
            style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            {[
              { label: 'IP Público',  value: result.consulta.ip_publico },
              { label: 'Porta',       value: result.consulta.porta },
              { label: 'Data Início', value: new Date(result.consulta.data_inicio).toLocaleString('pt-BR') },
              { label: 'Data Fim',    value: new Date(result.consulta.data_fim).toLocaleString('pt-BR') },
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
          )}

          {/* Empty result — hint the user */}
          {result.total === 0 && (
            <div className="px-5 py-8 flex flex-col items-center gap-2 text-center" style={{ background: 'var(--bg-primary)' }}>
              <p className="text-xs max-w-md" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
                Nenhum registro NAT/BPA bateu com <strong style={{ color: 'var(--text-secondary)' }}>{result.consulta.ip_publico}:{result.consulta.porta}</strong> dentro desse horário.
              </p>
              <p className="text-[11px] max-w-md" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
                Confirme se a data está correta, tente ampliar o intervalo (ex: 00:00–23:59) ou verifique se o IP/porta foram digitados sem espaços.
              </p>
            </div>
          )}

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
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
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
                      style={{ color: 'var(--accent-cyan)', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
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
    </div>
  );
}
