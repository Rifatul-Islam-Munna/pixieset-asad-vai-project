import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PinLoginDto {
  @IsString()
  @MaxLength(240)
  login: string;

  @IsString()
  @Matches(/^\d{6}$/)
  pin: string;
}

export class MagicLoginDto {
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token: string;
}
