import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Radio } from 'lucide-react';
import { fetchStats, fetchInputs, fetchPublicConfig, type StatsResponse, type Input } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats]         = useState<StatsResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [multiTenant, setMultiTenant] = useState(false);
  const [inputs, setInputs] = useState<Input[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');

  const loadStats = useCallback(async (instance?: string) => {
    try {
      const data = await fetchStats(instance || undefined);
      setStats(data);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erro ao carregar estatísticas.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, ins] = await Promise.all([fetchPublicConfig(), fetchInputs()]);
        setMultiTenant(cfg.multi_tenant_mode);
        setInputs(ins);
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    loadStats(selectedInstance);
    const id = setInterval(() => loadStats(selectedInstance), 30000);
    return () => clearInterval(id);
  }, [loadStats, selectedInstance]);

  const showSelector = inputs.length >= 1;

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--signal)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="hairline p-8 max-w-sm text-center" style={{ background: 'var(--bg-1)' }}>
          <p className="text-xs mb-4" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>{error}</p>
          <button
            onClick={() => loadStats(selectedInstance)}
            className="topnav-link cursor-pointer"
            style={{ background: 'transparent' }}
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      </div>
    );
  }

  // ── Derived metrics ───────────────────────────────────────
  const total = stats?.total_logs ?? 0;
  const today = stats?.logs_hoje ?? 0;
  const pubIps = stats?.ips_publicos_unicos ?? 0;
  const privIps = stats?.ips_privados_unicos ?? 0;

  const volume = (stats?.volume_24h ?? []).map(v => ({ hour: String(v.hora ?? ''), count: Number(v.total ?? 0) }));

  const peak = volume.reduce((acc, v) => (v.count > acc.count ? v : acc), { hour: '—', count: 0 });
  const rate = volume.length > 0 ? (volume.reduce((s, v) => s + v.count, 0) / volume.length).toFixed(1) : '0.0';

  // Quando nada está selecionado, mostramos "todas as fontes" explicitamente
  // em vez de cair no nome do primeiro equipamento cadastrado — que dá a
  // impressão errada de que o dashboard está escopado nele.
  const currentInstance = selectedInstance || 'todas as fontes';

  return (
    <div className="animate-card">

      {/* ── Title row ───────────────────────────────────────── */}
      <div className="title-row">
        <h2>
          {currentInstance}
          <span className="accent"> / painel</span>
        </h2>
        <span className="meta">
          atualizado {lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '—'}
        </span>
        <div className="right">
          {showSelector && (
            <>
              <label htmlFor="dash-instance" className="sr-only">Filtrar por cliente</label>
              <select
                id="dash-instance"
                aria-label="Filtrar dashboard por cliente"
                value={selectedInstance}
                onChange={e => setSelectedInstance(e.target.value)}
                className="topnav-link cursor-pointer"
                style={{ background: 'transparent', color: 'var(--signal)', borderColor: 'var(--signal)' }}
              >
                <option value="">TODAS AS FONTES</option>
                {inputs.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
              </select>
            </>
          )}
          <button
            onClick={() => loadStats(selectedInstance)}
            className="topnav-link cursor-pointer flex items-center gap-1.5"
            style={{ background: 'transparent' }}
          >
            <RefreshCw size={10} /> ATUALIZAR
          </button>
        </div>
      </div>

      {/* ── Readout (5-cell) ────────────────────────────────── */}
      <div className="readout" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="cell">
          <div className="k">TOTAL</div>
          <div className="v tabular">{total.toLocaleString('pt-BR')}</div>
          <div className="d">eventos capturados</div>
        </div>
        <div className="cell">
          <div className="k">HOJE</div>
          <div className="v tabular">{today.toLocaleString('pt-BR')}</div>
          <div className="d up">últimas 24h</div>
        </div>
        <div className="cell">
          <div className="k">IP PÚBLICO</div>
          <div className="v tabular">{pubIps}</div>
          <div className="d">únicos</div>
        </div>
        <div className="cell">
          <div className="k">IP PRIVADO</div>
          <div className="v tabular">{privIps}</div>
          <div className="d">únicos</div>
        </div>
        <div className="cell">
          <div className="k">TAXA</div>
          <div className="v tabular">{rate}</div>
          <div className="d">eventos / min</div>
        </div>
      </div>

      {/* ── Top IPs (2 colunas lado a lado) ─────────────────── */}
      <div
        className="grid"
        style={{ gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--rule-1)' }}
      >
        <TopIpsPanel
          title="TOP IPs PÚBLICOS · ÚLTIMAS 24H"
          rows={stats?.top_ips_publicos ?? []}
          onRowClick={ip => navigate(`/logs?ip_publico=${ip}`)}
          scope={currentInstance}
          showSource={selectedInstance === ''}
          className="dashed-r"
        />
        <TopIpsPanel
          title="TOP IPs PRIVADOS · ÚLTIMAS 24H"
          rows={stats?.top_ips_privados ?? []}
          onRowClick={ip => navigate(`/logs?ip_privado=${ip}`)}
          scope={currentInstance}
          showSource={selectedInstance === ''}
        />
      </div>
    </div>
  );
}

function TopIpsPanel({
  title,
  rows,
  onRowClick,
  scope,
  showSource = false,
  className = '',
}: {
  title: string;
  rows: { ip: string; total: number; sources?: string[] }[];
  onRowClick: (ip: string) => void;
  scope: string;
  showSource?: boolean;
  className?: string;
}) {
  const maxCount = Math.max(...rows.map(r => Number(r.total)), 1);
  const visible = rows.slice(0, 8);
  return (
    <div className={`px-6 pt-6 pb-8 ${className}`}>
      <div className="section-head" style={{ padding: 0, marginBottom: 10 }}>
        <span>{title} · CLIQUE PARA FILTRAR</span>
        <span className="right">ORIGEM <b>{scope}</b></span>
      </div>
      <div className="hairline">
        {visible.map((row, i, arr) => {
          const w = (Number(row.total) / maxCount) * 100;
          const sources = row.sources ?? [];
          const primarySource = sources[0] ?? '—';
          const extra = sources.length > 1 ? ` +${sources.length - 1}` : '';
          return (
            <div
              key={row.ip}
              onClick={() => onRowClick(row.ip)}
              className="cursor-pointer grid items-center"
              style={{
                gridTemplateColumns: '180px 1fr 60px',
                gap: 12,
                padding: '8px 14px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--rule-1)' : 'none',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div className="min-w-0">
                <div className="tabular truncate" style={{ color: 'var(--signal)' }}>{row.ip}</div>
                {showSource && (
                  <div
                    className="flex items-center gap-1 truncate"
                    style={{ fontSize: 9, color: 'var(--ink-2)', marginTop: 1, letterSpacing: '0.04em' }}
                    title={sources.join(' · ')}
                  >
                    <Radio size={8} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                    <span className="truncate">{primarySource}{extra}</span>
                  </div>
                )}
              </div>
              <div style={{ height: 4, background: 'var(--bg-2)', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: 'var(--signal)', width: `${w}%` }} />
              </div>
              <span className="tabular text-right" style={{ color: 'var(--ink-2)' }}>{Number(row.total).toLocaleString('pt-BR')}</span>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="p-8 text-center" style={{ color: 'var(--ink-3)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            sem dados
          </div>
        )}
      </div>
    </div>
  );
}
