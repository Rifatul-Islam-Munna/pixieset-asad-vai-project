import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateStoreProductDto {
  @IsIn(['digital-download', 'self-fulfilled', 'package'])
  @IsOptional()
  type?: 'digital-download' | 'self-fulfilled' | 'package';

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  extraShipping?: number;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsIn(['single-photo', 'all-photos'])
  @IsOptional()
  downloadType?: 'single-photo' | 'all-photos';

  @IsString()
  @IsOptional()
  downloadSize?: string;

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  options?: { name: string; values: string[] }[];

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  variants?: { id: string; label: string; options: Record<string, string>; price: number; hidden?: boolean }[];

  @IsBoolean()
  @IsOptional()
  noImageRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  exemptFromSalesTax?: boolean;

  @IsBoolean()
  @IsOptional()
  limitOnePerCheckout?: boolean;

  @IsBoolean()
  @IsOptional()
  allowBulkPurchase?: boolean;

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  packageItems?: { productId?: string; name: string; quantity: number; variantId?: string; variantLabel?: string; unitPrice?: number }[];

  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @IsNumber()
  @IsOptional()
  labCost?: number;

  @IsBoolean()
  @IsOptional()
  singleImageRestriction?: boolean;
}
