import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CreateCgnatPoolDto, UpdateCgnatPoolDto } from './dto/cgnat-pool.dto';

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

export interface CgnatLookupResult {
  ip_privado: string;
  ip_publico: string;
  porta: number;
  porta_min: number;
  porta_max: number;
  chain_index: number;
  equipamento_origem: string;
  source: 'static_pool';
}

function ipToInt(ip: string): number {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) throw new BadRequestException(`IP inválido: ${ip}`);
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) throw new BadRequestException(`IP inválido: ${ip}`);
    n = n * 256 + v;
  }
  return n >>> 0;
}

function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
}

function parseCidr(cidr: string): { network: number; size: number } {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new BadRequestException(`CIDR inválido: ${cidr}`);
  }
  const ipInt = ipToInt(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipInt & mask) >>> 0;
  const size = 2 ** (32 - prefix);
  return { network, size };
}

@Injectable()
export class CgnatPoolsService implements OnModuleInit {
  private readonly logger = new Logger(CgnatPoolsService.name);
  private readonly filePath: string;
  private pools: CgnatPool[] = [];

  constructor() {
    const dataDir = process.env.DATA_DIR || '/data';
    this.filePath = path.join(dataDir, 'cgnat-pools.json');
  }

  onModuleInit() {
    this.load();
    if (!fs.existsSync(this.filePath)) {
      this.pools = [];
      this.save();
      this.logger.log('Created empty cgnat-pools.json');
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.pools = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.logger.log(`Loaded ${this.pools.length} cgnat pools`);
      }
    } catch (e) {
      this.logger.warn('Could not load cgnat pools: ' + e.message);
    }
  }

  private save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.pools, null, 2), { mode: 0o600 });
    } catch (e) {
      this.logger.error('Could not save cgnat pools: ' + e.message);
    }
  }

  findAll(): CgnatPool[] {
    return this.pools;
  }

  findByEquipamento(equipamento: string): CgnatPool | undefined {
    return this.pools.find(p => p.equipamento_origem === equipamento);
  }

  create(dto: CreateCgnatPoolDto): CgnatPool {
    // Validate shape eagerly
    parseCidr(dto.public_pool_cidr);
    ipToInt(dto.private_pool_start);

    const pool: CgnatPool = {
      id: crypto.randomUUID(),
      equipamento_origem: dto.equipamento_origem,
      private_pool_start: dto.private_pool_start,
      public_pool_cidr: dto.public_pool_cidr,
      first_port: dto.first_port,
      ports_per_client: dto.ports_per_client,
      chains_count: dto.chains_count,
      description: dto.description ?? '',
      created_at: new Date().toISOString(),
    };
    // Uma alocação por equipamento — sobrescreve a anterior se já existir
    this.pools = this.pools.filter(p => p.equipamento_origem !== pool.equipamento_origem);
    this.pools.push(pool);
    this.save();
    return pool;
  }

  update(id: string, dto: UpdateCgnatPoolDto): CgnatPool {
    const idx = this.pools.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException(`Pool ${id} não encontrado`);
    const merged = { ...this.pools[idx], ...dto };
    if (dto.public_pool_cidr) parseCidr(dto.public_pool_cidr);
    if (dto.private_pool_start) ipToInt(dto.private_pool_start);
    this.pools[idx] = merged;
    this.save();
    return merged;
  }

  remove(id: string): void {
    const idx = this.pools.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException(`Pool ${id} não encontrado`);
    this.pools.splice(idx, 1);
    this.save();
  }

  /**
   * Reverse-computes the private IP for a given public IP + port,
   * using the Remontti netmap pattern:
   *
   *  chain_index = floor((porta - first_port) / ports_per_client)
   *  chain_private_block_start = private_pool_start + chain_index * public_pool_size
   *  public_offset = ip_publico - public_pool_network
   *  ip_privado = chain_private_block_start + public_offset
   *
   * Validates that porta is inside the chain's port window and that the
   * public IP falls inside the configured pool.
   */
  lookup(equipamento: string, ipPublicoStr: string, porta: number): CgnatLookupResult {
    const pool = this.findByEquipamento(equipamento);
    if (!pool) {
      throw new NotFoundException(`Nenhum pool CGNAT cadastrado para "${equipamento}"`);
    }

    const { network: publicNetwork, size: publicSize } = parseCidr(pool.public_pool_cidr);
    const privateStart = ipToInt(pool.private_pool_start);
    const ipPublico = ipToInt(ipPublicoStr);

    if (ipPublico < publicNetwork || ipPublico >= publicNetwork + publicSize) {
      throw new BadRequestException(
        `IP ${ipPublicoStr} fora do pool público ${pool.public_pool_cidr}`,
      );
    }

    if (porta < pool.first_port) {
      throw new BadRequestException(
        `Porta ${porta} abaixo da primeira porta configurada (${pool.first_port})`,
      );
    }

    const chainIndex = Math.floor((porta - pool.first_port) / pool.ports_per_client);
    if (chainIndex >= pool.chains_count) {
      throw new BadRequestException(
        `Porta ${porta} fora das ${pool.chains_count} chains configuradas`,
      );
    }

    const portaMin = pool.first_port + chainIndex * pool.ports_per_client;
    const portaMax = portaMin + pool.ports_per_client - 1;

    const chainBlockStart = privateStart + chainIndex * publicSize;
    const publicOffset = ipPublico - publicNetwork;
    const ipPrivado = chainBlockStart + publicOffset;

    return {
      ip_privado: intToIp(ipPrivado),
      ip_publico: ipPublicoStr,
      porta,
      porta_min: portaMin,
      porta_max: portaMax,
      chain_index: chainIndex,
      equipamento_origem: equipamento,
      source: 'static_pool',
    };
  }
}
