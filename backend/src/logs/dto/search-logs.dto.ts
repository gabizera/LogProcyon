import { IsOptional, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchLogsDto {
  @IsOptional()
  @IsString()
  ip_publico?: string;

  @IsOptional()
  @IsString()
  ip_privado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  porta_publica?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  porta_privada?: number;

  @IsOptional()
  @IsString()
  protocolo?: string;

  @IsOptional()
  @IsString()
  tipo_nat?: string;

  @IsOptional()
  @IsString()
  equipamento_origem?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 50;
}

export class JudicialQueryDto {
  @IsString()
  ip_publico: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  porta: number;

  @IsDateString()
  data_inicio: string;

  @IsDateString()
  data_fim: string;
}

export class StatsQueryDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  equipamento_origem?: string;
}
