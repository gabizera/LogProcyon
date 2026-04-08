import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  CalendarDays,
  Globe,
  MonitorSmartphone,
  RefreshCw,
} from 'lucide-react';
import { fetchStats, type StatsResponse } from '../api';
import { VolumeLineChart, TopBarChart, DistributionPieChart } from '../components/Charts';

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  index: number;
}) {
  return (
    <div
      className="animate-card rounded-xl p-5"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        animationDelay: `${index * 0.05}s`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{
            background: color + '15',
            border: `1px solid ${color}30`,
          }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <span
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {label}
        </span>
      </div>
      <span
        className="text-2xl font-bold"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
      >
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </span>
    </div>
  );
}

function ChartCard({
  title,
  children,
  index,
}: {
  title: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <div
      className="animate-card rounded-xl p-5"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        animationDelay: `${(index + 4) * 0.05}s`,
      }}
    >
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchStats();
      setStats(data);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Erro ao carregar estatisticas. Verifique a conexao com o backend.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }}
          />
          <span
            className="text-sm"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Carregando dashboard...
          </span>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="rounded-xl p-8 max-w-md text-center"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-red)30',
          }}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--accent-red)' }}>
            {error}
          </p>
          <button
            onClick={loadStats}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      icon: Database,
      label: 'Total de Logs',
      value: stats?.total_logs ?? 0,
      color: '#00d4ff',
    },
    {
      icon: CalendarDays,
      label: 'Logs Hoje',
      value: stats?.logs_hoje ?? 0,
      color: '#22c55e',
    },
    {
      icon: Globe,
      label: 'IPs Publicos Unicos',
      value: stats?.ips_publicos_unicos ?? 0,
      color: '#3b82f6',
    },
    {
      icon: MonitorSmartphone,
      label: 'IPs Privados Unicos',
      value: stats?.ips_privados_unicos ?? 0,
      color: '#a855f7',
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Dashboard
          </h2>
          {lastUpdate && (
            <span
              className="text-[11px]"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')} &middot;
              auto-refresh 30s
            </span>
          )}
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:brightness-110"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--accent-red)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, i) => (
          <StatCard key={card.label} {...card} index={i} />
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Volume de Logs - Ultimas 24h" index={0}>
          <VolumeLineChart
            data={(stats?.volume_24h ?? []) as Record<string, unknown>[]}
            xKey="hora"
            yKey="total"
          />
        </ChartCard>
        <ChartCard title="Top 10 IPs Publicos" index={1}>
          <TopBarChart
            data={(stats?.top_ips_publicos ?? []) as Record<string, unknown>[]}
            xKey="ip"
            yKey="total"
          />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Distribuicao por Tipo NAT" index={2}>
          <DistributionPieChart
            data={(stats?.distribuicao_tipo_nat ?? []) as Record<string, unknown>[]}
            nameKey="tipo"
            valueKey="total"
          />
        </ChartCard>
        <ChartCard title="Distribuicao por Protocolo" index={3}>
          <DistributionPieChart
            data={(stats?.distribuicao_protocolo ?? []) as Record<string, unknown>[]}
            nameKey="protocolo"
            valueKey="total"
          />
        </ChartCard>
      </div>
    </div>
  );
}
