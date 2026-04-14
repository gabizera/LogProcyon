import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCgnatPoolDto {
  @IsString()
  equipamento_origem: string;

  @IsString()
  private_pool_start: string;

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
  @IsString()
  description?: string;
}

export class UpdateCgnatPoolDto {
  @IsOptional() @IsString() equipamento_origem?: string;
  @IsOptional() @IsString() private_pool_start?: string;
  @IsOptional() @IsString() public_pool_cidr?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) first_port?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) ports_per_client?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1024) chains_count?: number;
  @IsOptional() @IsString() description?: string;
}

export class LookupCgnatDto {
  @IsString()
  equipamento_origem: string;

  @IsString()
  ip_publico: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  porta: number;
}
