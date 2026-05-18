import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException, BadRequestException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CreateInputDto, UpdateInputDto } from './dto/input.dto';
import { MULTI_TENANT_MODE } from '../config/config.service';
import { ClickhouseService } from '../clickhouse/clickhouse.service';

interface JwtUser {
  sub: string;
  role: string;
  allowed_instances?: string[];
}

export interface Input {
  id: string;
  name: string;
  equipment_type: string;
  protocol_type: string;
  source_ip: string;
  port: number;
  description: string;
  enabled: boolean;
  created_at: string;
  archived_at?: string | null;
}

// Range de portas UDP dedicadas: cada cliente recebe uma porta única.
// A porta isola o tenant de forma determinística (não depende de
// source_ip, que é spoofável em UDP). Configurável via env.
const PORT_MIN = parseInt(process.env.INPUT_PORT_MIN || '20000', 10);
const PORT_MAX = parseInt(process.env.INPUT_PORT_MAX || '20199', 10);

@Injectable()
export class InputsService implements OnModuleInit {
  private readonly logger = new Logger(InputsService.name);
  private readonly filePath: string;
  private inputs: Input[] = [];

  constructor(private readonly clickhouse: ClickhouseService) {
    const dataDir = process.env.DATA_DIR || '/data';
    this.filePath = path.join(dataDir, 'inputs.json');
  }

