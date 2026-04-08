import { IsString, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  @IsIn(['admin', 'operator', 'viewer'])
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  @IsIn(['admin', 'operator', 'viewer'])
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;
}
