import { useState, useEffect, useCallback } from 'react';
import { Radio, Plus, Pencil, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { fetchInputs, createInput, updateInput, deleteInput, type Input } from '../api';

const EQUIPMENT_TYPES = ['cisco', 'a10', 'nokia', 'hillstone', 'juniper', 'generic'];
const PROTOCOL_TYPES  = [
  { value: 'netflow_v9',  label: 'NetFlow v9 (UDP)' },
  { value: 'ipfix',       label: 'IPFIX (UDP)' },
  { value: 'syslog_udp',  label: 'Syslog UDP' },
  { value: 'syslog_tcp',  label: 'Syslog TCP' },
];

const EQUIPMENT_COLORS: Record<string, string> = {
  cisco:     'var(--accent-cyan)',
  a10:       'var(--accent-green)',
  nokia:     '#3b82f6',
  hillstone: 'var(--accent-amber)',
  juniper:   'var(--accent-purple)',
  generic:   'var(--text-muted)',
};

const emptyForm = { name: '', equipment_type: 'cisco', protocol_type: 'netflow_v9', source_ip: '', port: 514, description: '', enabled: true };

type FormData = typeof emptyForm;

function InputForm({
  initial, onSave, onCancel,
}: { initial: FormData; onSave: (f: FormData) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof FormData, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await onSave(form);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Nome *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Ex: Cisco BRAS 01" className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Equipamento *</label>
          <select value={form.equipment_type} onChange={e => set('equipment_type', e.target.value)} className="rounded-lg px-3 py-2" style={inputStyle}>
            {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Protocolo *</label>
          <select value={form.protocol_type} onChange={e => set('protocol_type', e.target.value)} className="rounded-lg px-3 py-2" style={inputStyle}>
            {PROTOCOL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>IP de Origem</label>
          <input value={form.source_ip} onChange={e => set('source_ip', e.target.value)} placeholder="Deixe vazio para qualquer IP" className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Porta UDP *</label>
          <input type="number" value={form.port} onChange={e => set('port', parseInt(e.target.value))} min={1} max={65535} required className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Descrição</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Opcional" className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input type="checkbox" id="enabled" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} className="cursor-pointer" />
        <label htmlFor="enabled" className="text-xs cursor-pointer" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>Habilitado</label>
      </div>

      {err && (
        <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
          <AlertCircle size={13} /> {err}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)', color: '#020617', fontFamily: 'var(--font-display)' }}>
          <Check size={14} />{saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:brightness-110"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-display)' }}>
          <X size={14} />Cancelar
        </button>
      </div>
    </form>
  );
}

export default function Inputs() {
  const [inputs, setInputs]   = useState<Input[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Input | null>(null);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    try {
      setInputs(await fetchInputs());
      setError('');
    } catch { setError('Erro ao carregar inputs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form: FormData) => {
    await createInput(form);
    await load();
    setShowForm(false);
  };

  const handleUpdate = async (form: FormData) => {
    if (!editing) return;
    await updateInput(editing.id, form);
    await load();
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este input?')) return;
    await deleteInput(id);
    await load();
  };

  return (
    <div className="max-w-5xl">
      <div className="title-row">
        <h2>sources<span className="accent"> / inputs</span></h2>
        <span className="meta">cisco · a10 · nokia · hillstone · juniper</span>
        {!showForm && !editing && (
          <div className="right">
            <button onClick={() => setShowForm(true)} className="topnav-link cursor-pointer flex items-center gap-1.5" style={{ background: 'transparent' }}>
              <Plus size={11} /> NOVO INPUT
            </button>
          </div>
        )}
      </div>
      <div className="px-6 pt-4 pb-8">

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
          {error}
        </div>
      )}

      {(showForm) && (
        <div className="mb-5">
          <InputForm initial={{ ...emptyForm }} onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {inputs.length === 0 && !showForm && (
            <div className="rounded-xl p-14 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <Radio size={20} style={{ color: 'var(--accent-cyan)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Nenhum input configurado
              </p>
              <p className="text-xs max-w-md text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                Cada input define uma fonte de log — equipamento, protocolo, porta e (opcionalmente) IP de origem. Cadastre um pra começar a receber NetFlow ou syslog no collector.
              </p>
              <button onClick={() => setShowForm(true)} className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)', color: '#020617', fontFamily: 'var(--font-display)' }}>
                <Plus size={14} /> Criar primeiro input
              </button>
            </div>
          )}
          {inputs.map(inp => (
            <div key={inp.id}>
              {editing?.id === inp.id ? (
                <InputForm
                  initial={{ name: inp.name, equipment_type: inp.equipment_type, protocol_type: inp.protocol_type, source_ip: inp.source_ip, port: inp.port, description: inp.description, enabled: inp.enabled }}
                  onSave={handleUpdate}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="rounded-xl px-5 py-4 flex items-center gap-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${inp.enabled ? 'live-dot' : ''}`}
                    style={{ background: inp.enabled ? 'var(--accent-green)' : 'var(--text-dim)' }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{inp.name}</span>
                      <span className="badge" style={{ color: EQUIPMENT_COLORS[inp.equipment_type] ?? 'var(--text-muted)', background: (EQUIPMENT_COLORS[inp.equipment_type] ?? '#888') + '14', border: `1px solid ${(EQUIPMENT_COLORS[inp.equipment_type] ?? '#888')}22` }}>
                        {inp.equipment_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <span>:{inp.port}</span>
                      <span>{PROTOCOL_TYPES.find(p => p.value === inp.protocol_type)?.label ?? inp.protocol_type}</span>
                      {inp.source_ip && <span>src: {inp.source_ip}</span>}
                      {inp.description && <span className="truncate">{inp.description}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setEditing(inp)} className="p-1.5 rounded-lg cursor-pointer hover:brightness-125 transition-all"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(inp.id)} className="p-1.5 rounded-lg cursor-pointer hover:brightness-125 transition-all"
                      style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 hairline p-4" style={{ background: 'var(--signal-bg)' }}>
        <p className="text-xs" style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
          <span style={{ color: 'var(--signal)' }}>HOT-RELOAD:</span> o collector detecta alterações automaticamente — não é necessário reiniciar.
          Novos inputs e portas são aplicados em até 2 segundos após salvar.
          Múltiplos inputs na mesma porta são distinguidos pelo IP de origem.
        </p>
      </div>
      </div>
    </div>
  );
}
