import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminCreatePlanDto {
  @IsOptional() @IsIn(['client-gallery','studio-manager']) productType?:'client-gallery'|'studio-manager';
  @IsOptional() @IsInt() @Min(0) studioContactLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioProjectLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioProductLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioQuestionnaireLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioQuoteLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioMonthlyEmails?:number;
  @IsString()
  @MaxLength(100)
  name: string;

  @IsNumber()
  @Min(0)
  storageGb: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  galleryLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subdomainLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aiImageMetadataLimit?: number;

  @IsNumber()
  @Min(0)
  monthlyEmails: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  videoMinutes?: number;

  @IsOptional()
  @IsIn(['hd', '4k'])
  videoQuality?: 'hd' | '4k';

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsBoolean()
  yearlyEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceYearly?: number;

  @IsOptional()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  recommended?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminUpdatePlanDto {
  @IsOptional() @IsIn(['client-gallery','studio-manager']) productType?:'client-gallery'|'studio-manager';
  @IsOptional() @IsInt() @Min(0) studioContactLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioProjectLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioProductLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioQuestionnaireLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioQuoteLimit?:number;
  @IsOptional() @IsInt() @Min(0) studioMonthlyEmails?:number;
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
  galleryLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subdomainLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aiImageMetadataLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyEmails?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  videoMinutes?: number;

  @IsOptional()
  @IsIn(['hd', '4k'])
  videoQuality?: 'hd' | '4k';

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMonthly?: number;

  @IsOptional()
  @IsBoolean()
  yearlyEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceYearly?: number;

  @IsOptional()
  features?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  recommended?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
