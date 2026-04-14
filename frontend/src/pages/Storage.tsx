import { useState, useEffect, useCallback } from 'react';
import { HardDrive, Database, TrendingDown, RefreshCw } from 'lucide-react';
import api from '../api';
import { VolumeLineChart } from '../components/Charts';

interface DailyRow { dia: string; total: number; payload_bytes: number }
interface DiskInfo { compressed_bytes: number; uncompressed_bytes: number; total_rows: number }
interface StorageResponse { daily: DailyRow[]; disk: DiskInfo }

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderTop: `2px solid ${color}` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '14' }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </div>
  );
}

export default function StoragePage() {
  const [data, setData] = useState<StorageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get<StorageResponse>('/logs/storage');
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const daily = (data?.daily ?? []).slice().reverse();
  const disk = data?.disk ?? { compressed_bytes: 0, uncompressed_bytes: 0, total_rows: 0 };

  const totalDays = daily.length;
  const totalLogs = daily.reduce((s, d) => s + Number(d.total), 0);
  const avgPerDay = totalDays > 0 ? Math.round(totalLogs / totalDays) : 0;
  const compressionRatio = disk.uncompressed_bytes > 0 ? (disk.uncompressed_bytes / disk.compressed_bytes).toFixed(1) : '—';

  return (
    <div className="max-w-6xl">
      <div className="title-row">
        <h2>monitoramento<span className="accent"> / armazenamento</span></h2>
        <span className="meta">volume de logs · uso de disco · retenção</span>
        <div className="right">
          <button onClick={load} className="topnav-link cursor-pointer flex items-center gap-1.5" style={{ background: 'transparent' }}>
            <RefreshCw size={10} /> ATUALIZAR
          </button>
        </div>
      </div>
      <div className="px-6 pt-4 pb-8">

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Database} label="Total de Registros" value={disk.total_rows.toLocaleString('pt-BR')} color="#3b82f6" />
        <StatCard icon={HardDrive} label="Espaço em Disco" value={formatBytes(disk.compressed_bytes)} sub={`${formatBytes(disk.uncompressed_bytes)} descomprimido`} color="#6366f1" />
        <StatCard icon={TrendingDown} label="Taxa de Compressão" value={`${compressionRatio}x`} sub="ClickHouse LZ4" color="#22c55e" />
        <StatCard icon={Database} label="Média / Dia" value={avgPerDay.toLocaleString('pt-BR')} sub={`${totalDays} dias com dados`} color="#8b5cf6" />
      </div>

      {/* Chart: volume por dia */}
      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h3 className="text-[12px] font-semibold mb-4" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          Volume de Logs por Dia
        </h3>
        <VolumeLineChart data={daily as unknown as Record<string, unknown>[]} xKey="dia" yKey="total" height={240} />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
              {['Data', 'Logs', 'Payload Estimado', 'Média/Hora'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.daily ?? []).map((row, i) => (
              <tr key={row.dia} style={{ borderTop: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-card)' }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--accent-cyan)', fontSize: 12 }}>
                  {new Date(row.dia + 'T12:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                  {Number(row.total).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  {formatBytes(Number(row.payload_bytes))}
                </td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {Math.round(Number(row.total) / 24).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data?.daily ?? []).length === 0 && (
          <div className="px-4 py-14 text-center text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Nenhum dado de armazenamento disponível.</div>
        )}
      </div>
      </div>
    </div>
  );
}
