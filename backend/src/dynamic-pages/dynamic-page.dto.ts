import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class DynamicPageColumnDto {
  @IsOptional() @IsString() @MaxLength(80) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) body?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(80) linkLabel?: string;
  @IsOptional() @IsString() linkUrl?: string;
}

export class DynamicPageSectionItemDto {
  @IsOptional() @IsString() @MaxLength(100) id?: string;
  @IsOptional() @IsString() @MaxLength(80) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) body?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsString() @MaxLength(120) value?: string;
  @IsOptional() @IsString() @MaxLength(100) linkLabel?: string;
  @IsOptional() @IsString() linkUrl?: string;
}

export class DynamicPageButtonDto {
  @IsOptional() @IsString() @MaxLength(100) id?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(100) label?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() @MaxLength(30) style?: string;
  @IsOptional() @IsBoolean() newTab?: boolean;
}

export class DynamicPageSectionDto {
  @IsOptional() @IsString() @MaxLength(100) id?: string;
  @IsString()
  @IsIn(['split', 'rich-text', 'feature-grid', 'gallery', 'stats', 'testimonial', 'cta', 'logo-strip', 'steps'])
  type: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(80) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(220) title?: string;
  @IsOptional() @IsString() @MaxLength(8000) body?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(40) layout?: string;
  @IsOptional() @IsString() @MaxLength(40) tone?: string;
  @IsOptional() @IsString() @MaxLength(40) alignment?: string;
  @IsOptional() @IsString() @MaxLength(100) buttonLabel?: string;
  @IsOptional() @IsString() buttonUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) secondaryButtonLabel?: string;
  @IsOptional() @IsString() secondaryButtonUrl?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DynamicPageButtonDto) buttons?: DynamicPageButtonDto[];
  @IsOptional() @IsInt() @Min(2) @Max(4) columns?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DynamicPageSectionItemDto) items?: DynamicPageSectionItemDto[];
}

export class CreateDynamicPageDto {
  @IsString() @MaxLength(180) title: string;
  @IsOptional() @IsString() @MaxLength(180) slug?: string;
  @IsOptional() @IsString() @MaxLength(80) navLabel?: string;
  @IsOptional() @IsString() @MaxLength(240) navDescription?: string;
  @IsOptional() @IsBoolean() showInNavbar?: boolean;
  @IsOptional() @IsInt() navOrder?: number;
  @IsOptional() @IsString() @MaxLength(80) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(220) heroTitle?: string;
  @IsOptional() @IsString() @MaxLength(1200) heroDescription?: string;
  @IsOptional() @IsString() heroImageUrl?: string;
  @IsOptional() @IsBoolean() heroEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(40) heroLayout?: string;
  @IsOptional() @IsString() @MaxLength(40) heroTone?: string;
  @IsOptional() @IsString() @MaxLength(100) heroPrimaryLabel?: string;
  @IsOptional() @IsString() heroPrimaryUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) heroSecondaryLabel?: string;
  @IsOptional() @IsString() heroSecondaryUrl?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DynamicPageButtonDto) heroButtons?: DynamicPageButtonDto[];
  @IsOptional() @IsInt() @Min(3) @Max(8) columnCount?: number;
  @IsOptional() @IsBoolean() legacyGridEnabled?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DynamicPageColumnDto) columns?: DynamicPageColumnDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DynamicPageSectionDto) sections?: DynamicPageSectionDto[];
  @IsOptional() @IsString() @MaxLength(180) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) seoDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) seoKeywords?: string[];
  @IsOptional() @IsString() canonicalUrl?: string;
  @IsOptional() @IsString() @MaxLength(180) ogTitle?: string;
  @IsOptional() @IsString() @MaxLength(500) ogDescription?: string;
  @IsOptional() @IsString() ogImageUrl?: string;
  @IsOptional() @IsBoolean() robotsIndex?: boolean;
  @IsOptional() @IsBoolean() robotsFollow?: boolean;
  @IsOptional() @IsBoolean() published?: boolean;
}

export class UpdateDynamicPageDto extends CreateDynamicPageDto {}
