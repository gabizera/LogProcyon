import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.validateCredentials(username, password);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      allowed_instances: user.allowed_instances ?? [],
    };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async getProfile(userId: string) {
    return this.usersService.findOne(userId);
  }
}
