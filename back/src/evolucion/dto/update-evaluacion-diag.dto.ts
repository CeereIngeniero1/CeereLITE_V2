import { IsOptional, IsString } from 'class-validator';

export class UpdateEvaluacionDiagDto {
  @IsOptional()
  @IsString()
  diagnosticoGeneral?: string;

  @IsOptional()
  @IsString()
  diagnosticoEspecifico?: string;
}
