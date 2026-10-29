import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClientLogDto {
  @IsString()
  @MaxLength(8000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  href?: string;
}
