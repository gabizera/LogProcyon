import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ClickhouseService } from '../clickhouse/clickhouse.service';

const SYSTEM_PROMPT = `Voce e um assistente especializado em analise de logs NAT/CGNAT/BPA armazenados em ClickHouse.

A tabela que voce deve consultar se chama nat_logs e tem o seguinte schema:

- id UUID — identificador unico do registro
- timestamp DateTime64(3) — momento em que o evento NAT ocorreu (milissegundos)
- ip_publico IPv4 — endereco IP publico (lado externo do NAT)
- ip_privado IPv4 — endereco IP privado (lado interno do NAT, do assinante)
- porta_publica UInt16 — porta no lado publico
- porta_privada UInt16 — porta no lado privado
- protocolo LowCardinality(String) — protocolo de transporte: 'TCP' ou 'UDP'
- tipo_nat LowCardinality(String) — tipo de traducao: 'estatico' (NAT estatico 1:1), 'cgnat' (Carrier-Grade NAT, muitos assinantes compartilham um IP publico), 'bpa' (Bulk Port Allocation, alocacao de blocos de portas)
- equipamento_origem LowCardinality(String) — hostname ou identificador do equipamento (roteador/BNG) que gerou o log
- payload_raw String — linha bruta original do log (syslog)
- inserted_at DateTime — momento em que o registro foi inserido no ClickHouse

Regras:
1. Gere APENAS uma query SELECT. Nunca gere INSERT, UPDATE, DELETE, DROP, ALTER ou qualquer comando que modifique dados.
2. Use a sintaxe do ClickHouse.
3. Limite resultados a no maximo 100 linhas a menos que o usuario peca mais.
4. Retorne SOMENTE a query SQL pura, sem explicacao, sem markdown, sem crases.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;

  constructor(private readonly clickhouse: ClickhouseService) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async analyze(prompt: string) {
    if (!prompt || prompt.trim().length === 0) {
      throw new BadRequestException('Prompt is required');
    }

    // Step 1: Ask Claude to generate a SQL query
    const sqlResponse = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const sqlText =
      sqlResponse.content[0].type === 'text'
        ? sqlResponse.content[0].text.trim()
        : '';

    if (!sqlText) {
      throw new BadRequestException('Failed to generate SQL query');
    }

    // Safety check: only allow SELECT
    const normalized = sqlText.toUpperCase().replace(/\s+/g, ' ').trim();
    if (
      !normalized.startsWith('SELECT') ||
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|RENAME|ATTACH|DETACH|OPTIMIZE)\b/.test(
        normalized,
      )
    ) {
      throw new BadRequestException(
        'Generated query is not a safe SELECT statement',
      );
    }

    // Step 2: Execute the query
    let queryResult: Record<string, unknown>[];
    try {
      queryResult = await this.clickhouse.query(sqlText);
    } catch (error) {
      this.logger.error('Query execution failed', error);
      return {
        sql: sqlText,
        error: `Query execution failed: ${error.message}`,
        interpretation: null,
      };
    }

    // Step 3: Ask Claude to interpret the results
    const interpretResponse = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system:
        'Voce e um assistente que interpreta resultados de queries em logs NAT/CGNAT/BPA. Responda de forma clara e objetiva em portugues. Se os resultados estiverem vazios, diga que nenhum registro foi encontrado.',
      messages: [
        {
          role: 'user',
          content: `Pergunta original do usuario: ${prompt}\n\nQuery executada:\n${sqlText}\n\nResultados (JSON):\n${JSON.stringify(queryResult, null, 2)}`,
        },
      ],
    });

    const interpretation =
      interpretResponse.content[0].type === 'text'
        ? interpretResponse.content[0].text
        : '';

    return {
      sql: sqlText,
      results: queryResult,
      interpretation,
    };
  }
}
