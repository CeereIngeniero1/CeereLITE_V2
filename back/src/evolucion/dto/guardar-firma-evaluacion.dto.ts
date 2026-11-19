import { IsString, Matches } from 'class-validator';

export class GuardarFirmaEvaluacionDto {
  /** data:image/png;base64,... o data:image/jpeg;base64,... */
  @IsString()
  @Matches(/^data:image\/(png|jpeg|jpg);base64,/i, {
    message: 'Se espera una imagen PNG o JPEG en base64',
  })
  imagenBase64!: string;
}
