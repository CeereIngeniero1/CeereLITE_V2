import { IsString, MinLength } from 'class-validator';

export class CreateNotaAclaratoriaDto {
  @IsString()
  documentoPaciente!: string;

  @IsString()
  @MinLength(1)
  nota!: string;
}
