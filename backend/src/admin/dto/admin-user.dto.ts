import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserType } from 'src/user/entities/user.entity';

export class AdminCreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  phoneNumber: string;

  @IsString()
  @MinLength(6)
  @MaxLength(80)
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  role?: UserType;

  @IsOptional()
  @IsString()
  gender?: string;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  password?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  role?: UserType;

  @IsOptional()
  @IsString()
  gender?: string;
}
