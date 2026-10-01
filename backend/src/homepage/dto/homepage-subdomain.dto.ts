import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHomepageSubdomainDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(63)
  slug: string;
}

export class UpdateHomepageSubdomainDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(63)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
