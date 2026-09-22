import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class UpdateAgendaCitaEstadoDto {
  @Type(() => Number)
  @IsInt()
  idEstado!: number;
}
