import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, MinLength } from 'class-validator';

export class UpdateObservacionDto {
  @IsString()
  @MinLength(1)
  observacion!: string;

  @Type(() => Number)
  @IsInt()
  @IsIn([7, 8])
  idEstado!: number;
}
