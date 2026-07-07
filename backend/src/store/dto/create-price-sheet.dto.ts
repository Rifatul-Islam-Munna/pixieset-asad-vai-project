import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePriceSheetDto {
  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsArray()
  @IsOptional()
  collectionIds?: string[];

  @IsNumber()
  @IsOptional()
  minimumOrderAmount?: number;

  @IsIn(['self-fulfilled', 'auto'])
  @IsOptional()
  fulfillment?: 'self-fulfilled' | 'auto';
}
