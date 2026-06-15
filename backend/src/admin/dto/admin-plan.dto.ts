import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminCreatePlanDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  storageGb: number;

  @IsNumber()
  @Min(0)
  monthlyEmails: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminUpdatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  storageGb?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyEmails?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
