import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class AdminPayPalSettingDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['sandbox', 'live']) environment?: 'sandbox' | 'live';
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() clientSecret?: string;
  @IsOptional() @IsString() webhookId?: string;
}
