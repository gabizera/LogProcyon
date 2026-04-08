import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ClickhouseService } from '../clickhouse/clickhouse.service';
import { SearchLogsDto, StatsQueryDto, JudicialQueryDto } from './dto/search-logs.dto';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly clickhouse: ClickhouseService) {}

  async search(dto: SearchLogsDto) {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (dto.ip_publico) {
      conditions.push('ip_publico = {ip_publico:IPv4}');
      params.ip_publico = dto.ip_publico;
    }
    if (dto.ip_privado) {
      conditions.push('ip_privado = {ip_privado:IPv4}');
      params.ip_privado = dto.ip_privado;
    }
    if (dto.porta_publica !== undefined) {
      conditions.push('porta_publica = {porta_publica:UInt16}');
      params.porta_publica = dto.porta_publica;
    }
    if (dto.porta_privada !== undefined) {
      conditions.push('porta_privada = {porta_privada:UInt16}');
      params.porta_privada = dto.porta_privada;
    }
    if (dto.protocolo) {
      conditions.push('protocolo = {protocolo:String}');
      params.protocolo = dto.protocolo;
    }
    if (dto.tipo_nat) {
      conditions.push('tipo_nat = {tipo_nat:String}');
      params.tipo_nat = dto.tipo_nat;
    }
    if (dto.equipamento_origem) {
      conditions.push('equipamento_origem = {equipamento_origem:String}');
      params.equipamento_origem = dto.equipamento_origem;
    }
    if (dto.start_date) {
      conditions.push('timestamp >= {start_date:DateTime64(3)}');
      params.start_date = dto.start_date;
    }
    if (dto.end_date) {
      conditions.push('timestamp <= {end_date:DateTime64(3)}');
      params.end_date = dto.end_date;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = Math.max(dto.page ?? 1, 1);
    const limit = Math.min(Math.max(dto.limit ?? 50, 1), 1000);
    const offset = (page - 1) * limit;

    const countSql = `SELECT count() AS total FROM nat_logs ${where}`;
    const dataSql = `
      SELECT *
      FROM nat_logs
      ${where}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    params.limit = limit;
    params.offset = offset;

    const [countResult, data] = await Promise.all([
      this.clickhouse.query<{ total: number }>(countSql, params),
      this.clickhouse.query(dataSql, params),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async judicialSearch(dto: JudicialQueryDto) {
    // Busca o cliente que estava usando ip_publico:porta dentro do período informado
    // Para BPA: porta_publica <= porta < porta_publica + tamanho_bloco
    const sql = `
      SELECT
        toString(ip_privado)   AS ip_privado,
        toString(ip_publico)   AS ip_publico,
        porta_publica,
        tamanho_bloco,
        porta_publica + tamanho_bloco - 1 AS porta_fim,
        protocolo,
        tipo_nat,
        equipamento_origem,
        timestamp
      FROM nat_logs
      WHERE ip_publico = toIPv4({ip_publico:String})
        AND porta_publica <= {porta:UInt16}
        AND (porta_publica + tamanho_bloco) > {porta:UInt16}
        AND timestamp >= {ts_inicio:DateTime64(3)}
        AND timestamp <= {ts_fim:DateTime64(3)}
      ORDER BY timestamp DESC
      LIMIT 50
    `;

    const toClickhouseTs = (iso: string) =>
      new Date(iso).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);

    const rows = await this.clickhouse.query(sql, {
      ip_publico: dto.ip_publico,
      porta:      dto.porta,
      ts_inicio:  toClickhouseTs(dto.data_inicio),
      ts_fim:     toClickhouseTs(dto.data_fim),
    });

    return {
      consulta: {
        ip_publico:   dto.ip_publico,
        porta:        dto.porta,
        data_inicio:  dto.data_inicio,
        data_fim:     dto.data_fim,
      },
      resultados: rows,
      total: rows.length,
    };
  }

  async findById(id: string) {
    const rows = await this.clickhouse.query(
      'SELECT * FROM nat_logs WHERE id = {id:UUID} LIMIT 1',
      { id },
    );
    if (rows.length === 0) {
      throw new NotFoundException(`Log with id ${id} not found`);
    }
    return rows[0];
  }

  async getStats(dto: StatsQueryDto) {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (dto.start_date) {
      conditions.push('timestamp >= {start_date:DateTime64(3)}');
      params.start_date = dto.start_date;
    }
    if (dto.end_date) {
      conditions.push('timestamp <= {end_date:DateTime64(3)}');
      params.end_date = dto.end_date;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalSql = `SELECT count() AS total FROM nat_logs ${where}`;

    const todaySql = `
      SELECT count() AS total FROM nat_logs
      WHERE toDate(timestamp) = toDate(now() - INTERVAL 3 HOUR)
      ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
    `;

    const uniquePublicIpsSql = `SELECT uniq(ip_publico) AS total FROM nat_logs ${where}`;
    const uniquePrivateIpsSql = `SELECT uniq(ip_privado) AS total FROM nat_logs ${where}`;

    const volumeByHourSql = `
      SELECT
        toStartOfHour(timestamp) AS hour,
        count() AS count
      FROM nat_logs
      WHERE timestamp >= now() - INTERVAL 24 HOUR
      ${conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : ''}
      GROUP BY hour
      ORDER BY hour
    `;

    const topPublicIpsSql = `
      SELECT
        toString(ip_publico) AS ip,
        count() AS count
      FROM nat_logs
      ${where}
      GROUP BY ip_publico
      ORDER BY count DESC
      LIMIT 10
    `;

    const topPrivateIpsSql = `
      SELECT
        toString(ip_privado) AS ip,
        count() AS count
      FROM nat_logs
      ${where}
      GROUP BY ip_privado
      ORDER BY count DESC
      LIMIT 10
    `;

    const tipoNatDistSql = `
      SELECT
        tipo_nat,
        count() AS count
      FROM nat_logs
      ${where}
      GROUP BY tipo_nat
      ORDER BY count DESC
    `;

    const protocoloDistSql = `
      SELECT
        protocolo,
        count() AS count
      FROM nat_logs
      ${where}
      GROUP BY protocolo
      ORDER BY count DESC
    `;

    const equipamentoDistSql = `
      SELECT
        equipamento_origem,
        count() AS count
      FROM nat_logs
      ${where}
      GROUP BY equipamento_origem
      ORDER BY count DESC
      LIMIT 20
    `;

    const [total, today, uniquePublic, uniquePrivate, volumeByHour, topPublicIps, topPrivateIps, tipoNatDist, protocoloDist, equipamentoDist] =
      await Promise.all([
        this.clickhouse.query<{ total: number }>(totalSql, params),
        this.clickhouse.query<{ total: number }>(todaySql, params),
        this.clickhouse.query<{ total: number }>(uniquePublicIpsSql, params),
        this.clickhouse.query<{ total: number }>(uniquePrivateIpsSql, params),
        this.clickhouse.query(volumeByHourSql, params),
        this.clickhouse.query(topPublicIpsSql, params),
        this.clickhouse.query(topPrivateIpsSql, params),
        this.clickhouse.query(tipoNatDistSql, params),
        this.clickhouse.query(protocoloDistSql, params),
        this.clickhouse.query(equipamentoDistSql, params),
      ]);

    return {
      total: total[0]?.total ?? 0,
      today: today[0]?.total ?? 0,
      unique_public_ips: uniquePublic[0]?.total ?? 0,
      unique_private_ips: uniquePrivate[0]?.total ?? 0,
      volume_by_hour: volumeByHour,
      top_public_ips: topPublicIps,
      top_private_ips: topPrivateIps,
      tipo_nat_distribution: tipoNatDist,
      protocolo_distribution: protocoloDist,
      equipamento_distribution: equipamentoDist,
    };
  }
}
