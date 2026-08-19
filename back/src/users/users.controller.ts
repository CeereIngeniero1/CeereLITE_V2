import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Lista pacientes (misma consulta que /api/infousuarios en Express) */
  @Get()
  list() {
    return this.usersService.listPatientsForAgenda();
  }
}
