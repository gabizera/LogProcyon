import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  tz_offset_hours: number;
  platform_name: string;
  retention_months: number;
}

const DEFAULT_CONFIG: AppConfig = {
  tz_offset_hours: -3,
  platform_name: 'LogProcyon',
  retention_months: 15,
};

export const MULTI_TENANT_MODE =
  (process.env.MULTI_TENANT_MODE || '').toLowerCase() === 'true';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private readonly filePath: string;
  private config: AppConfig = { ...DEFAULT_CONFIG };

  constructor() {
    const dataDir = process.env.DATA_DIR || '/data';
    this.filePath = path.join(dataDir, 'config.json');
  }

  onModuleInit() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
        this.logger.log('Config loaded from ' + this.filePath);
      } else {
        this.save();
        this.logger.log('Config file created with defaults');
      }
    } catch (e) {
      this.logger.warn('Could not load config, using defaults: ' + e.message);
    }
  }

  private save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
    } catch (e) {
      this.logger.error('Could not save config: ' + e.message);
    }
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<AppConfig>): AppConfig {
    this.config = { ...this.config, ...partial };
    this.save();
    return this.getConfig();
  }
}
