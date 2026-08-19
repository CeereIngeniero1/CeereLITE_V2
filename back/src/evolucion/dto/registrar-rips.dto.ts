import { IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

/** AC=1 (consulta): requiere causa externa y tipo diagnóstico. AP=2: requiere vía ingreso. */
export class RegistrarRipsDto {
  @IsIn([1, 2])
  actoQuirurgico!: 1 | 2;

  @IsInt()
  idTipoRips!: number;

  @IsString()
  @MinLength(1)
  documentoTipoRips!: string;

  @IsInt()
  idModalidadAtencion!: number;

  @IsInt()
  idGrupoServicios!: number;

  @IsInt()
  idServicios!: number;

  @IsInt()
  idFinalidadConsulta!: number;

  @IsOptional()
  @IsInt()
  idCausaExterna?: number;

  @IsOptional()
  @IsInt()
  idTipoDiagnosticoPrincipal?: number;

  @IsOptional()
  @IsInt()
  idViaIngresoUsuario?: number;

  @IsString()
  @MinLength(1)
  codigoRips!: string;

  @IsOptional()
  @IsString()
  codigoRips2?: string;

  @IsString()
  @MinLength(1)
  diagnosticoRips!: string;

  @IsOptional()
  @IsString()
  diagnosticoRips2?: string;
}
