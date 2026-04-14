import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: string;
  ip_publico: string;
  ip_privado: string;
  porta_publica: number;
  porta_privada: number;
  protocolo: string;
  tipo_nat: string;
  equipamento_origem: string;
  payload_raw?: string;
}

export interface LogFilters {
  ip_publico?: string;
  ip_privado?: string;
  protocolo?: string;
  tipo_nat?: string;
  equipamento_origem?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface StatsResponse {
  total_logs: number;
  logs_hoje: number;
  ips_publicos_unicos: number;
  ips_privados_unicos: number;
  volume_24h:               { hora: string;       total: number }[];
  top_ips_publicos:         { ip: string;          total: number; sources?: string[] }[];
  top_ips_privados:         { ip: string;          total: number; sources?: string[] }[];
  distribuicao_tipo_nat:    { tipo: string;        total: number }[];
  distribuicao_protocolo:   { protocolo: string;   total: number }[];
  distribuicao_equipamento: { equipamento: string; total: number }[];
}

export interface LogsResponse {
  data: LogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Input {
  id: string;
  name: string;
  equipment_type: string;
  protocol_type: string;
  source_ip: string;
  port: number;
  description: string;
  enabled: boolean;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  allowed_instances?: string[];
  created_at: string;
}

export interface AppConfig {
  tz_offset_hours: number;
  platform_name: string;
  retention_months: number;
  ingest_ip: string;
}

export interface PublicConfig {
  platform_name: string;
  multi_tenant_mode: boolean;
  ingest_ip: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function fetchStats(
  equipamento_origem?: string,
  rangeMinutes?: number,
): Promise<StatsResponse> {
  const params = new URLSearchParams();
  if (equipamento_origem) params.set('equipamento_origem', equipamento_origem);
  if (rangeMinutes && rangeMinutes > 0) {
    const now = new Date();
    const start = new Date(now.getTime() - rangeMinutes * 60_000);
    const toNaive = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    params.set('start_date', toNaive(start));
    params.set('end_date', toNaive(now));
  }
  const qs = params.toString() ? `?${params.toString()}` : '';
  const { data } = await api.get(`/logs/stats${qs}`);
  return {
    total_logs:              data.total          ?? 0,
    logs_hoje:               data.today          ?? 0,
    ips_publicos_unicos:     data.unique_public_ips  ?? 0,
    ips_privados_unicos:     data.unique_private_ips ?? 0,
    volume_24h: (data.volume_by_hour ?? []).map((v: Record<string, unknown>) => ({
      hora:  v.hour, total: v.count,
    })),
    top_ips_publicos: (data.top_public_ips ?? []).map((v: Record<string, unknown>) => ({
      ip: v.ip as string, total: v.count as number, sources: (v.sources as string[] | undefined) ?? [],
    })),
    top_ips_privados: (data.top_private_ips ?? []).map((v: Record<string, unknown>) => ({
      ip: v.ip as string, total: v.count as number, sources: (v.sources as string[] | undefined) ?? [],
    })),
    distribuicao_tipo_nat: (data.tipo_nat_distribution ?? []).map((v: Record<string, unknown>) => ({
      tipo: v.tipo_nat, total: v.count,
    })),
    distribuicao_protocolo: (data.protocolo_distribution ?? []).map((v: Record<string, unknown>) => ({
      protocolo: v.protocolo, total: v.count,
    })),
    distribuicao_equipamento: (data.equipamento_distribution ?? []).map((v: Record<string, unknown>) => ({
      equipamento: v.equipamento_origem, total: v.count,
    })),
  };
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export async function fetchLogs(filters: LogFilters): Promise<LogsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.append(k, String(v));
  });
  const { data } = await api.get(`/logs?${params.toString()}`);
  return {
    data:       data.data ?? [],
    total:      data.pagination?.total ?? 0,
    page:       data.pagination?.page  ?? 1,
    limit:      data.pagination?.limit ?? 50,
    totalPages: data.pagination?.pages ?? 0,
  };
}

// ── Inputs ────────────────────────────────────────────────────────────────────

export async function fetchInputs(): Promise<Input[]> {
  const { data } = await api.get('/inputs');
  return data;
}

export async function createInput(dto: Omit<Input, 'id' | 'created_at'>): Promise<Input> {
  const { data } = await api.post('/inputs', dto);
  return data;
}

export async function updateInput(id: string, dto: Partial<Omit<Input, 'id' | 'created_at'>>): Promise<Input> {
  const { data } = await api.put(`/inputs/${id}`, dto);
  return data;
}

export async function deleteInput(id: string): Promise<void> {
  await api.delete(`/inputs/${id}`);
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get('/users');
  return data;
}

export async function createUser(dto: { username: string; password: string; role?: string; name?: string; allowed_instances?: string[] }): Promise<User> {
  const { data } = await api.post('/users', dto);
  return data;
}

export async function updateUser(id: string, dto: { password?: string; role?: string; name?: string; allowed_instances?: string[] }): Promise<User> {
  const { data } = await api.put(`/users/${id}`, dto);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function fetchConfig(): Promise<AppConfig> {
  const { data } = await api.get('/config');
  return data;
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const { data } = await api.get('/config/public');
  return data;
}

export async function updateConfig(dto: Partial<AppConfig>): Promise<AppConfig> {
  const { data } = await api.put('/config', dto);
  return data;
}

// ── CGNAT pools ───────────────────────────────────────────────────────────────

export interface CgnatPool {
  id: string;
  equipamento_origem: string;
  private_pool_start: string;
  public_pool_cidr: string;
  first_port: number;
  ports_per_client: number;
  chains_count: number;
  description: string;
  created_at: string;
}

export async function fetchCgnatPools(): Promise<CgnatPool[]> {
  const { data } = await api.get('/cgnat-pools');
  return data;
}

export async function createCgnatPool(dto: Omit<CgnatPool, 'id' | 'created_at'>): Promise<CgnatPool> {
  const { data } = await api.post('/cgnat-pools', dto);
  return data;
}

export async function updateCgnatPool(id: string, dto: Partial<Omit<CgnatPool, 'id' | 'created_at'>>): Promise<CgnatPool> {
  const { data } = await api.put(`/cgnat-pools/${id}`, dto);
  return data;
}

export async function deleteCgnatPool(id: string): Promise<void> {
  await api.delete(`/cgnat-pools/${id}`);
}

export default api;
