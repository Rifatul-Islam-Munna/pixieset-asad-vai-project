import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

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
}
