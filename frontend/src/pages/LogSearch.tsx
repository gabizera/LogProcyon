import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Layers, Search as SearchIcon } from 'lucide-react';
import { fetchLogs, type LogEntry, type LogFilters, type LogsResponse } from '../api';
import FilterBar from '../components/FilterBar';
import LogTable from '../components/LogTable';
import SessionView from '../components/SessionView';

export default function LogSearch() {
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<LogFilters>({});
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const autoSearched = useRef(false);

  const search = useCallback(async (filters: LogFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLogs(filters);
      setResult(data);
      setCurrentFilters(filters);
    } catch (err) {
      setError('Erro ao buscar logs. Verifique a conexão com o backend.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search from URL query params (e.g. /logs?ip_publico=1.2.3.4)
  useEffect(() => {
    if (autoSearched.current) return;
    const fromUrl: LogFilters = {};
    for (const [k, v] of searchParams.entries()) {
      (fromUrl as Record<string, string>)[k] = v;
    }
    if (Object.keys(fromUrl).length > 0) {
      autoSearched.current = true;
      setCurrentFilters(fromUrl);
      search({ ...fromUrl, page: 1, limit: 50 });
    }
  }, [searchParams, search]);

  const handleApply  = useCallback((filters: LogFilters) => search({ ...filters, page: 1, limit: 50 }), [search]);
  const handleClear  = useCallback(() => { setResult(null); setCurrentFilters({}); setError(null); }, []);
  const goToPage     = useCallback((page: number) => search({ ...currentFilters, page, limit: 50 }), [search, currentFilters]);

  return (
    <div>
      <div className="title-row">
        <h2>monitoramento<span className="accent"> / logs</span></h2>
        <span className="meta">busca e filtro de registros</span>
      </div>
      <div className="px-6 pt-4 pb-8">
      <FilterBar onApply={handleApply} onClear={handleClear} initial={currentFilters} />

      {error && (
        <div
          className="mb-4 px-4 py-2.5 rounded-lg text-xs"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}
        >
          {error}
        </div>
      )}

      {result && (
        <div className="flex items-center mb-3">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--accent-cyan)' }}>{result.total.toLocaleString('pt-BR')}</span>
            {' '}registros
            {result.totalPages > 1 && ` · página ${result.page} de ${result.totalPages}`}
          </span>
        </div>
      )}

      {(result || loading) && (
        <LogTable logs={result?.data ?? []} loading={loading} onRowClick={setSelectedLog} />
      )}

      {!result && !loading && (
        <div
          className="rounded-xl p-14 flex flex-col items-center justify-center gap-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}
          >
            <SearchIcon size={20} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Comece com um filtro
          </p>
          <p className="text-xs max-w-sm text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
            Informe ao menos um IP, porta, protocolo ou período acima e clique em <strong style={{ color: 'var(--text-secondary)' }}>Buscar</strong>. Dica: clicar nos gráficos do Dashboard também preenche os filtros automaticamente.
          </p>
        </div>
      )}

      {/* Pagination */}
      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-5">
          <PagBtn onClick={() => goToPage(result.page - 1)} disabled={result.page <= 1} label="← Anterior" />
          {generatePageNumbers(result.page, result.totalPages).map((p, i) =>
            p === -1
              ? <span key={`e${i}`} className="px-2 text-xs" style={{ color: 'var(--text-dim)' }}>···</span>
              : (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className="w-8 h-8 rounded-lg text-xs font-medium cursor-pointer transition-all"
                  style={{
                    background: p === result.page ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                    color:      p === result.page ? '#020617'            : 'var(--text-secondary)',
                    border:     p === result.page ? 'none'               : '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {p}
                </button>
              )
          )}
          <PagBtn onClick={() => goToPage(result.page + 1)} disabled={result.page >= result.totalPages} label="Próximo →" />
        </div>
      )}

      <SessionView log={selectedLog} onClose={() => setSelectedLog(null)} />
      </div>
    </div>
  );
}

function PagBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}
    >
      {label}
    </button>
  );
}

function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: number[] = [1];
  if (current > 3) pages.push(-1);
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push(-1);
  pages.push(total);
  return pages;
}
