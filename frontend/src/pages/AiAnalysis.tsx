import { useState, useRef, useEffect } from 'react';
import { Send, BotMessageSquare, User, Code2, Loader2 } from 'lucide-react';
import { analyzeWithAi, type AiAnalysisResponse } from '../api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  data?: AiAnalysisResponse;
  error?: string;
}

export default function AiAnalysis() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const result = await analyzeWithAi(question);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.interpretacao,
          data: result,
        },
      ]);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Erro desconhecido ao processar a analise.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Nao foi possivel processar sua pergunta.',
          error: errorMsg,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
        >
          Analise com IA
        </h2>
        <span
          className="text-[11px]"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          Faca perguntas em linguagem natural sobre os logs
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #00d4ff10, #3b82f610)',
                border: '1px solid var(--border-medium)',
              }}
            >
              <BotMessageSquare size={28} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <div className="text-center max-w-md">
              <p
                className="text-sm font-medium mb-2"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Pergunte sobre seus logs de NAT/CGNAT/BPA
              </p>
              <p
                className="text-xs mb-6"
                style={{
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                A IA vai gerar consultas SQL e interpretar os resultados para voce
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'Quais os 5 IPs publicos com mais conexoes hoje?',
                  'Qual a distribuicao de protocolos nas ultimas 24h?',
                  'Mostre sessoes CGNAT do IP 10.0.0.1',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer hover:brightness-110"
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-1"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff20, #3b82f620)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <BotMessageSquare size={16} style={{ color: 'var(--accent-cyan)' }} />
              </div>
            )}

            <div
              className="max-w-[75%] rounded-xl px-4 py-3"
              style={{
                background:
                  msg.role === 'user'
                    ? 'linear-gradient(135deg, #00d4ff, #3b82f6)'
                    : 'var(--bg-secondary)',
                border:
                  msg.role === 'assistant'
                    ? '1px solid var(--border-subtle)'
                    : 'none',
                color: msg.role === 'user' ? '#0a0e14' : 'var(--text-primary)',
              }}
            >
              <p
                className="text-sm leading-relaxed"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {msg.content}
              </p>

              {msg.error && (
                <p
                  className="text-xs mt-2"
                  style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}
                >
                  {msg.error}
                </p>
              )}

              {/* SQL Query */}
              {msg.data?.sql && (
                <div
                  className="mt-3 rounded-lg p-3"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 size={12} style={{ color: 'var(--accent-cyan)' }} />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Consulta SQL
                    </span>
                  </div>
                  <pre
                    className="text-xs whitespace-pre-wrap break-all"
                    style={{
                      color: 'var(--accent-cyan)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {msg.data.sql}
                  </pre>
                </div>
              )}

              {/* Data table */}
              {msg.data?.dados && msg.data.dados.length > 0 && (
                <div
                  className="mt-3 rounded-lg overflow-hidden"
                  style={{
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="overflow-x-auto">
                    <table
                      className="w-full text-xs"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      <thead>
                        <tr style={{ background: 'var(--bg-tertiary)' }}>
                          {Object.keys(msg.data.dados[0]).map((key) => (
                            <th
                              key={key}
                              className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.data.dados.slice(0, 20).map((row, ri) => (
                          <tr
                            key={ri}
                            style={{
                              borderTop: '1px solid var(--border-subtle)',
                              background: 'var(--bg-primary)',
                            }}
                          >
                            {Object.values(row).map((val, ci) => (
                              <td
                                key={ci}
                                className="px-3 py-1.5 whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {String(val ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {msg.data.dados.length > 20 && (
                    <div
                      className="px-3 py-1.5 text-[10px]"
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Mostrando 20 de {msg.data.dados.length} resultados
                    </div>
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-1"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <User size={16} style={{ color: 'var(--text-secondary)' }} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #00d4ff20, #3b82f620)',
                border: '1px solid var(--border-medium)',
              }}
            >
              <BotMessageSquare size={16} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-2"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: 'var(--accent-cyan)' }}
              />
              <span
                className="text-sm"
                style={{
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Analisando...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 px-6 py-4 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Quantas sessoes CGNAT foram criadas na ultima hora?"
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-3 text-sm disabled:opacity-50"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center justify-center w-12 h-12 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, #00d4ff, #3b82f6)',
              color: '#0a0e14',
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
