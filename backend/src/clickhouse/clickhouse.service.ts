import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { createClient, ClickHouseClient } from '@clickhouse/client';

@Injectable()
export class ClickhouseService implements OnModuleDestroy {
  private readonly logger = new Logger(ClickhouseService.name);
  private readonly client: ClickHouseClient;

  constructor() {
    const url = process.env.CLICKHOUSE_URL || 'http://clickhouse:8123';
    const username = process.env.CLICKHOUSE_USER || 'default';
    const password = process.env.CLICKHOUSE_PASSWORD || '';
    this.client = createClient({
      url,
      username,
      password,
      request_timeout: 30_000,
      clickhouse_settings: {
        output_format_json_quote_64bit_integers: 0,
      },
    });
    // Não loga password nem URL completa — só host e user
    const host = url.replace(/^https?:\/\//, '').split('/')[0];
    this.logger.log(`ClickHouse client → ${host} (user=${username})`);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: Record<string, unknown>,
  ): Promise<T[]> {
    const result = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json<T>();
  }

  async command(sql: string, params?: Record<string, unknown>): Promise<void> {
    await this.client.command({ query: sql, query_params: params });
  }

  async insert(table: string, values: Record<string, unknown>[]): Promise<void> {
    if (values.length === 0) return;
    await this.client.insert({
      table,
      values,
      format: 'JSONEachRow',
    });
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result.success;
    } catch (error) {
      this.logger.error('ClickHouse ping failed', error);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.client.close();
  }
}
