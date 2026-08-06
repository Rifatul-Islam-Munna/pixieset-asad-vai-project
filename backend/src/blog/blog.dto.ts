import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBlogDto {
  @IsString() @MaxLength(180) title: string;
  @IsOptional() @IsString() @MaxLength(180) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) excerpt?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) author?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsDateString() publishedAt?: string;
}

export class UpdateBlogDto extends CreateBlogDto {}
