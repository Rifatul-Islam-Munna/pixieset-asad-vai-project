import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class BlogCtaButtonDto {
  @IsOptional() @IsString() @MaxLength(100) id?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(100) label?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() @MaxLength(30) style?: string;
  @IsOptional() @IsBoolean() newTab?: boolean;
}

export class CreateBlogDto {
  @IsString() @MaxLength(180) title: string;
  @IsOptional() @IsString() @MaxLength(180) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) excerpt?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) author?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(40) language?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() ctaEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(220) ctaTitle?: string;
  @IsOptional() @IsString() @MaxLength(1200) ctaText?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BlogCtaButtonDto) ctaButtons?: BlogCtaButtonDto[];
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsString() @MaxLength(180) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) seoDescription?: string;
  @IsOptional() @IsString() canonicalUrl?: string;
  @IsOptional() @IsString() @MaxLength(180) ogTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) ogDescription?: string;
  @IsOptional() @IsString() ogImageUrl?: string;
  @IsOptional() @IsBoolean() robotsIndex?: boolean;
  @IsOptional() @IsBoolean() robotsFollow?: boolean;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsDateString() publishedAt?: string;
}

export class UpdateBlogDto extends CreateBlogDto {}
