import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateAgendaCitaDto {
  @IsString()
  @MinLength(1)
  documentoPaciente!: string;

  @IsString()
  @MinLength(1)
  documentoProfesional!: string;

  /** YYYY-MM-DD */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha!: string;

  /** HH:mm */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  horaInicio!: string;

  /** HH:mm — duración de la cita (sin default de 30 min) */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  horaFin!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  motivo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idTipoCompromiso?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codigosObjeto?: string[];

  @IsString()
  @MinLength(1)
  documentoEmpresa!: string;

  /** Entidad primaria (consultorio). Obligatorio si hay más de una a esa hora. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  documentoEspacio?: string;
}
