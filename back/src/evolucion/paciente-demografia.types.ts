export type PacienteDemografiaDto = {
  idTipoDocumento: number | null;
  descripcionTipoDocumento: string | null;
  tipoDocumentoBase: string | null;
  documentoPaciente: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
  primerNombre: string | null;
  segundoNombre: string | null;
  nombreCompleto: string | null;
  sexoPaciente: string | null;
  sexo: string | null;
  codigoSexo: string | null;
  idSexo: number | null;
  edad: number | null;
  direccion: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  idIdentidadGenero: number | null;
  idSexoIdentidadGenero: number | null;
  codigoIdentidadGenero: string | null;
  identidadGenero: string | null;
  idZonaResidenciaLegacy: number | null;
  talla: string | null;
  peso: string | null;
  idEtnia: number | null;
  comunidadEtnica: string | null;
  idDiscapacidad: number | null;
  idPaisNacionalidad: number | null;
  codigoPaisNacionalidad: string | null;
  nombrePaisNacionalidad: string | null;
  idPaisResidencia: number | null;
  codigoPaisResidencia: string | null;
  nombrePaisResidencia: string | null;
  idMunicipioResidencia: number | null;
  codigoMunicipioResidencia: string | null;
  nombreMunicipioResidencia: string | null;
  idZonaResidencia: number | null;
  descripcionZonaResidencia: string | null;
  codigoZonaResidencia: string | null;
  zonaResidencia: string | null;
  codigoEtnia: string | null;
  etnia: string | null;
  descripcionEtnia: string | null;
  codigoDiscapacidad: string | null;
  discapacidad: string | null;
  descripcionDiscapacidad: string | null;
  idOcupacion: number | null;
  codigoOcupacion: string | null;
  ocupacion: string | null;
  descripcionOcupacion: string | null;
  alergias: string | null;
  alergeno: string | null;
};

export type EvolucionSnapshotDto = {
  idListaCiudad: number | null;
  idEstadoCivil: number | null;
  documentoAseguradora: string | null;
  idTipoAfiliado: number | null;
  idParentescoResponsable: number | null;
  nombreResponsable: string | null;
  telefonoResponsable: string | null;
  idUnidad: number | null;
  nombreUnidad: string | null;
};

export type PacienteDatosResponseDto = {
  demografia: PacienteDemografiaDto | null;
  evolucionSnapshot: EvolucionSnapshotDto | null;
};

export type CatalogoPacienteItemDto = {
  id: number;
  label: string;
};
