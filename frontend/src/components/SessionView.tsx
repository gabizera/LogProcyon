import { X } from 'lucide-react';
import type { LogEntry } from '../api';

interface SessionViewProps {
  log: LogEntry | null;
  onClose: () => void;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('pt-BR', {
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

const fields: { key: keyof LogEntry; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'ip_publico', label: 'IP Publico' },
  { key: 'ip_privado', label: 'IP Privado' },
  { key: 'porta_publica', label: 'Porta Publica' },
  { key: 'porta_privada', label: 'Porta Privada' },
  { key: 'protocolo', label: 'Protocolo' },
  { key: 'tipo_nat', label: 'Tipo NAT' },
  { key: 'equipamento_origem', label: 'Equipamento' },
];

export default function SessionView({ log, onClose }: SessionViewProps) {
  if (!log) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden animate-card"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--glow-cyan)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h3
            className="text-sm font-bold uppercase tracking-wider"
            style={{
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Detalhes da Sessao
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors cursor-pointer hover:bg-white/10"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div className="p-5 space-y-3">
          {fields.map(({ key, label }) => {
            let value = String(log[key] ?? '—');
            if (key === 'timestamp') value = formatTimestamp(value);
            return (
              <div
                key={key}
                className="flex items-center gap-4 py-2 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider w-36 shrink-0"
                  style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {label}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {value}
                </span>
              </div>
            );
          })}
        </div>

        {/* Raw log */}
        {log.payload_raw && (
          <div
            className="mx-5 mb-5 p-4 rounded-lg"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span
              className="block text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Log Original
            </span>
            <pre
              className="text-xs whitespace-pre-wrap break-all"
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {log.payload_raw}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
