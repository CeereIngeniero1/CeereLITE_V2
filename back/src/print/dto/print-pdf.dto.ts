import { IsString, MaxLength, MinLength } from 'class-validator';

export class PrintPdfDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2_000_000)
  html: string;
}
