import { IsInt, IsOptional, IsNumber, Max, Min } from 'class-validator';

export class FreePlanSettingDto {
  @IsOptional() @IsInt() @Min(0) @Max(1000000) studioContactLimit?:number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) studioProjectLimit?:number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) studioProductLimit?:number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) studioQuestionnaireLimit?:number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) studioQuoteLimit?:number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) studioMonthlyEmails?:number;
  @IsNumber()
  @Min(0)
  @Max(1000000)
  storageGb: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  subdomainLimit: number;

  @IsNumber()
  @Min(0)
  @Max(1000000000)
  monthlyEmails: number;
}
