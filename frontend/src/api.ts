import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

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
  volume_24h: { hora: string; total: number }[];
  top_ips_publicos: { ip: string; total: number }[];
  distribuicao_tipo_nat: { tipo: string; total: number }[];
  distribuicao_protocolo: { protocolo: string; total: number }[];
}

export interface LogsResponse {
  data: LogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AiAnalysisResponse {
  pergunta: string;
  sql: string;
  interpretacao: string;
  dados: Record<string, unknown>[];
}

export async function fetchStats(): Promise<StatsResponse> {
  const { data } = await api.get('/logs/stats');
  return {
    total_logs: data.total ?? 0,
    logs_hoje: data.today ?? 0,
    ips_publicos_unicos: data.unique_public_ips ?? 0,
    ips_privados_unicos: data.unique_private_ips ?? 0,
    volume_24h: (data.volume_by_hour ?? []).map((v: Record<string, unknown>) => ({
      hora: v.hour,
      total: v.count,
    })),
    top_ips_publicos: (data.top_public_ips ?? []).map((v: Record<string, unknown>) => ({
      ip: v.ip,
      total: v.count,
    })),
    distribuicao_tipo_nat: (data.tipo_nat_distribution ?? []).map((v: Record<string, unknown>) => ({
      tipo: v.tipo_nat,
      total: v.count,
    })),
    distribuicao_protocolo: (data.protocolo_distribution ?? []).map((v: Record<string, unknown>) => ({
      protocolo: v.protocolo,
      total: v.count,
    })),
  };
}

export async function fetchLogs(filters: LogFilters): Promise<LogsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.append(key, String(value));
    }
  });
  const { data } = await api.get(`/logs?${params.toString()}`);
  return {
    data: data.data ?? [],
    total: data.pagination?.total ?? 0,
    page: data.pagination?.page ?? 1,
    limit: data.pagination?.limit ?? 50,
    totalPages: data.pagination?.pages ?? 0,
  };
}

export async function analyzeWithAi(pergunta: string): Promise<AiAnalysisResponse> {
  const { data } = await api.post('/ai/analyze', { prompt: pergunta });
  return {
    pergunta,
    sql: data.sql ?? '',
    interpretacao: data.interpretation ?? '',
    dados: data.results ?? [],
  };
}

export default api;
