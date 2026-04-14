import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { fetchStats, fetchInputs, fetchPublicConfig, type StatsResponse, type Input } from '../api';

// ── Timeline area chart (SVG) ────────────────────────────────
function TimelinePlot({ points }: { points: { hour: string; count: number }[] }) {
  if (!points.length) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 140, border: '1px dashed var(--rule-1)', color: 'var(--ink-3)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}
      >
        sem dados · aguardando eventos
      </div>
    );
  }
  const max = Math.max(...points.map(p => p.count), 1);
  const W = 1000;
  const H = 130;
  const stepX = points.length > 1 ? W / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: H - (p.count / max) * (H - 14) - 4,
  }));
  const trace = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const fill = `M0,${H} L0,${coords[0].y.toFixed(1)} ${coords.slice(1).map(c => `L${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')} L${W},${H} Z`;

  return (
    <div style={{ position: 'relative', height: H, borderTop: '1px solid var(--rule-1)', borderBottom: '1px solid var(--rule-1)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        {[26, 52, 78, 104].map(y => (
          <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="var(--rule-1)" strokeWidth="1" />
        ))}
        <path d={fill} fill="var(--signal)" opacity="0.08" />
        <path d={trace} fill="none" stroke="var(--signal)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

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

      {/* ── Page status strip ───────────────────────────────── */}
      <div className="statusbar" style={{ borderTop: 0 }}>
        <span className="pill">DASHBOARD</span>
        <span><span className="k">origem</span><b>{currentInstance}</b></span>
        <span><span className="k">eventos</span><b className="tabular">{total.toLocaleString('pt-BR')}</b></span>
        <span><span className="k">taxa</span><b className="tabular">{rate}/min</b></span>
        <span><span className="k">pico</span><b className="tabular">{peak.count} · {peak.hour ? new Date(peak.hour).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</b></span>
        <div className="right">
          <span><span className="k">atualizado</span><b className="tabular">{lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '—'}</b></span>
          <button
            onClick={() => loadStats(selectedInstance)}
            className="topnav-link cursor-pointer flex items-center gap-1.5"
            style={{ background: 'transparent' }}
          >
            <RefreshCw size={10} /> ATUALIZAR
          </button>
        </div>
      </div>

      {/* ── Title row ───────────────────────────────────────── */}
      <div className="title-row">
        <h2>
          {currentInstance}
          <span className="accent"> / painel</span>
        </h2>
        <span className="meta">UTC−3 · {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        {showSelector && (
          <div className="right">
            <label htmlFor="dash-instance" className="sr-only">Filtrar por cliente</label>
            <select
              id="dash-instance"
              aria-label="Filtrar dashboard por cliente"
              value={selectedInstance}
              onChange={e => setSelectedInstance(e.target.value)}
              className="topnav-link cursor-pointer"
              style={{ background: 'transparent' }}
            >
              <option value="">TODAS AS FONTES</option>
              {inputs.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Readout (5-cell) ────────────────────────────────── */}
      <div className="readout" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="cell">
          <div className="k">TOTAL</div>
          <div className="v signal tabular">{total.toLocaleString('pt-BR')}</div>
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

      {/* ── Timeline ────────────────────────────────────────── */}
      <div className="px-6 pt-7 pb-6">
        <div className="flex justify-between mb-3" style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 500 }}>
          <span>VOLUME · ÚLTIMAS 24H</span>
          <span style={{ color: 'var(--ink-2)' }}>
            UNIDADE <b style={{ color: 'var(--signal)' }}>eventos / hora</b> · PICO <b style={{ color: 'var(--signal)' }} className="tabular">{peak.count}</b>
          </span>
        </div>
        <TimelinePlot points={volume} />
        <div className="flex justify-between mt-2 tabular" style={{ fontSize: 9, color: 'var(--ink-2)', letterSpacing: '0.08em' }}>
          <span>−24h</span>
          <span>−18h</span>
          <span>−12h</span>
          <span>−6h</span>
          <span>agora</span>
        </div>
      </div>

      {/* ── Top IPs (hairline table) ────────────────────────── */}
      <div className="px-6 pt-7 pb-8" style={{ borderTop: '1px solid var(--rule-1)' }}>
        <div className="section-head" style={{ padding: 0, marginBottom: 10 }}>
          <span>TOP IPs PÚBLICOS · CLIQUE PARA FILTRAR</span>
          <span className="right">ORIGEM <b>{currentInstance}</b></span>
        </div>
        <div className="hairline">
          {(stats?.top_ips_publicos ?? []).slice(0, 8).map((row, i, arr) => {
            const maxCount = Math.max(...(stats?.top_ips_publicos ?? []).map(r => Number(r.total)), 1);
            const w = (Number(row.total) / maxCount) * 100;
            return (
              <div
                key={row.ip}
                onClick={() => navigate(`/logs?ip_publico=${row.ip}`)}
                className="cursor-pointer grid items-center"
                style={{
                  gridTemplateColumns: '200px 1fr 80px',
                  gap: 16,
                  padding: '8px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--rule-1)' : 'none',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <span className="tabular" style={{ color: 'var(--signal)' }}>{row.ip}</span>
                <div style={{ height: 4, background: 'var(--bg-2)', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: 'var(--signal)', width: `${w}%` }} />
                </div>
                <span className="tabular text-right" style={{ color: 'var(--ink-2)' }}>{Number(row.total).toLocaleString('pt-BR')}</span>
              </div>
            );
          })}
          {(stats?.top_ips_publicos ?? []).length === 0 && (
            <div className="p-8 text-center" style={{ color: 'var(--ink-3)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              sem dados
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
