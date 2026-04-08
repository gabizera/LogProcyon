import type { LogEntry } from '../api';

interface LogTableProps {
  logs: LogEntry[];
  loading: boolean;
  onRowClick: (log: LogEntry) => void;
}

const columns = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'ip_publico', label: 'IP Publico' },
  { key: 'ip_privado', label: 'IP Privado' },
  { key: 'porta_publica', label: 'Porta Pub.' },
  { key: 'porta_privada', label: 'Porta Priv.' },
  { key: 'protocolo', label: 'Protocolo' },
  { key: 'tipo_nat', label: 'Tipo NAT' },
  { key: 'equipamento_origem', label: 'Equipamento' },
];

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function getBadgeColor(tipo: string): string {
  switch (tipo?.toUpperCase()) {
    case 'CGNAT':
      return '#3b82f6';
    case 'BPA':
      return '#f59e0b';
    case 'ESTATICO':
      return '#22c55e';
    default:
      return '#8899aa';
  }
}

function getProtocolColor(proto: string): string {
  switch (proto?.toUpperCase()) {
    case 'TCP':
      return '#00d4ff';
    case 'UDP':
      return '#a855f7';
    case 'ICMP':
      return '#f97316';
    default:
      return '#8899aa';
  }
}

export default function LogTable({ logs, loading, onRowClick }: LogTableProps) {
  if (loading) {
    return (
      <div
        className="rounded-xl p-12 flex items-center justify-center"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }}
          />
          <span
            className="text-sm"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Carregando logs...
          </span>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div
        className="rounded-xl p-12 flex items-center justify-center"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span
          className="text-sm"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Nenhum log encontrado.
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr
                key={log.id || i}
                className="log-row cursor-pointer"
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                }}
                onClick={() => onRowClick(log)}
              >
                <td
                  className="px-4 py-2.5 whitespace-nowrap text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {formatTimestamp(log.timestamp)}
                </td>
                <td
                  className="px-4 py-2.5 whitespace-nowrap text-xs font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {log.ip_publico}
                </td>
                <td
                  className="px-4 py-2.5 whitespace-nowrap text-xs"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {log.ip_privado}
                </td>
                <td
                  className="px-4 py-2.5 whitespace-nowrap text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {log.porta_publica}
                </td>
                <td
                  className="px-4 py-2.5 whitespace-nowrap text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {log.porta_privada}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    style={{
                      color: getProtocolColor(log.protocolo),
                      background: getProtocolColor(log.protocolo) + '18',
                      border: `1px solid ${getProtocolColor(log.protocolo)}30`,
                    }}
                  >
                    {log.protocolo}
                  </span>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    style={{
                      color: getBadgeColor(log.tipo_nat),
                      background: getBadgeColor(log.tipo_nat) + '18',
                      border: `1px solid ${getBadgeColor(log.tipo_nat)}30`,
                    }}
                  >
                    {log.tipo_nat}
                  </span>
                </td>
                <td
                  className="px-4 py-2.5 whitespace-nowrap text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {log.equipamento_origem}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
