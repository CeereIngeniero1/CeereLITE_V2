export class CompanyListItemDto {
  documentoEmpresa: string;
  nombreComercialEmpresa: string;
}

export class CompanyDetailDto {
  nombreEmpresa: string;
  documentoEmpresa: string;
  direccionEmpresa: string | null;
  telefonoEmpresa: string | null;
  correoEmpresa: string | null;
}
