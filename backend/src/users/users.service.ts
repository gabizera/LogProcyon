import { Injectable, Logger, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  created_at: string;
  password_hash?: string;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);
  private readonly filePath: string;
  private users: User[] = [];

  constructor() {
    const dataDir = process.env.DATA_DIR || '/data';
    this.filePath = path.join(dataDir, 'users.json');
  }

  onModuleInit() {
    this.load();
    if (this.users.length === 0) {
      this.seed();
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.users = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.logger.log(`Loaded ${this.users.length} users`);
      }
    } catch (e) {
      this.logger.warn('Could not load users: ' + e.message);
    }
  }

  private save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.users, null, 2), { mode: 0o600 });
    } catch (e) {
      this.logger.error('Could not save users: ' + e.message);
    }
  }

  private async seed() {
    const hash = await bcrypt.hash('admin123', 10);
    const admin: User = {
      id: crypto.randomUUID(),
      username: 'admin',
      name: 'Administrator',
      role: 'admin',
      created_at: new Date().toISOString(),
      password_hash: hash,
    };
    this.users = [admin];
    this.save();
    this.logger.log('Seeded default admin user');
  }

  private sanitize(user: User): Omit<User, 'password_hash'> {
    const { password_hash: _, ...safe } = user;
    return safe;
  }

  findAll() {
    return this.users.map(u => this.sanitize(u));
  }

  findOne(id: string) {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.sanitize(user);
  }

  async create(dto: CreateUserDto) {
    if (this.users.find(u => u.username === dto.username)) {
      throw new ConflictException(`Username '${dto.username}' already exists`);
    }
    const hash = await bcrypt.hash(dto.password, 10);
    const user: User = {
      id: crypto.randomUUID(),
      username: dto.username,
      name: dto.name ?? dto.username,
      role: dto.role ?? 'operator',
      created_at: new Date().toISOString(),
      password_hash: hash,
    };
    this.users.push(user);
    this.save();
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) throw new NotFoundException(`User ${id} not found`);
    if (dto.password) {
      (this.users[idx] as User).password_hash = await bcrypt.hash(dto.password, 10);
    }
    const { password: _, ...rest } = dto;
    this.users[idx] = { ...this.users[idx], ...rest };
    this.save();
    return this.sanitize(this.users[idx]);
  }

  async validateCredentials(username: string, password: string): Promise<Omit<User, 'password_hash'> | null> {
    const user = this.users.find(u => u.username === username);
    if (!user?.password_hash) return null;
    const valid = await bcrypt.compare(password, user.password_hash);
    return valid ? this.sanitize(user) : null;
  }

  remove(id: string): void {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) throw new NotFoundException(`User ${id} not found`);
    this.users.splice(idx, 1);
    this.save();
  }
}
