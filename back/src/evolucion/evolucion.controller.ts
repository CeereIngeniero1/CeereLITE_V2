import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import type { JwtPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEvaluacionDto } from './dto/create-evaluacion.dto';
import { RegistrarRipsDto } from './dto/registrar-rips.dto';
import { UpdateEvaluacionDiagDto } from './dto/update-evaluacion-diag.dto';
import { UpdatePacienteDemografiaDto } from './dto/update-paciente-demografia.dto';
import { EvolucionService } from './evolucion.service';

@Controller('evolucion')
@UseGuards(JwtAuthGuard)
export class EvolucionController {
  constructor(private readonly evolucionService: EvolucionService) {}

  @Get('tipos-evaluacion')
  tiposEvaluacion() {
    return this.evolucionService.listTiposEvaluacion();
  }

  @Get('paciente/:documento/evoluciones')
  listarPorPaciente(@Param('documento') documento: string) {
    return this.evolucionService.listEvolucionesMedicas(documento);
  }

  @Get('paciente/:documento/hc')
  historiaCabecera(@Param('documento') documento: string) {
    return this.evolucionService.getHistoriaClinicaCabecera(documento);
  }

  @Get('paciente/:documento/datos')
  pacienteDatos(@Param('documento') documento: string) {
    return this.evolucionService.getPacienteDatos(documento);
  }

  @Post('paciente/:documento/datos')
  actualizarPacienteDatos(
    @Param('documento') documento: string,
    @Body() dto: UpdatePacienteDemografiaDto,
  ) {
    return this.evolucionService.updatePacienteDemografia(documento, dto);
  }

  @Get('catalog/paciente/:segmento')
  catalogoPaciente(
    @Param('segmento') segmento: string,
    @Query('q') q?: string,
  ) {
    return this.evolucionService.catalogoPaciente(segmento, q);
  }

  /* ─── Catálogos RIPS (CeereLite listasRipsRoutes) ─── */

  @Get('catalog/rips/tipo-rips')
  catalogTipoRips() {
    return this.evolucionService.catalogoRipsTipoRips();
  }

  @Get('catalog/rips/entidades/:idFuncion')
  catalogEntidades(
    @Param('idFuncion', ParseIntPipe) idFuncion: number,
  ) {
    return this.evolucionService.catalogoRipsEntidadesPorFuncion(idFuncion);
  }

  @Get('catalog/rips/modalidad-atencion')
  catalogModalidad() {
    return this.evolucionService.catalogoRipsModalidadAtencion();
  }

  @Get('catalog/rips/grupo-servicios')
  catalogGrupoServicios() {
    return this.evolucionService.catalogoRipsGrupoServicios();
  }

  @Get('catalog/rips/servicios')
  catalogServicios() {
    return this.evolucionService.catalogoRipsServicios();
  }

  @Get('catalog/rips/finalidad-consulta')
  catalogFinalidadConsulta() {
    return this.evolucionService.catalogoRipsFinalidadConsulta();
  }

  @Get('catalog/rips/finalidad-procedimiento')
  catalogFinalidadProcedimiento() {
    return this.evolucionService.catalogoRipsFinalidadProcedimiento();
  }

  @Get('catalog/rips/causa-externa')
  catalogCausaExterna() {
    return this.evolucionService.catalogoRipsCausaExterna();
  }

  @Get('catalog/rips/tipo-diagnostico')
  catalogTipoDiagnostico() {
    return this.evolucionService.catalogoRipsTipoDiagnostico();
  }

  @Get('catalog/rips/via-ingreso')
  catalogViaIngreso() {
    return this.evolucionService.catalogoRipsViaIngreso();
  }

  @Get('catalog/rips/cups/:tipo')
  catalogCups(@Param('tipo') tipo: string, @Query('q') q?: string) {
    return this.evolucionService.catalogoRipsCupsPorTipo(tipo, q);
  }

  @Get('catalog/rips/cie')
  catalogCie(@Query('q') q?: string) {
    return this.evolucionService.catalogoRipsCie10(q);
  }

  @Post()
  crear(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Body() dto: CreateEvaluacionDto,
  ) {
    return this.evolucionService.createEvaluacionSinRips(req.user, dto);
  }

  /** Filas RIPS as ociadas a la evolución (antes de @Get(':id')). */
  @Get(':id/rips')
  listarRips(@Param('id', ParseIntPipe) id: number) {
    return this.evolucionService.listRipsPorEvaluacion(id);
  }

  @Post(':id/rips')
  registrarRips(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarRipsDto,
  ) {
    return this.evolucionService.registrarRips(id, dto);
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.evolucionService.getEvolucionMedicaById(id);
  }

  @Patch(':id/diagnosticos')
  async actualizarDiagnosticos(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEvaluacionDiagDto,
  ) {
    await this.evolucionService.updateDiagnosticos(id, dto);
    return { ok: true };
  }

  @Patch(':id/cerrar')
  cerrar(@Param('id', ParseIntPipe) id: number) {
    return this.evolucionService.cerrarEvolucion(id);
  }
}
