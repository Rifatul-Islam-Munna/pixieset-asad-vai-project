import { IsNumber, Max, Min } from 'class-validator';

export class FreePlanSettingDto {
  @IsNumber()
  @Min(0)
  @Max(1000000)
  storageGb: number;

  @IsNumber()
  @Min(0)
  @Max(1000000000)
  monthlyEmails: number;
}
