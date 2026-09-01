import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

/** Cuerpo alineado al POST legacy `insert-evaluacion`. */
export class CreateEvaluacionDto {
  @IsString()
  documentoPaciente!: string;

  /** 1 = evolución médica (texto). 4 = formato HTML de HC. */
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
