import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { createClient, ClickHouseClient } from '@clickhouse/client';

@Injectable()
export class ClickhouseService implements OnModuleDestroy {
  private readonly logger = new Logger(ClickhouseService.name);
  private readonly client: ClickHouseClient;

  constructor() {
    const url = process.env.CLICKHOUSE_URL || 'http://clickhouse:8123';
    this.client = createClient({
      url,
      request_timeout: 30_000,
      clickhouse_settings: {
        output_format_json_quote_64bit_integers: 0,
      },
    });
    this.logger.log(`ClickHouse client configured for ${url}`);
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
