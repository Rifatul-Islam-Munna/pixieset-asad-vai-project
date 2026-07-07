import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateHomeCmsDto {
  @IsOptional()
  @IsObject()
  content?: Record<string, any>;

  @IsOptional()
  @IsObject()
  seo?: Record<string, any>;

  @IsOptional()
  @IsObject()
  auth?: Record<string, any>;

  @IsOptional()
  @IsObject()
  brand?: Record<string, any>;

  @IsOptional()
  coverTemplates?: Record<string, any>[];

  @IsOptional()
  @IsObject()
  media?: {
    heroMediaType?: 'image' | 'video';
    heroMediaUrl?: string;
  };

  @IsOptional()
  @IsString()
  @IsIn(['en', 'gr'])
  defaultLanguage?: 'en' | 'gr';
}
