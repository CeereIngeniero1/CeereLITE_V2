import { IsString, MinLength } from 'class-validator';

export class CreateObservacionDto {
  @IsString()
  @MinLength(1)
  observacion!: string;
}
