import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, AlertCircle, Calculator } from 'lucide-react';
import {
  fetchCgnatPools, createCgnatPool, updateCgnatPool, deleteCgnatPool,
  fetchInputs, type CgnatPool, type Input,
} from '../api';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
};

type FormData = Omit<CgnatPool, 'id' | 'created_at'>;
const emptyForm: FormData = {
  equipamento_origem: '',
  private_pool_start: '100.64.0.0',
  public_pool_cidr:   '200.0.0.0/27',
  first_port:         1024,
  ports_per_client:   2016,
  chains_count:       32,
  description:        '',
};

function PoolForm({ initial, onSave, onCancel, instances }: {
  initial: FormData;
  onSave: (f: FormData) => Promise<void>;
  onCancel: () => void;
  instances: Input[];
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? ((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Erro')
        : 'Erro';
      setErr(String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Equipamento *</label>
          <select value={form.equipamento_origem} onChange={e => set('equipamento_origem', e.target.value)} required className="rounded-lg px-3 py-2" style={inputStyle}>
            <option value="">Selecione...</option>
            {instances.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Descrição</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Opcional" className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Pool Privado Inicial *</label>
          <input value={form.private_pool_start} onChange={e => set('private_pool_start', e.target.value)} placeholder="100.64.0.0" required className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Pool Público CIDR *</label>
          <input value={form.public_pool_cidr} onChange={e => set('public_pool_cidr', e.target.value)} placeholder="200.0.0.0/27" required className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Porta Inicial *</label>
          <input type="number" min={1} max={65535} value={form.first_port} onChange={e => set('first_port', parseInt(e.target.value) || 0)} required className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Portas por Cliente *</label>
          <input type="number" min={1} max={65535} value={form.ports_per_client} onChange={e => set('ports_per_client', parseInt(e.target.value) || 0)} required className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Qtd. Chains *</label>
          <input type="number" min={1} max={1024} value={form.chains_count} onChange={e => set('chains_count', parseInt(e.target.value) || 0)} required className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>
      </div>

      <div
        className="rounded-lg px-4 py-3 mb-4"
        style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-subtle)' }}
      >
        <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          capacidade total
        </div>
        <div className="text-sm tabular-nums" style={{ color: 'var(--signal)', fontFamily: 'var(--font-mono)' }}>
          {form.chains_count} chains × {form.ports_per_client} portas = {(form.chains_count * form.ports_per_client).toLocaleString('pt-BR')} portas · último bloco termina em {form.first_port + form.chains_count * form.ports_per_client - 1}
        </div>
      </div>

      {err && (
        <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
          <AlertCircle size={13} /> {err}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50"
          style={{ background: 'var(--signal)', color: '#050505', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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

export default function CgnatPools() {
  const [pools, setPools]     = useState<CgnatPool[]>([]);
  const [instances, setInstances] = useState<Input[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CgnatPool | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, ins] = await Promise.all([fetchCgnatPools(), fetchInputs()]);
      setPools(p);
      setInstances(ins);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form: FormData) => {
    await createCgnatPool(form);
    setCreating(false);
    await load();
  };

  const handleUpdate = async (form: FormData) => {
    if (!editing) return;
    await updateCgnatPool(editing.id, form);
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este pool CGNAT?')) return;
    await deleteCgnatPool(id);
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="title-row">
        <h2>configuração<span className="accent"> / pools cgnat</span></h2>
        <span className="meta">cálculo reverso de cgnat estático (mikrotik netmap)</span>
      </div>
      <div className="px-6 pt-4 pb-8">

        {!creating && !editing && (
          <div className="mb-4">
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110"
              style={{ background: 'var(--signal)', color: '#050505', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <Plus size={14} /> Novo Pool
            </button>
          </div>
        )}

        {creating && (
          <div className="mb-6">
            <PoolForm initial={emptyForm} onSave={handleCreate} onCancel={() => setCreating(false)} instances={instances} />
          </div>
        )}

        {editing && (
          <div className="mb-6">
            <PoolForm
              initial={{
                equipamento_origem: editing.equipamento_origem,
                private_pool_start: editing.private_pool_start,
                public_pool_cidr:   editing.public_pool_cidr,
                first_port:         editing.first_port,
                ports_per_client:   editing.ports_per_client,
                chains_count:       editing.chains_count,
                description:        editing.description,
              }}
              onSave={handleUpdate}
              onCancel={() => setEditing(null)}
              instances={instances}
            />
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>carregando...</div>
        ) : pools.length === 0 ? (
          <div className="rounded-xl p-8 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border-subtle)' }}>
            <Calculator size={32} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs max-w-md" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
              Nenhum pool cadastrado. Configure um pool pra cada Mikrotik que usa CGNAT estático — o sistema vai calcular o IP privado na busca judicial a partir de IP público + porta, sem depender de logs.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pools.map(p => (
              <div key={p.id} className="rounded-xl p-4 flex items-center justify-between gap-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--signal)', fontFamily: 'var(--font-mono)' }}>
                    {p.equipamento_origem}
                  </div>
                  <div className="text-[11px] tabular-nums mt-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {p.private_pool_start} → {p.public_pool_cidr} · portas {p.first_port}+ · {p.ports_per_client}/cliente · {p.chains_count} chains
                  </div>
                  {p.description && (
                    <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {p.description}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(p)} className="p-2 rounded-lg cursor-pointer hover:brightness-125"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg cursor-pointer hover:brightness-125"
                    style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
