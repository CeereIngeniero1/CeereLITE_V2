import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyService } from './company.service';

@Controller('company')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  /** Equivalente a GET /api/seleccionEmpresa */
  @Get()
  list() {
    return this.companyService.list();
  }

  /** Equivalente a GET /api/empresa?docEmpresa= */
  @Get(':docEmpresa')
  detail(@Param('docEmpresa') docEmpresa: string) {
    return this.companyService.findByDocument(docEmpresa);
  }
}
