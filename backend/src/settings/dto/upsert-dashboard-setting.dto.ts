import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertDashboardSettingDto {
  @IsString()
  @IsNotEmpty()
  localId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  collectionId?: string;

  @IsObject()
  data: Record<string, unknown>;
}
