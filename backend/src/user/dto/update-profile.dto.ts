import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(30)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, { message: 'Username may contain lowercase letters, numbers, and hyphens only' })
  username?: string;

  @IsOptional() @IsString() @MaxLength(100) businessName?: string;
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phoneNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) avatar?: string;
  @IsOptional() @IsString() @MaxLength(500) website?: string;
  @IsOptional() @IsString() @MaxLength(300) businessAddress?: string;
  @IsOptional() @IsString() @MaxLength(2000) biography?: string;
  @IsOptional() @IsString() @MinLength(6) @MaxLength(80) password?: string;
}
