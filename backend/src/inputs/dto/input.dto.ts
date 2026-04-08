import { IsString, IsInt, IsBoolean, IsOptional, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInputDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['cisco', 'a10', 'nokia', 'hillstone', 'juniper', 'generic'])
  equipment_type: string;

  @IsString()
  @IsIn(['netflow_v9', 'ipfix', 'syslog_udp', 'syslog_tcp'])
  protocol_type: string;

  @IsOptional()
  @IsString()
  source_ip?: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateInputDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cisco', 'a10', 'nokia', 'hillstone', 'juniper', 'generic'])
  equipment_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['netflow_v9', 'ipfix', 'syslog_udp', 'syslog_tcp'])
  protocol_type?: string;

  @IsOptional()
  @IsString()
  source_ip?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
