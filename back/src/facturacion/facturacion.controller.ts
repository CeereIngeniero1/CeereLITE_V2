import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';

@Controller('facturacion')
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  @Get('siguiente-numero')
  siguienteNumero(@Query('documentoEmpresa') documentoEmpresa?: string) {
    return this.facturacionService.siguienteNumero(documentoEmpresa);
  }

  @Get('tratamientos')
  listTratamientos(@Query('documentoEmpresa') documentoEmpresa?: string) {
    return this.facturacionService.listTratamientos(documentoEmpresa);
  }

  @Get('tarifas')
  listTarifas(@Query('documentoEmpresa') documentoEmpresa?: string) {
    return this.facturacionService.listTarifas(documentoEmpresa);
  }

  @Get('tratamientos/:id/items')
  listItems(
    @Param('id', ParseIntPipe) id: number,
    @Query('documentoEmpresa') documentoEmpresa?: string,
    @Query('idTipoTarifa') idTipoTarifa?: string,
  ) {
    return this.facturacionService.listItems(
      id,
      documentoEmpresa,
      idTipoTarifa,
    );
  }

  @Get('tratamientos/:id/profesionales')
  listProfesionales(
    @Param('id', ParseIntPipe) id: number,
    @Query('documentoEmpresa') documentoEmpresa?: string,
  ) {
    return this.facturacionService.listProfesionales(id, documentoEmpresa);
  }
}
