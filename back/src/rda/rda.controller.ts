import { Controller, Get, Param, Query } from '@nestjs/common';
import { RdaService } from './rda.service';

@Controller('rda')
export class RdaController {
  constructor(private readonly rdaService: RdaService) {}

  @Get()
  overview() {
    return this.rdaService.overview();
  }

  @Get('catalog/claves-1888')
  claves1888() {
    return { claves: this.rdaService.clavesCatalogo1888() };
  }

  @Get('catalog/egreso-remision')
  egresoRemision(@Query('q') q?: string) {
    return this.rdaService.listCatalogoEgresoRemision(q);
  }

  @Get('catalog/factor-riesgo')
  factorRiesgo(@Query('q') q?: string) {
    return this.rdaService.listCatalogoFactorRiesgo(q);
  }

  @Get('catalog/tipo-tecnologia-salud')
  tipoTecnologia(@Query('q') q?: string) {
    return this.rdaService.listCatalogoTipoTecnologiaSalud(q);
  }

  /** Claves: EntornoAtencion, TipoAlergia, ParentescoFamiliar, … (ver GET catalog/claves-1888) */
  @Get('catalog/1888/:clave')
  catalogo1888(@Param('clave') clave: string, @Query('q') q?: string) {
    return this.rdaService.listCatalogo1888(clave, q);
  }
}
