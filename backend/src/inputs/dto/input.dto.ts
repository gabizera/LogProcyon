import { IsString, IsInt, IsBoolean, IsOptional, Min, Max, IsIn, IsIP } from 'class-validator';
import { Type, Transform } from 'class-transformer';

const trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class CreateInputDto {
  @trim()
  @IsString()
  name: string;

  @IsString()
  @IsIn(['cisco', 'a10', 'nokia', 'hillstone', 'juniper', 'generic'])
  equipment_type: string;

  @IsString()
  @IsIn(['netflow_v9', 'ipfix', 'syslog_udp', 'syslog_tcp'])
  protocol_type: string;

  // 2ª camada de isolamento — a porta dedicada já isola o cliente.
  // Quando definido, o collector só aceita pacotes deste IP nesta porta.
  @IsOptional()
  @trim()
  @IsIP('4')
  source_ip?: string;

  // Opcional: omitir deixa o backend alocar a próxima porta livre do
  // range dedicado. Se informado, precisa estar dentro do range e livre.
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @trim()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateInputDto {
  @IsOptional()
  @trim()
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
  @trim()
  @IsIP('4')
  source_ip?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @trim()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
