import { IsInt, IsString, Length, Max, MaxLength, Min } from 'class-validator';

export class AdminCreateLoginAccessDto {
  @IsInt()
  @Min(1)
  @Max(24 * 365)
  expiresInHours: number;
}

export class AdminSendLoginAccessDto {
  @IsString()
  @MaxLength(180)
  subject: string;

  @IsString()
  @MaxLength(12000)
  message: string;

  @IsString()
  @Length(6, 6)
  pin: string;

  @IsString()
  @MaxLength(2200)
  link: string;
}
