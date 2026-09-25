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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import type { Request as ExpressRequest } from 'express';
import type { JwtPayload } from '../auth/auth.service';
import type { UploadedFotoFile } from '../entidad-foto';
import { CreateEvaluacionDto } from './dto/create-evaluacion.dto';
import { CreateNotaAclaratoriaDto } from './dto/create-nota-aclaratoria.dto';
import { CreateObservacionDto } from './dto/create-observacion.dto';
import { UpdateEvaluacionDiagDto } from './dto/update-evaluacion-diag.dto';
import { UpdateObservacionDto } from './dto/update-observacion.dto';
import { UpdatePacienteDemografiaDto } from './dto/update-paciente-demografia.dto';
import { EvolucionService } from './evolucion.service';
import { FormatosHcService } from './formatos-hc.service';

@Controller('evolucion')
export class EvolucionController {
  constructor(
    private readonly evolucionService: EvolucionService,
    private readonly formatosHcService: FormatosHcService,
  ) {}

  @Get('tipos-evaluacion')
  tiposEvaluacion() {
    return this.evolucionService.listTiposEvaluacion();
  }

  @Get('paciente/:documento/anexos/siguiente')
  siguienteAnexo(@Param('documento') documento: string) {
    return this.evolucionService.nextAnexoNombreBase(documento);
  }

  @Post('paciente/:documento/anexos')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  crearAnexo(
    @Param('documento') documento: string,
    @UploadedFile() file: UploadedFotoFile,
    @Request() req: ExpressRequest & { user: JwtPayload },
  ) {
    const nombre =
      typeof req.body?.nombre === 'string' ? req.body.nombre : '';
    return this.evolucionService.createDocumentoAnexo(
      req.user,
      documento,
      file,
      nombre,
    );
  }

  @Post('paciente/:documento/anexos/:id/archivo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  reemplazarAnexo(
    @Param('documento') documento: string,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedFotoFile,
  ) {
    return this.evolucionService.saveDocumentoAnexoArchivo(
      documento,
      id,
      file,
    );
  }

  @Get('paciente/:documento/anexos/:id/archivo')
  archivoAnexo(
    @Param('documento') documento: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.evolucionService
      .getDocumentoAnexoArchivo(documento, id)
      .then(({ fullPath, mime, disposition }) => {
        return new StreamableFile(createReadStream(fullPath), {
          type: mime,
          disposition,
        });
      });
  }

  @Get('paciente/:documento/anexos')
  listarAnexos(@Param('documento') documento: string) {
    return this.evolucionService.listDocumentoAnexos(documento);
  }

  @Get('paciente/:documento/observaciones')
  listarObservaciones(@Param('documento') documento: string) {
    return this.evolucionService.listObservaciones(documento);
  }

  @Post('paciente/:documento/observaciones')
  crearObservacion(
    @Param('documento') documento: string,
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Body() dto: CreateObservacionDto,
  ) {
    return this.evolucionService.createObservacion(req.user, documento, dto);
  }

  @Patch('paciente/:documento/observaciones/:id')
  actualizarObservacion(
    @Param('documento') documento: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateObservacionDto,
  ) {
    return this.evolucionService.updateObservacion(documento, id, dto);
  }

  @Get('paciente/:documento/evoluciones')
  listarPorPaciente(@Param('documento') documento: string) {
    return this.evolucionService.listEvolucionesMedicas(documento);
  }

  @Get('paciente/:documento/historial')
  historialHc(
    @Param('documento') documento: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.evolucionService.listHistorialHc(documento, desde, hasta);
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

  @Post('paciente/:documento/foto')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  actualizarPacienteFoto(
    @Param('documento') documento: string,
    @UploadedFile() file: UploadedFotoFile,
  ) {
    return this.evolucionService.savePacienteFoto(documento, file);
  }

  @Get('catalog/paciente/:segmento')
  catalogoPaciente(
    @Param('segmento') segmento: string,
    @Query('q') q?: string,
  ) {
    return this.evolucionService.catalogoPaciente(segmento, q);
  }

  @Get('catalog/parentesco')
  catalogoParentesco(@Query('q') q?: string) {
    return this.evolucionService.listParentesco(q);
  }

  @Get('formatos')
  listarFormatos() {
    return this.formatosHcService.list();
  }

  @Get('formatos/contenido')
  contenidoFormato(@Query('file') file: string) {
    return this.formatosHcService.getContenido(file);
  }

  @Post()
  crear(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Body() dto: CreateEvaluacionDto,
  ) {
    return this.evolucionService.createEvaluacion(req.user, dto);
  }

  @Get('notas-aclaratorias/:id')
  notaAclaratoria(
    @Param('id', ParseIntPipe) id: number,
    @Query('documento') documento: string,
  ) {
    return this.evolucionService.getNotaAclaratoria(id, documento);
  }

  @Post('notas-aclaratorias')
  crearNotaAclaratoria(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Body() dto: CreateNotaAclaratoriaDto,
  ) {
    return this.evolucionService.createNotaAclaratoria(req.user, dto);
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
