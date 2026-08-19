import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePacienteDemografiaDto {
  @IsInt()
  idTipoDocumento: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documento: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  primerApellido: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  segundoApellido?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  primerNombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  segundoNombre?: string;

  @IsString()
  @IsNotEmpty()
  fechaNacimiento: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  edad?: string;

  @IsInt()
  sexoBio: number;

  @IsOptional()
  @IsInt()
  sexoIdenti?: number;

  @IsInt()
  idNacionalidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  talla?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  peso?: string;

  @IsInt()
  idResidencia: number;

  @IsInt()
  idMunicipio: number;

  @IsInt()
  idZonaTerritorial: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  direccion?: string;

  @IsInt()
  idEtnia: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  comunidadEtnica?: string;

  @IsInt()
  idDiscapacidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @IsOptional()
  @IsInt()
  idOcupacion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  alergias?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alergeno?: string;
}
