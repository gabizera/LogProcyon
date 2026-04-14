import type { LogEntry } from '../api';

interface LogTableProps {
  logs: LogEntry[];
  loading: boolean;
  onRowClick: (log: LogEntry) => void;
}

const columns = [
  { key: 'timestamp',         label: 'Timestamp'    },
  { key: 'ip_publico',        label: 'IP Público'   },
  { key: 'ip_privado',        label: 'IP Privado'   },
  { key: 'porta_inicio',      label: 'P. Inicial'   },
  { key: 'porta_fim',         label: 'P. Final'     },
  { key: 'tamanho_bloco',     label: 'Bloco'        },
  { key: 'protocolo',         label: 'Protocolo'    },
  { key: 'tipo_nat',          label: 'Tipo NAT'     },
  { key: 'equipamento_origem',label: 'Equipamento'  },
];

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ts; }
}

function ProtocolBadge({ proto }: { proto: string }) {
  const colors: Record<string, string> = {
    TCP: 'var(--accent-cyan)', UDP: 'var(--accent-purple)', ICMP: '#f97316',
  };
  const c = colors[proto?.toUpperCase()] ?? 'var(--text-muted)';
  return (
    <span
      className="badge"
      style={{ color: c, background: c + '14', border: `1px solid ${c}22` }}
    >
      {proto}
    </span>
  );
}

function NatBadge({ tipo }: { tipo: string }) {
  const colors: Record<string, string> = {
    CGNAT: 'var(--accent-blue)', BPA: 'var(--accent-amber)',
    ESTATICO: 'var(--accent-green)', cgnat: 'var(--accent-blue)',
    bpa: 'var(--accent-amber)', estatico: 'var(--accent-green)',
  };
  const c = colors[tipo] ?? 'var(--text-muted)';
  return (
    <span
      className="badge"
      style={{ color: c, background: c + '14', border: `1px solid ${c}22` }}
    >
      {tipo?.toUpperCase()}
    </span>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl p-14 flex items-center justify-center"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {text}
      </span>
    </div>
  );
}

export default function LogTable({ logs, loading, onRowClick }: LogTableProps) {
  if (loading) return <Placeholder text="Carregando logs..." />;
  if (logs.length === 0) return <Placeholder text="Nenhum log encontrado." />;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap"
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
                style={{ borderTop: '1px solid var(--border-subtle)' }}
                onClick={() => onRowClick(log)}
              >
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ color: 'var(--accent-cyan)' }}>
                  {log.ip_publico}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                  {log.ip_privado}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {log.porta_publica || <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {log.tamanho_bloco && log.tamanho_bloco > 0
                    ? log.porta_publica + log.tamanho_bloco - 1
                    : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {log.tamanho_bloco && log.tamanho_bloco > 0
                    ? log.tamanho_bloco.toLocaleString('pt-BR')
                    : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <ProtocolBadge proto={log.protocolo} />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <NatBadge tipo={log.tipo_nat} />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
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
