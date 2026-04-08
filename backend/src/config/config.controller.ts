import { Controller, Get, Put, Body } from '@nestjs/common';
import { ConfigService } from './config.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-12)
  @Max(14)
  tz_offset_hours?: number;

  @IsOptional()
  @IsString()
  platform_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(60)
  retention_months?: number;
}

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getConfig() {
    return this.configService.getConfig();
  }

  @Public()
  @Get('public')
  getPublicConfig() {
    const config = this.configService.getConfig();
    return { platform_name: config.platform_name };
  }

  @Put()
  @Roles('admin')
  updateConfig(@Body() dto: UpdateConfigDto) {
    return this.configService.updateConfig(dto);
  }
}
