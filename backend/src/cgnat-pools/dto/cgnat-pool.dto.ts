import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

const trim = () => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class CreateCgnatPoolDto {
  @trim()
  @IsString()
  equipamento_origem: string;

  @trim()
  @IsString()
  private_pool_start: string;

  @trim()
  @IsString()
  public_pool_cidr: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  first_port: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  ports_per_client: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1024)
  chains_count: number;

  @IsOptional()
  @trim()
  @IsString()
  description?: string;
}

export class UpdateCgnatPoolDto {
  @IsOptional() @trim() @IsString() equipamento_origem?: string;
  @IsOptional() @trim() @IsString() private_pool_start?: string;
  @IsOptional() @trim() @IsString() public_pool_cidr?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) first_port?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) ports_per_client?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1024) chains_count?: number;
  @IsOptional() @trim() @IsString() description?: string;
}

export class LookupCgnatDto {
  @trim()
  @IsString()
  equipamento_origem: string;

  @trim()
  @IsString()
  ip_publico: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  porta: number;
}
