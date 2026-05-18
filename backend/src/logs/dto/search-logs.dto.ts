import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

@ValidatorConstraint({ name: 'isAfterStart', async: false })
class IsAfterStart implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const obj = args.object as { data_inicio?: string };
    if (!obj.data_inicio || !value) return true;
    return new Date(value).getTime() > new Date(obj.data_inicio).getTime();
  }
  defaultMessage() {
    return 'data_fim deve ser posterior a data_inicio';
  }
}

export class SearchLogsDto {
  @IsOptional()
  @trim()
  @IsString()
  ip_publico?: string;

  @IsOptional()
  @trim()
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
  @trim()
  @IsString()
  protocolo?: string;

  @IsOptional()
  @trim()
  @IsString()
  tipo_nat?: string;

  @IsOptional()
  @trim()
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
  @trim()
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
  @Validate(IsAfterStart)
  data_fim: string;

  @IsOptional()
  @trim()
  @IsString()
  equipamento_origem?: string;
}

export class StatsQueryDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @trim()
  @IsString()
  equipamento_origem?: string;
}
