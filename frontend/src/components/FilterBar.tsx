import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { fetchInputs, type LogFilters, type Input } from '../api';

interface FilterBarProps {
  onApply: (filters: LogFilters) => void;
  onClear: () => void;
  initial?: LogFilters;
}

const inputClass = 'rounded-lg px-3 py-2 w-full text-[13px] transition-all';
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
};

const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
};

export default function FilterBar({ onApply, onClear, initial }: FilterBarProps) {
  const [filters, setFilters] = useState<LogFilters>({
    ip_publico: initial?.ip_publico ?? '',
    ip_privado: initial?.ip_privado ?? '',
    protocolo: initial?.protocolo ?? '',
    tipo_nat: initial?.tipo_nat ?? '',
    equipamento_origem: initial?.equipamento_origem ?? '',
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
  });
  const [instances, setInstances] = useState<Input[]>([]);

  useEffect(() => {
    fetchInputs().then(setInstances).catch(() => setInstances([]));
  }, []);

  // Keep internal state in sync when parent changes filters (e.g. URL → autoSearch)
  useEffect(() => {
    setFilters(prev => ({ ...prev, ...(initial ?? {}) }));
  }, [initial]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(filters);
  };

  const handleClear = () => {
    const empty = { ip_publico: '', ip_privado: '', protocolo: '', tipo_nat: '', equipamento_origem: '', start_date: '', end_date: '' };
    setFilters(empty);
    onClear();
  };

  return (
    <form
      onSubmit={handleApply}
      className="rounded-xl p-4 mb-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { name: 'ip_publico',  label: 'IP Público',   placeholder: 'Filtrar por IP', type: 'text'           },
          { name: 'ip_privado',  label: 'IP Privado',   placeholder: 'Filtrar por IP', type: 'text'           },
        ].map(f => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={labelStyle}>{f.label}</label>
            <input
              name={f.name}
              value={(filters as Record<string, string>)[f.name]}
              onChange={handleChange}
              placeholder={f.placeholder}
              type={f.type}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={labelStyle}>Protocolo</label>
          <select name="protocolo" value={filters.protocolo} onChange={handleChange} className={inputClass} style={inputStyle}>
            <option value="">Todos</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="ICMP">ICMP</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={labelStyle}>Tipo NAT</label>
          <select name="tipo_nat" value={filters.tipo_nat} onChange={handleChange} className={inputClass} style={inputStyle}>
            <option value="">Todos</option>
            <option value="estatico">Estático</option>
            <option value="cgnat">CGNAT</option>
            <option value="bpa">BPA</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider" style={labelStyle}>Equipamento</label>
          <select name="equipamento_origem" value={filters.equipamento_origem} onChange={handleChange} className={inputClass} style={inputStyle}>
            <option value="">Todos</option>
            {instances.map(i => (
              <option key={i.id} value={i.name}>{i.name}</option>
            ))}
          </select>
        </div>

        {[
          { name: 'start_date', label: 'Data Início' },
          { name: 'end_date',   label: 'Data Fim'    },
        ].map(f => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider" style={labelStyle}>{f.label}</label>
            <input
              name={f.name}
              type="datetime-local"
              value={(filters as Record<string, string>)[f.name]}
              onChange={handleChange}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)',
            color: '#020617',
            fontFamily: 'var(--font-display)',
          }}
        >
          <Search size={14} />
          Buscar
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all hover:brightness-110"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-display)',
          }}
        >
          <X size={14} />
          Limpar
        </button>
      </div>
    </form>
  );
}
