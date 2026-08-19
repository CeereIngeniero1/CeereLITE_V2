import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

/** Cuerpo alineado al POST legacy `insert-evaluacion` con `tipoRIPS === 99999`. */
export class CreateEvaluacionDto {
  @IsString()
  documentoPaciente!: string;

  /** Por defecto en servicio: 1 (Evolución médica). */
  @IsOptional()
  @IsInt()
  idTipoEvaluacion?: number;

  @IsInt()
  edadPaciente!: number;

  @IsOptional()
  @IsString()
  nombreAcompanante?: string;

  @IsOptional()
  @IsInt()
  idParentescoAcompanante?: number | null;

  @IsOptional()
  @IsString()
  telefonoAcompanante?: string;

  @IsString()
  diagnosticoGeneral!: string;

  @IsString()
  diagnosticoEspecifico!: string;

  @IsString()
  direccionPaciente!: string;

  @IsOptional()
  @IsInt()
  idCiudad?: number | null;

  @IsOptional()
  @IsString()
  telefonoDomicilio?: string;

  @IsDateString()
  fechaNacimiento!: string;

  @IsOptional()
  @IsInt()
  idUnidadMedidaEdad?: number | null;

  @IsInt()
  idSexo!: number;

  @IsOptional()
  @IsInt()
  idEstadoCivil?: number | null;

  @IsOptional()
  @IsInt()
  idOcupacion?: number | null;

  @IsOptional()
  @IsString()
  documentoAseguradora?: string;

  @IsOptional()
  @IsInt()
  idTipoAfiliado?: number | null;

  @IsOptional()
  @IsString()
  responsableNombre?: string;

  @IsOptional()
  @IsInt()
  idParentescoResponsable?: number | null;

  @IsOptional()
  @IsString()
  telefonoResponsable?: string;

  @IsOptional()
  @IsString()
  documentoEmpresa?: string;
}