  onModuleInit() {
    this.load();
    if (!fs.existsSync(this.filePath)) {
      this.inputs = [];
      this.save();
      this.logger.log('Created empty inputs.json — configure inputs via Web UI');
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.inputs = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.logger.log(`Loaded ${this.inputs.length} inputs`);
      }
    } catch (e) {
      this.logger.warn('Could not load inputs: ' + e.message);
    }
  }

  private save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.inputs, null, 2), { mode: 0o600 });
    } catch (e) {
      this.logger.error('Could not save inputs: ' + e.message);
    }
  }

  findAll(): Input[] {
    return this.inputs;
  }

  /** Apenas não-arquivados — base pro Dashboard, Logs, Stats. */
  findAllActive(): Input[] {
    return this.inputs.filter(i => !i.archived_at);
  }

  findAllForUser(user?: JwtUser): Input[] {
    if (!MULTI_TENANT_MODE || !user || user.role === 'admin') return this.inputs;
    const allowed = user.allowed_instances ?? [];
    return this.inputs.filter(i => allowed.includes(i.id));
  }

  findOne(id: string, user?: JwtUser): Input {
    const input = this.inputs.find(i => i.id === id);
    if (!input) throw new NotFoundException(`Input ${id} not found`);
    if (MULTI_TENANT_MODE && user && user.role !== 'admin') {
      const allowed = user.allowed_instances ?? [];
      if (!allowed.includes(input.id)) {
        throw new ForbiddenException('Sem acesso a esta instance');
      }
    }
    return input;
  }

  /**
   * Portas em uso por QUALQUER input (inclusive arquivado) — um input
   * arquivado pode ser restaurado, então sua porta não pode ser reusada
   * enquanto o registro existir. Só libera no purge.
   */
  private portsInUse(exceptId?: string): Set<number> {
    return new Set(
      this.inputs.filter(i => i.id !== exceptId).map(i => i.port),
    );
  }

  /** Aloca a menor porta livre dentro do range dedicado. */
  private allocatePort(): number {
    const used = this.portsInUse();
    for (let p = PORT_MIN; p <= PORT_MAX; p++) {
      if (!used.has(p)) return p;
    }
    throw new ConflictException(
      `Range de portas esgotado (${PORT_MIN}-${PORT_MAX}). Faça purge de inputs arquivados ou amplie INPUT_PORT_MAX.`,
    );
  }

  private resolvePort(requested: number | undefined, exceptId?: string): number {
    if (requested == null) return this.allocatePort();
    if (requested < PORT_MIN || requested > PORT_MAX) {
      throw new BadRequestException(
        `Porta ${requested} fora do range dedicado (${PORT_MIN}-${PORT_MAX})`,
      );
    }
    if (this.portsInUse(exceptId).has(requested)) {
      throw new ConflictException(`Porta ${requested} já está em uso por outro input`);
    }
    return requested;
  }

  private assertNameFree(name: string, exceptId?: string): void {
    const clash = this.inputs.some(
      i => i.id !== exceptId && !i.archived_at && i.name === name,
    );
    if (clash) throw new ConflictException(`Já existe um input ativo com o nome "${name}"`);
  }

  create(dto: CreateInputDto): Input {
    this.assertNameFree(dto.name);
    const port = this.resolvePort(dto.port);
    const input: Input = {
      id: crypto.randomUUID(),
      name: dto.name,
      equipment_type: dto.equipment_type,
      protocol_type: dto.protocol_type,
      source_ip: dto.source_ip ?? '',
      port,
      description: dto.description ?? '',
      enabled: dto.enabled ?? true,
      created_at: new Date().toISOString(),
    };
    this.inputs.push(input);
    this.save();
    this.logger.log(`Input "${input.name}" criado na porta dedicada ${port}`);
    return input;
  }

  async update(id: string, dto: UpdateInputDto): Promise<Input> {
    const idx = this.inputs.findIndex(i => i.id === id);
    if (idx === -1) throw new NotFoundException(`Input ${id} not found`);
    const oldName = this.inputs[idx].name;
    if (dto.name && dto.name !== oldName) this.assertNameFree(dto.name, id);
    if (dto.port != null && dto.port !== this.inputs[idx].port) {
      dto.port = this.resolvePort(dto.port, id);
    }
    this.inputs[idx] = { ...this.inputs[idx], ...dto };
    this.save();

    // Se o nome mudou, propaga pra todos os nat_logs históricos daquele
    // equipamento. A mutation roda assíncrona no ClickHouse — não bloqueia
    // a resposta mesmo em tabelas grandes.
    const newName = this.inputs[idx].name;
    if (dto.name && newName !== oldName) {
      try {
        await this.clickhouse.command(
          `ALTER TABLE nat_logs UPDATE equipamento_origem = {new:String} WHERE equipamento_origem = {old:String}`,
          { new: newName, old: oldName },
        );
        this.logger.log(`Renamed nat_logs rows: "${oldName}" → "${newName}"`);
      } catch (e) {
        this.logger.error(`Falha ao renomear nat_logs: ${(e as Error).message}`);
      }
    }
    return this.inputs[idx];
  }

  /**
   * Soft delete — marca como arquivado. Mantém row em nat_logs intacto
   * pra consulta judicial. Dashboard/Logs/Stats passam a filtrar. O
   * firewall nft é re-sincronizado automaticamente pelo path unit
   * porque inputs.json é reescrito.
   */
  archive(id: string): Input {
    const idx = this.inputs.findIndex(i => i.id === id);
    if (idx === -1) throw new NotFoundException(`Input ${id} not found`);
    this.inputs[idx].archived_at = new Date().toISOString();
    this.inputs[idx].enabled = false;
    this.save();
    return this.inputs[idx];
  }

  /** Restaura um input arquivado — readiciona ao Dashboard e firewall. */
  restore(id: string): Input {
    const idx = this.inputs.findIndex(i => i.id === id);
    if (idx === -1) throw new NotFoundException(`Input ${id} not found`);
    this.inputs[idx].archived_at = null;
    this.inputs[idx].enabled = true;
    this.save();
    return this.inputs[idx];
  }

  /**
   * Remoção permanente — apaga o Input do JSON. Usa só quando o
   * operator quer limpar definitivamente depois de já ter arquivado
   * e baixado o backup. NÃO limpa nat_logs.
   */
  remove(id: string): void {
    const idx = this.inputs.findIndex(i => i.id === id);
    if (idx === -1) throw new NotFoundException(`Input ${id} not found`);
    this.inputs.splice(idx, 1);
    this.save();
  }
}
