import { Injectable, Logger, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
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
}

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

  create(dto: CreateInputDto): Input {
    const input: Input = {
      id: crypto.randomUUID(),
      name: dto.name,
      equipment_type: dto.equipment_type,
      protocol_type: dto.protocol_type,
      source_ip: dto.source_ip ?? '',
      port: dto.port,
      description: dto.description ?? '',
      enabled: dto.enabled ?? true,
      created_at: new Date().toISOString(),
    };
    this.inputs.push(input);
    this.save();
    return input;
  }

  async update(id: string, dto: UpdateInputDto): Promise<Input> {
    const idx = this.inputs.findIndex(i => i.id === id);
    if (idx === -1) throw new NotFoundException(`Input ${id} not found`);
    const oldName = this.inputs[idx].name;
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

  remove(id: string): void {
    const idx = this.inputs.findIndex(i => i.id === id);
    if (idx === -1) throw new NotFoundException(`Input ${id} not found`);
    this.inputs.splice(idx, 1);
    this.save();
  }
}
