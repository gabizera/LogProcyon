import { useState, useEffect, useCallback } from 'react';
import { Users as UsersIcon, Plus, Trash2, X, Check, AlertCircle, KeyRound, Shield } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser, fetchInputs, fetchPublicConfig, type User, type Input } from '../api';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:    { label: 'Admin',    color: 'var(--accent-amber)'  },
  operator: { label: 'Operador', color: 'var(--accent-cyan)'   },
  viewer:   { label: 'Viewer',   color: 'var(--text-secondary)'},
};

function CreateForm({ onSave, onCancel, multiTenant, inputs }: {
  onSave: (f: { username: string; password: string; role: string; name: string; allowed_instances: string[] }) => Promise<void>;
  onCancel: () => void;
  multiTenant: boolean;
  inputs: Input[];
}) {
  const [form, setForm] = useState<{ username: string; password: string; role: string; name: string; allowed_instances: string[] }>({
    username: '', password: '', role: 'operator', name: '', allowed_instances: [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const toggleInstance = (id: string) => {
    setForm(p => ({
      ...p,
      allowed_instances: p.allowed_instances.includes(id)
        ? p.allowed_instances.filter(x => x !== id)
        : [...p.allowed_instances, id],
    }));
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try { await onSave(form); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro ao criar usuário'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-5 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { key: 'username', label: 'Username *', placeholder: 'nome.usuario' },
          { key: 'name',     label: 'Nome',       placeholder: 'Nome completo'  },
        ].map(f => (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.label}</label>
            <input value={(form as unknown as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder} required={f.key === 'username'} className="rounded-lg px-3 py-2" style={inputStyle} />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Senha *</label>
          <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6}
            placeholder="Mínimo 6 caracteres" className="rounded-lg px-3 py-2" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Perfil</label>
          <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="rounded-lg px-3 py-2" style={inputStyle}>
            <option value="admin">Admin</option>
            <option value="operator">Operador</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </div>

      {multiTenant && form.role !== 'admin' && (
        <div className="mb-4">
          <label className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <Shield size={11} /> Clientes permitidos
          </label>
          {inputs.length === 0 ? (
            <div className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Nenhuma instance cadastrada ainda.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {inputs.map(i => {
                const selected = form.allowed_instances.includes(i.id);
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggleInstance(i.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                    style={{
                      background: selected ? 'rgba(6,182,212,0.15)' : 'var(--bg-tertiary)',
                      color: selected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      border: `1px solid ${selected ? 'rgba(6,182,212,0.4)' : 'var(--border-subtle)'}`,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {selected ? '✓ ' : ''}{i.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Vazio = sem acesso. Admins veem tudo.
          </div>
        </div>
      )}

      {err && <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}><AlertCircle size={13} />{err}</div>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)', color: '#020617', fontFamily: 'var(--font-display)' }}>
          <Check size={14} />{saving ? 'Criando...' : 'Criar Usuário'}
        </button>
        <button type="button" onClick={onCancel} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:brightness-110"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-display)' }}>
          <X size={14} />Cancelar
        </button>
      </div>
    </form>
  );
}

function ChangePasswordModal({ user, onSave, onClose }: { user: User; onSave: (id: string, pwd: string) => Promise<void>; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try { await onSave(user.id, password); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-card)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Trocar senha — {user.username}</span>
          <button onClick={onClose} className="p-1 rounded cursor-pointer hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
            placeholder="Nova senha (mínimo 6 caracteres)" autoFocus
            className="w-full rounded-lg px-3 py-2 mb-3"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13 }} />
          {err && <div className="mb-3 text-xs" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{err}</div>}
          <button type="submit" disabled={saving} className="w-full py-2 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)', color: '#020617', fontFamily: 'var(--font-display)' }}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers]         = useState<User[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [changePwd, setChangePwd] = useState<User | null>(null);
  const [error, setError]         = useState('');
  const [multiTenant, setMultiTenant] = useState(false);
  const [inputs, setInputs] = useState<Input[]>([]);

  const load = useCallback(async () => {
    try {
      const [u, ins, cfg] = await Promise.all([
        fetchUsers(),
        fetchInputs().catch(() => [] as Input[]),
        fetchPublicConfig().catch(() => ({ platform_name: '', multi_tenant_mode: false })),
      ]);
      setUsers(u);
      setInputs(ins);
      setMultiTenant(cfg.multi_tenant_mode);
      setError('');
    } catch { setError('Erro ao carregar usuários'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const instanceNameById = (id: string) => inputs.find(i => i.id === id)?.name ?? id;

  const handleCreate = async (form: Parameters<typeof createUser>[0]) => {
    await createUser(form);
    await load();
    setShowForm(false);
  };

  const handleChangePwd = async (id: string, password: string) => {
    await updateUser(id, { password });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este usuário?')) return;
    await deleteUser(id);
    await load();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <UsersIcon size={17} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Usuários</h2>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Gerenciamento de acessos ao LogProcyon</span>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, var(--accent-cyan), #3b82f6)', color: '#020617', fontFamily: 'var(--font-display)' }}>
            <Plus size={14} /> Novo Usuário
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
          {error}
        </div>
      )}

      {showForm && <CreateForm onSave={handleCreate} onCancel={() => setShowForm(false)} multiTenant={multiTenant} inputs={inputs} />}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm" style={{ fontFamily: 'var(--font-display)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                {(['Usuário', 'Nome', 'Perfil', ...(multiTenant ? ['Clientes'] : []), 'Criado em', 'Ações']).map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const roleInfo = ROLE_LABELS[u.role] ?? { label: u.role, color: 'var(--text-muted)' };
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-card)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{u.username}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{u.name}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={{ color: roleInfo.color, background: roleInfo.color + '14', border: `1px solid ${roleInfo.color}22` }}>{roleInfo.label}</span>
                    </td>
                    {multiTenant && (
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {u.role === 'admin' ? (
                          <span style={{ color: 'var(--accent-amber)' }}>todos</span>
                        ) : (u.allowed_instances ?? []).length === 0 ? (
                          <span style={{ color: 'var(--accent-red)' }}>nenhum</span>
                        ) : (
                          <span>{(u.allowed_instances ?? []).map(instanceNameById).join(', ')}</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setChangePwd(u)} className="p-1.5 rounded-lg cursor-pointer hover:brightness-125 transition-all"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }} title="Trocar senha">
                          <KeyRound size={13} />
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-lg cursor-pointer hover:brightness-125 transition-all"
                          style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.15)' }} title="Remover">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="px-4 py-14 text-center text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Nenhum usuário cadastrado.</div>
          )}
        </div>
      )}

      {changePwd && <ChangePasswordModal user={changePwd} onSave={handleChangePwd} onClose={() => setChangePwd(null)} />}
    </div>
  );
}
