import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ClickhouseService } from '../clickhouse/clickhouse.service';
import { SearchLogsDto, StatsQueryDto, JudicialQueryDto } from './dto/search-logs.dto';
import { InputsService } from '../inputs/inputs.service';
import { MULTI_TENANT_MODE } from '../config/config.service';

export interface JwtUser {
  sub: string;
  role: string;
  allowed_instances?: string[];
}

/**
 * Normalize any ISO-ish date string to ClickHouse DateTime64(3) literal:
 * "2026-04-14 11:50:00.000". Accepts "2026-04-14T11:50" (datetime-local),
 * full ISO "2026-04-14T11:50:00.000Z", and plain dates.
 */
function toClickhouseTs(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // let ClickHouse raise if truly invalid
  return d.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    private readonly clickhouse: ClickhouseService,
    private readonly inputsService: InputsService,
  ) {}

  /**
   * Returns the list of instance names (equipamento_origem) the user can access,
   * or null if no filter should be applied (admin, single-tenant mode, or no restriction).
   * Throws ForbiddenException when the user has no accessible instances.
   */
  private resolveTenantNames(user?: JwtUser): string[] | null {
    if (!MULTI_TENANT_MODE) return null;
    if (!user || user.role === 'admin') return null;
    const allowed = user.allowed_instances ?? [];
    if (allowed.length === 0) throw new ForbiddenException('Usuário sem instances permitidas');
    const names = this.inputsService
      .findAll()
      .filter(i => allowed.includes(i.id))
      .map(i => i.name);
    if (names.length === 0) throw new ForbiddenException('Usuário sem instances permitidas');
    return names;
  }

  async search(dto: SearchLogsDto, user?: JwtUser) {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    const tenantNames = this.resolveTenantNames(user);
    if (tenantNames) {
      conditions.push('equipamento_origem IN {tenant_names:Array(String)}');
      params.tenant_names = tenantNames;
    }

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
      params.start_date = toClickhouseTs(dto.start_date);
    }
    if (dto.end_date) {
      conditions.push('timestamp <= {end_date:DateTime64(3)}');
      params.end_date = toClickhouseTs(dto.end_date);
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

  async judicialSearch(dto: JudicialQueryDto, user?: JwtUser) {
    const tenantNames = this.resolveTenantNames(user);
    const tenantClause = tenantNames
      ? 'AND src.equipamento_origem IN {tenant_names:Array(String)}'
      : '';

    // Busca o cliente que estava usando ip_publico:porta dentro do período informado
    // Para BPA: porta_publica <= porta < porta_publica + tamanho_bloco
    const sql = `
      SELECT
        toString(src.ip_privado)   AS ip_privado,
        toString(src.ip_publico)   AS ip_publico,
        src.porta_publica,
        src.tamanho_bloco,
        src.porta_publica + src.tamanho_bloco - 1 AS porta_fim,
        src.protocolo,
        src.tipo_nat,
        src.equipamento_origem,
        src.timestamp
      FROM nat_logs AS src
      WHERE src.ip_publico = {ip_publico:IPv4}
        AND src.porta_publica <= {porta:UInt16}
        AND (src.porta_publica + src.tamanho_bloco) > {porta:UInt16}
        AND src.timestamp >= {ts_inicio:DateTime64(3)}
        AND src.timestamp <= {ts_fim:DateTime64(3)}
        ${tenantClause}
      ORDER BY src.timestamp DESC
      LIMIT 50
    `;

    const params: Record<string, unknown> = {
      ip_publico: dto.ip_publico,
      porta:      dto.porta,
      ts_inicio:  toClickhouseTs(dto.data_inicio),
      ts_fim:     toClickhouseTs(dto.data_fim),
    };
    if (tenantNames) params.tenant_names = tenantNames;

    const rows = await this.clickhouse.query(sql, params);

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

  async getStorage(user?: JwtUser) {
    const tenantNames = this.resolveTenantNames(user);
    const whereTenant = tenantNames
      ? 'WHERE equipamento_origem IN {tenant_names:Array(String)}'
      : '';
    const paramsTenant: Record<string, unknown> = tenantNames ? { tenant_names: tenantNames } : {};

    // Logs por dia com estimativa de tamanho
    const dailySql = `
      SELECT
        toDate(timestamp) AS dia,
        count() AS total,
        sum(length(payload_raw)) AS payload_bytes
      FROM nat_logs
      ${whereTenant}
      GROUP BY dia
      ORDER BY dia DESC
      LIMIT 90
    `;

    // Tamanho total em disco (comprimido) via system.parts
    const diskSql = `
      SELECT
        sum(data_compressed_bytes) AS compressed,
        sum(data_uncompressed_bytes) AS uncompressed,
        sum(rows) AS rows
      FROM system.parts
      WHERE table = 'nat_logs' AND active = 1
    `;

    // system.parts não tem dado por equipamento; para tenants, estimamos bytes pelo payload_raw
    const [daily, disk] = await Promise.all([
      this.clickhouse.query(dailySql, paramsTenant),
      tenantNames
        ? Promise.resolve([{ compressed: 0, uncompressed: 0, rows: 0 }])
        : this.clickhouse.query<{ compressed: number; uncompressed: number; rows: number }>(diskSql, {}),
    ]);

    return {
      daily,
      disk: {
        compressed_bytes:   Number(disk[0]?.compressed ?? 0),
        uncompressed_bytes: Number(disk[0]?.uncompressed ?? 0),
        total_rows:         Number(disk[0]?.rows ?? 0),
      },
    };
  }

  async getStats(dto: StatsQueryDto, user?: JwtUser) {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    const tenantNames = this.resolveTenantNames(user);
    if (tenantNames) {
      conditions.push('equipamento_origem IN {tenant_names:Array(String)}');
      params.tenant_names = tenantNames;
    } else if (dto.equipamento_origem) {
      // Optional explicit filter (dashboard dropdown) — admins / single-tenant only
      conditions.push('equipamento_origem = {equipamento_origem:String}');
      params.equipamento_origem = dto.equipamento_origem;
    }
    // When user is tenant-scoped but also picks a dropdown value, intersect
    if (tenantNames && dto.equipamento_origem && tenantNames.includes(dto.equipamento_origem)) {
      conditions.push('equipamento_origem = {equipamento_origem:String}');
      params.equipamento_origem = dto.equipamento_origem;
    }

    if (dto.start_date) {
      conditions.push('timestamp >= {start_date:DateTime64(3)}');
      params.start_date = toClickhouseTs(dto.start_date);
    }
    if (dto.end_date) {
      conditions.push('timestamp <= {end_date:DateTime64(3)}');
      params.end_date = toClickhouseTs(dto.end_date);
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
        count() AS count,
        groupUniqArray(equipamento_origem) AS sources
      FROM nat_logs
      ${where}
      GROUP BY ip_publico
      ORDER BY count DESC
      LIMIT 10
    `;

    const topPrivateIpsSql = `
      SELECT
        toString(ip_privado) AS ip,
        count() AS count,
        groupUniqArray(equipamento_origem) AS sources
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
