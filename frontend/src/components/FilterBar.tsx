import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { LogFilters } from '../api';

interface FilterBarProps {
  onApply: (filters: LogFilters) => void;
  onClear: () => void;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
};

export default function FilterBar({ onApply, onClear }: FilterBarProps) {
  const [filters, setFilters] = useState<LogFilters>({
    ip_publico: '',
    ip_privado: '',
    protocolo: '',
    tipo_nat: '',
    start_date: '',
    end_date: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(filters);
  };

  const handleClear = () => {
    setFilters({
      ip_publico: '',
      ip_privado: '',
      protocolo: '',
      tipo_nat: '',
      start_date: '',
      end_date: '',
    });
    onClear();
  };

  return (
    <form
      onSubmit={handleApply}
      className="rounded-xl p-4 mb-4"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            IP Publico
          </label>
          <input
            name="ip_publico"
            value={filters.ip_publico}
            onChange={handleChange}
            placeholder="ex: 203.0.113.1"
            className="rounded-lg px-3 py-2"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            IP Privado
          </label>
          <input
            name="ip_privado"
            value={filters.ip_privado}
            onChange={handleChange}
            placeholder="ex: 10.0.0.1"
            className="rounded-lg px-3 py-2"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Protocolo
          </label>
          <select
            name="protocolo"
            value={filters.protocolo}
            onChange={handleChange}
            className="rounded-lg px-3 py-2"
            style={inputStyle}
          >
            <option value="">Todos</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="ICMP">ICMP</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Tipo NAT
          </label>
          <select
            name="tipo_nat"
            value={filters.tipo_nat}
            onChange={handleChange}
            className="rounded-lg px-3 py-2"
            style={inputStyle}
          >
            <option value="">Todos</option>
            <option value="estatico">Estatico</option>
            <option value="CGNAT">CGNAT</option>
            <option value="BPA">BPA</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Data Inicio
          </label>
          <input
            name="start_date"
            type="datetime-local"
            value={filters.start_date}
            onChange={handleChange}
            className="rounded-lg px-3 py-2"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Data Fim
          </label>
          <input
            name="end_date"
            type="datetime-local"
            value={filters.end_date}
            onChange={handleChange}
            className="rounded-lg px-3 py-2"
            style={inputStyle}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #00d4ff, #3b82f6)',
            color: '#0a0e14',
            fontFamily: 'var(--font-display)',
          }}
        >
          <Search size={15} />
          Buscar
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-display)',
          }}
        >
          <X size={15} />
          Limpar
        </button>
      </div>
    </form>
  );
}
