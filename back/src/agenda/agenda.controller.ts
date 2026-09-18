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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { AgendaService } from './agenda.service';
import { CreateAgendaCitaDto } from './dto/create-agenda-cita.dto';

@Controller('agenda')
@UseGuards(JwtAuthGuard)
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get('profesionales')
  listProfesionales() {
    return this.agendaService.listProfesionales();
  }

  @Get('tipos-compromiso')
  listTipos() {
    return this.agendaService.listTiposCompromiso();
  }

  @Get('procedimientos')
  listProcedimientos(@Query('q') q?: string) {
    return this.agendaService.listProcedimientos(q);
  }

  @Get('pacientes')
  listPacientes(@Query('q') q?: string) {
    return this.agendaService.listPacientes(q);
  }

  @Get('espacios')
  listEspacios(
    @Query('fecha') fecha?: string,
    @Query('documentoEmpresa') documentoEmpresa?: string,
  ) {
    return this.agendaService.listEspaciosDelDia(fecha, documentoEmpresa);
  }

  @Get('citas')
  listCitas(
    @Query('fecha') fecha?: string,
    @Query('documentoEmpresa') documentoEmpresa?: string,
  ) {
    return this.agendaService.listCitasDelDia(fecha, documentoEmpresa);
  }

  @Post('citas')
  crearCita(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Body() dto: CreateAgendaCitaDto,
  ) {
    return this.agendaService.crearCita(req.user, dto);
  }

  @Patch('citas/:id')
  actualizarCita(
    @Request() req: ExpressRequest & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAgendaCitaDto,
  ) {
    return this.agendaService.actualizarCita(req.user, id, dto);
  }
}
