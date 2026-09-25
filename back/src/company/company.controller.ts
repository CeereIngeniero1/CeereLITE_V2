import { Controller, Get, Param } from '@nestjs/common';
import { CompanyService } from './company.service';

@Controller('company')
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
