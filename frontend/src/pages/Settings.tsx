import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchConfig, updateConfig, type AppConfig } from '../api';

const TZ_OPTIONS = [
  { value: -5,  label: 'UTC-5 (BRT - Acre)'      },
  { value: -4,  label: 'UTC-4 (AMT - Manaus)'    },
  { value: -3,  label: 'UTC-3 (BRT - Brasília)'  },
  { value: -2,  label: 'UTC-2 (Fernando de Noronha)' },
  { value: 0,   label: 'UTC+0 (GMT)'              },
  { value: 1,   label: 'UTC+1 (CET)'              },
  { value: 2,   label: 'UTC+2 (EET)'              },
];

export default function SettingsPage() {
  const [config, setConfig]   = useState<AppConfig | null>(null);
  const [form, setForm]       = useState<Partial<AppConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [status, setStatus]   = useState<'idle' | 'ok' | 'error'>('idle');
  const [errMsg, setErrMsg]   = useState('');

  useEffect(() => {
    fetchConfig()
      .then(c => { setConfig(c); setForm(c); })
      .catch(() => setErrMsg('Erro ao carregar configurações'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus('idle');
    try {
      const updated = await updateConfig(form);
      setConfig(updated);
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setErrMsg('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-cyan)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="title-row">
        <h2>sistema<span className="accent"> / configurações</span></h2>
        <span className="meta">fuso horário · nome da plataforma · retenção</span>
      </div>
      <div className="px-6 pt-4 pb-8">

      {errMsg && status === 'error' && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
          <AlertCircle size={13} /> {errMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex flex-col gap-5">

          {/* Platform name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Nome da Plataforma
            </label>
            <input
              value={form.platform_name ?? ''}
              onChange={e => setForm(p => ({ ...p, platform_name: e.target.value }))}
              placeholder="LogProcyon"
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Nome exibido no título da plataforma
            </span>
          </div>

          {/* Timezone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Fuso Horário (TZ Offset)
            </label>
            <select
              value={form.tz_offset_hours ?? -3}
              onChange={e => setForm(p => ({ ...p, tz_offset_hours: parseInt(e.target.value) }))}
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            >
              {TZ_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              {/* Custom option if not in list */}
              {!TZ_OPTIONS.find(o => o.value === form.tz_offset_hours) && (
                <option value={form.tz_offset_hours}>UTC{(form.tz_offset_hours ?? 0) >= 0 ? '+' : ''}{form.tz_offset_hours} (personalizado)</option>
              )}
            </select>
            <span className="text-[10px]" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Offset aplicado aos timestamps dos logs recebidos. Configuração atual do collector: <strong style={{ color: 'var(--text-secondary)' }}>UTC{(config?.tz_offset_hours ?? -3) >= 0 ? '+' : ''}{config?.tz_offset_hours}</strong>
              <br />Após salvar, reinicie o container do collector para aplicar o novo timezone.
            </span>
          </div>

          {/* Retention */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Retenção de Dados (meses)
            </label>
            <input
              type="number"
              value={form.retention_months ?? 15}
              onChange={e => setForm(p => ({ ...p, retention_months: parseInt(e.target.value) }))}
              min={1}
              max={60}
              className="rounded-lg px-3 py-2"
              style={inputStyle}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Período de retenção configurado no schema ClickHouse (padrão: 15 meses). Alterar aqui não aplica automaticamente o TTL — execute manualmente no ClickHouse.
            </span>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, var(--accent-amber), #d97706)', color: '#020617', fontFamily: 'var(--font-display)' }}
            >
              <Save size={14} />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>

            {status === 'ok' && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                <CheckCircle2 size={14} /> Salvo com sucesso
              </div>
            )}
          </div>
        </div>
      </form>

      {/* System info */}
      <div className="mt-5 rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
        <h4 className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
          Configuração atual do sistema
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Plataforma',  value: config?.platform_name ?? '—'    },
            { label: 'TZ Offset',   value: `UTC${(config?.tz_offset_hours ?? -3) >= 0 ? '+' : ''}${config?.tz_offset_hours ?? -3}` },
            { label: 'Retenção',    value: `${config?.retention_months ?? 15} meses` },
          ].map(f => (
            <div key={f.label}>
              <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{f.label}</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
