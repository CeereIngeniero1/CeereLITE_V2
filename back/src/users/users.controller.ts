import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Lista pacientes (misma consulta que /api/infousuarios en Express) */
  @Get()
  list() {
    return this.usersService.listPatientsForAgenda();
  }
}
