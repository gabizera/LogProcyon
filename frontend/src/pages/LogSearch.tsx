import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchLogs, type LogEntry, type LogFilters, type LogsResponse } from '../api';
import FilterBar from '../components/FilterBar';
import LogTable from '../components/LogTable';
import SessionView from '../components/SessionView';

export default function LogSearch() {
  const [result, setResult] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<LogFilters>({});
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const search = useCallback(async (filters: LogFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLogs(filters);
      setResult(data);
      setCurrentFilters(filters);
    } catch (err) {
      setError('Erro ao buscar logs. Verifique a conexao com o backend.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApply = useCallback(
    (filters: LogFilters) => {
      search({ ...filters, page: 1, limit: 50 });
    },
    [search],
  );

  const handleClear = useCallback(() => {
    setResult(null);
    setCurrentFilters({});
    setError(null);
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      search({ ...currentFilters, page, limit: 50 });
    },
    [search, currentFilters],
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Busca de Logs
        </h2>
        <span
          className="text-[11px]"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Filtre e pesquise registros NAT/CGNAT/BPA
        </span>
      </div>

      {/* Filters */}
      <FilterBar onApply={handleApply} onClear={handleClear} />

      {/* Error */}
      {error && (
        <div
          className="mb-4 px-4 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--accent-red)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {error}
        </div>
      )}

      {/* Results info */}
      {result && (
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {result.total.toLocaleString('pt-BR')} registros encontrados
            {result.totalPages > 1 &&
              ` — Pagina ${result.page} de ${result.totalPages}`}
          </span>
        </div>
      )}

      {/* Table */}
      {(result || loading) && (
        <LogTable
          logs={result?.data ?? []}
          loading={loading}
          onRowClick={setSelectedLog}
        />
      )}

      {/* Prompt to search */}
      {!result && !loading && (
        <div
          className="rounded-xl p-16 flex items-center justify-center"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="text-center">
            <p
              className="text-sm mb-1"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}
            >
              Use os filtros acima para buscar logs
            </p>
            <p
              className="text-xs"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Preencha os campos desejados e clique em &quot;Buscar&quot;
            </p>
          </div>
        </div>
      )}

      {/* Pagination */}
      {result && result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => goToPage(result.page - 1)}
            disabled={result.page <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <ChevronLeft size={14} />
            Anterior
          </button>

          {generatePageNumbers(result.page, result.totalPages).map((p, i) =>
            p === -1 ? (
              <span
                key={`ellipsis-${i}`}
                className="px-2 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className="w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background:
                    p === result.page
                      ? 'linear-gradient(135deg, #00d4ff, #3b82f6)'
                      : 'var(--bg-tertiary)',
                  color: p === result.page ? '#0a0e14' : 'var(--text-secondary)',
                  border: `1px solid ${
                    p === result.page ? 'transparent' : 'var(--border-subtle)'
                  }`,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => goToPage(result.page + 1)}
            disabled={result.page >= result.totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Proximo
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Session detail modal */}
      <SessionView log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}

function generatePageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: number[] = [1];
  if (current > 3) pages.push(-1);
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push(-1);
  pages.push(total);
  return pages;
}
