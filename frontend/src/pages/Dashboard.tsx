import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, CalendarDays, Globe, MonitorSmartphone, RefreshCw, BarChart3 } from 'lucide-react';
import { fetchStats, fetchInputs, fetchPublicConfig, type StatsResponse, type Input } from '../api';
import { VolumeLineChart, TopBarChart, DistributionPieChart } from '../components/Charts';

function StatCard({ icon: Icon, label, value, color, index }: {
  icon: React.ElementType; label: string; value: string | number; color: string; index: number;
}) {
  return (
    <div
      className="animate-card rounded-xl p-5 flex flex-col gap-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderTop: `2px solid ${color}`, animationDelay: `${index * 0.06}s`, boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {label}
        </span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '14' }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, index }: {
  title: string; subtitle?: string; children: React.ReactNode; index: number;
}) {
  return (
    <div
      className="animate-card rounded-xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-card)', animationDelay: `${(index + 4) * 0.06}s` }}
    >
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={13} style={{ color: '#64748b', flexShrink: 0 }} />
        <div>
          <h3 className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{title}</h3>
          {subtitle && <div className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{subtitle}</div>}
        </div>
      </div>
      {children}
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
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    loadStats(selectedInstance);
    const id = setInterval(() => loadStats(selectedInstance), 30000);
    return () => clearInterval(id);
  }, [loadStats, selectedInstance]);

  const showSelector = multiTenant && inputs.length > 1;

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Carregando dashboard...</span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded-xl p-8 max-w-sm text-center" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{error}</p>
          <button onClick={() => { void loadStats(selectedInstance); }} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer hover:brightness-110" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', fontFamily: 'var(--font-display)' }}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { icon: Database,          label: 'Total de Logs',       value: stats?.total_logs          ?? 0, color: '#3b82f6' },
    { icon: CalendarDays,      label: 'Logs Hoje',           value: stats?.logs_hoje           ?? 0, color: '#22c55e' },
    { icon: Globe,             label: 'IPs Públicos Únicos', value: stats?.ips_publicos_unicos ?? 0, color: '#6366f1' },
    { icon: MonitorSmartphone, label: 'IPs Privados Únicos', value: stats?.ips_privados_unicos ?? 0, color: '#8b5cf6' },
  ];

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Dashboard</h2>
          {lastUpdate && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Atualizado {lastUpdate.toLocaleTimeString('pt-BR')} · auto-refresh 30s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showSelector && (
            <select
              value={selectedInstance}
              onChange={e => setSelectedInstance(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs cursor-pointer"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}
            >
              <option value="">Todos os clientes</option>
              {inputs.map(i => (
                <option key={i.id} value={i.name}>{i.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => { void loadStats(selectedInstance); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer hover:brightness-110"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}
          >
            <RefreshCw size={12} />
            Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 px-4 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, i) => <StatCard key={card.label} {...card} index={i} />)}
      </div>

      {/* Row 1: Volume + Top Públicos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Volume de Logs" subtitle="Últimas 24 horas" index={0}>
          <VolumeLineChart data={(stats?.volume_24h ?? []) as Record<string, unknown>[]} xKey="hora" yKey="total" />
        </ChartCard>
        <ChartCard title="Top 10 IPs Públicos" subtitle="Clique para filtrar" index={1}>
          <TopBarChart data={(stats?.top_ips_publicos ?? []) as Record<string, unknown>[]} xKey="ip" yKey="total" color="#6366f1"
            onBarClick={ip => navigate(`/logs?ip_publico=${ip}`)} />
        </ChartCard>
      </div>

      {/* Row 2: Top Privados + Distribuição NAT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Top 10 IPs Privados" subtitle="Clique para filtrar" index={2}>
          <TopBarChart data={(stats?.top_ips_privados ?? []) as Record<string, unknown>[]} xKey="ip" yKey="total" color="#8b5cf6"
            onBarClick={ip => navigate(`/logs?ip_privado=${ip}`)} />
        </ChartCard>
        <ChartCard title="Distribuição por Tipo NAT" subtitle="CGNAT · BPA · Estático" index={3}>
          <DistributionPieChart data={(stats?.distribuicao_tipo_nat ?? []) as Record<string, unknown>[]} nameKey="tipo" valueKey="total" />
        </ChartCard>
      </div>

      {/* Row 3: Protocolo + Equipamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribuição por Protocolo" subtitle="TCP · UDP" index={4}>
          <DistributionPieChart data={(stats?.distribuicao_protocolo ?? []) as Record<string, unknown>[]} nameKey="protocolo" valueKey="total" />
        </ChartCard>
        <ChartCard title="Volume por Equipamento" subtitle="Clique para filtrar" index={5}>
          <TopBarChart data={(stats?.distribuicao_equipamento ?? []) as Record<string, unknown>[]} xKey="equipamento" yKey="total" color="#06b6d4"
            onBarClick={eq => navigate(`/logs?equipamento_origem=${eq}`)} />
        </ChartCard>
      </div>
    </div>
  );
}
