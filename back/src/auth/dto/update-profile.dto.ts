import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
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
  @MaxLength(50)
  primerApellido: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  segundoApellido?: string;

  @IsOptional()
  @IsString()
  @MaxLength(90)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @ValidateIf((o: UpdateProfileDto) => !!o.newPassword)
  @IsString()
  @IsNotEmpty({ message: 'Indique la contraseña actual' })
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  newPassword?: string;
}
