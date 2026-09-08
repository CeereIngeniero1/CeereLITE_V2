/*
  CeereLITE — instalar / actualizar objetos SQL
  Ejecutar a mano en la base CeereSio (SSMS o sqlcmd).
  El API Nest no corre este archivo.

  Re-ejecutable: CREATE OR ALTER VIEW (SQL Server 2016+).

  Convención de nombres
  ---------------------
  Lite Cnsta {Nombre}
  Ejemplo: [Lite Cnsta HcHistorial]

  - Siempre con espacios: "Lite Cnsta" + nombre en PascalCase.
  - En SQL y en Nest usar corchetes: dbo.[Lite Cnsta HcHistorial]
  - No usar el prefijo vw_Lite.

  Cómo agregar una consulta nueva
  -------------------------------
  1. CREATE OR ALTER VIEW dbo.[Lite Cnsta Nombre] en este archivo.
  2. SELECT … FROM dbo.[Lite Cnsta Nombre] WHERE … en el servicio Nest.
  3. Volver a ejecutar este script en SQL Server.
*/

DROP VIEW IF EXISTS dbo.vw_LiteHcListaEvaluacion;
DROP VIEW IF EXISTS dbo.vw_LiteHcListaNotaAclaratoria;
DROP VIEW IF EXISTS dbo.vw_LiteHcHistorial;
DROP VIEW IF EXISTS dbo.vw_LiteHcDocumentoAnexo;
DROP VIEW IF EXISTS dbo.vw_LiteHcObservacion;
DROP VIEW IF EXISTS dbo.vw_LiteHcNotaAclaratoria;
DROP VIEW IF EXISTS dbo.vw_LiteHcEvaluacionDetalle;
DROP VIEW IF EXISTS dbo.vw_LiteHcPacienteCabecera;
DROP VIEW IF EXISTS dbo.vw_LiteHcPacienteSnapshot;
DROP VIEW IF EXISTS dbo.vw_LitePacienteAgenda;
DROP VIEW IF EXISTS dbo.[Lite Cnsta PacienteAgenda];
DROP VIEW IF EXISTS dbo.vw_LiteEmpresa;
DROP VIEW IF EXISTS dbo.vw_LiteUsuarioPerfil;
DROP VIEW IF EXISTS dbo.vw_LiteTipoEvaluacion;
GO

-- =============================================================================
-- Lite Cnsta HcListaEvaluacion
-- Usado por: GET /evolucion/paciente/:documento/evoluciones (origen evolucion)
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcListaEvaluacion]
AS
SELECT eve.[Id Evaluación Entidad],
       eve.[Id Tipo de Evaluación],
       eve.[Fecha Evaluación Entidad],
       eve.[Documento Entidad],
       CASE
         WHEN eve.[Id Estado] = 7 THEN N'Cerrado'
         WHEN eve.[Id Estado] = 8 THEN N'Abierto'
         ELSE N''
       END AS [Estado],
       FORMAT(eve.[Fecha Evaluación Entidad], 'hh:mm tt') AS [Hora]
FROM [Evaluación Entidad] AS eve
WHERE eve.[Id Tipo de Evaluación] IN (1, 4);
GO

-- =============================================================================
-- Lite Cnsta HcListaNotaAclaratoria
-- Usado por: GET /evolucion/paciente/:documento/evoluciones (origen nota)
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcListaNotaAclaratoria]
AS
SELECT n.[Id Historia Clinica CAPF Notas Aclaratorias],
       n.[Fecha Historia Clinica CAPF Notas Aclaratorias],
       n.[Documento Usuario],
       FORMAT(n.[Fecha Historia Clinica CAPF Notas Aclaratorias], 'hh:mm tt') AS [Hora]
FROM [Historia Clinica CAPF Notas Aclaratorias] AS n;
GO

-- =============================================================================
-- Lite Cnsta HcHistorial
-- Usado por: GET /evolucion/paciente/:documento/historial
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcHistorial]
AS
SELECT eve.[Id Evaluación Entidad],
       eve.[Id Tipo de Evaluación],
       eve.[Fecha Evaluación Entidad],
       eve.[Documento Entidad],
       enpro.[Nombre Completo Entidad] AS [Nombre Profesional],
       eve.[Diagnóstico General Evaluación Entidad] AS [Diagnostico General],
       eve.[Diagnóstico Específico Evaluación Entidad] AS [Diagnostico especifico]
FROM [Evaluación Entidad] AS eve
LEFT JOIN Entidad AS enpro
  ON eve.[Documento Profesional] = enpro.[Documento Entidad]
WHERE eve.[Id Tipo de Evaluación] IN (1, 4);
GO

-- =============================================================================
-- Lite Cnsta HcDocumentoAnexo
-- Usado por: listado, apertura y secuencia de documentos anexos
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcDocumentoAnexo]
AS
SELECT a.[Id Documento Anexo],
       a.[Documento Anexo],
       a.[Fecha Documento Anexo],
       a.[Descripción Documento Anexo],
       a.[Documento Entidad]
FROM [Documento Anexo] AS a;
GO

-- =============================================================================
-- Lite Cnsta HcObservacion
-- Usado por: GET /evolucion/paciente/:documento/observaciones
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcObservacion]
AS
SELECT o.IdEntidadObservacion,
       o.[Fecha Nota Aclaratoria],
       o.Observacion,
       o.[Id Estado],
       o.[Documento Usuario],
       en.[Primer Nombre Entidad] AS [Primer Nombre Usuario],
       en.[Primer Apellido Entidad] AS [Primer Apellido Usuario]
FROM [Entidad Observacion] AS o
LEFT JOIN Entidad AS en
  ON o.[Documento Usuario Sistema] = en.[Documento Entidad];
GO

-- =============================================================================
-- Lite Cnsta HcNotaAclaratoria
-- Usado por: GET /evolucion/notas-aclaratorias/:id
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcNotaAclaratoria]
AS
SELECT n.[Id Historia Clinica CAPF Notas Aclaratorias],
       n.[Fecha Historia Clinica CAPF Notas Aclaratorias],
       n.[Nota Aclaratoria Historia Clinica CAPF Notas Aclaratorias],
       n.[Documento Usuario],
       en.[Nombre Completo Entidad] AS [Nombre Profesional]
FROM [Historia Clinica CAPF Notas Aclaratorias] AS n
LEFT JOIN Entidad AS en
  ON n.[Documento Usuario Sistema] = en.[Documento Entidad];
GO

-- =============================================================================
-- Lite Cnsta HcEvaluacionDetalle
-- Usado por: GET /evolucion/:id
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcEvaluacionDetalle]
AS
SELECT eve.[Id Evaluación Entidad],
       tpe.[Tipo de Evaluación],
       eve.[Id Tipo de Evaluación],
       enpro.[Nombre Completo Entidad] AS [Nombre Profesional],
       eve.[Fecha Evaluación Entidad],
       en.[Nombre Completo Entidad] AS [Nombre Paciente],
       eve.[Documento Entidad] AS [Documento Paciente],
       eve.[Dirección Domicilio],
       eve.[Id Ciudad],
       Ciudad.Ciudad,
       eve.[Teléfono Domicilio],
       eve.[Fecha Nacimiento],
       eve.[Edad Entidad Evaluación Entidad] AS [Edad Paciente],
       eve.[Id Unidad de Medida Edad],
       ume.[Descripción Unidad de Medida Edad] AS [Unidad Medida],
       eve.[Id Sexo],
       Sexo.[Descripción Sexo],
       eve.[Id Estado Civil],
       ec.[Estado Civil],
       eve.[Id Ocupación],
       oc.Ocupación,
       eve.[Documento Aseguradora],
       enase.[Nombre Completo Entidad] AS [Nombre Aseguradora],
       eve.[Id Tipo de Afiliado],
       tpa.[Tipo de Afiliado],
       eve.[Acompañante Evaluación Entidad] AS [Acompanante],
       eve.[Id Parentesco],
       pa.Parentesco AS [Parentesco Acompanante],
       eve.[Teléfono Acompañante],
       eve.[Responsable Evaluación Entidad] AS [Responsable],
       eve.[Id Parentesco Responsable],
       pr.Parentesco AS [Parentesco Responsable],
       eve.[Teléfono Responsable],
       eve.[Diagnóstico General Evaluación Entidad] AS [Diagnostico General],
       eve.[Diagnóstico Específico Evaluación Entidad] AS [Diagnostico especifico],
       eve.[Firma Evaluación Entidad]
FROM [Evaluación Entidad] AS eve
LEFT JOIN [Tipo de Evaluación] AS tpe
  ON eve.[Id Tipo de Evaluación] = tpe.[Id Tipo de Evaluación]
LEFT JOIN Entidad AS en
  ON eve.[Documento Entidad] = en.[Documento Entidad]
LEFT JOIN Entidad AS enpro
  ON eve.[Documento Profesional] = enpro.[Documento Entidad]
LEFT JOIN Ciudad
  ON eve.[Id Ciudad] = Ciudad.[Id Ciudad]
LEFT JOIN [Unidad de Medida Edad] AS ume
  ON eve.[Id Unidad de Medida Edad] = ume.[Id Unidad de Medida Edad]
LEFT JOIN Sexo
  ON eve.[Id Sexo] = Sexo.[Id Sexo]
LEFT JOIN [Estado Civil] AS ec
  ON eve.[Id Estado Civil] = ec.[Id Estado Civil]
LEFT JOIN Ocupación AS oc
  ON eve.[Id Ocupación] = oc.[Id Ocupación]
LEFT JOIN Entidad AS enase
  ON eve.[Documento Aseguradora] = enase.[Documento Entidad]
LEFT JOIN [Tipo de Afiliado] AS tpa
  ON eve.[Id Tipo de Afiliado] = tpa.[Id Tipo de Afiliado]
LEFT JOIN Parentesco AS pa
  ON eve.[Id Parentesco] = pa.[Id Parentesco]
LEFT JOIN Parentesco AS pr
  ON eve.[Id Parentesco Responsable] = pr.[Id Parentesco]
WHERE eve.[Id Tipo de Evaluación] IN (1, 4);
GO

-- =============================================================================
-- Lite Cnsta HcPacienteCabecera
-- Usado por: GET /evolucion/paciente/:documento/hc
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcPacienteCabecera]
AS
SELECT en.[Nombre Completo Entidad] AS [Nombre Paciente],
       en.[Documento Entidad] AS [Documento Paciente],
       en.[Id Tipo de Documento] AS [Id Tipo Documento],
       td.[Descripción Tipo de Documento] AS [Tipo Documento],
       en.[Primer Apellido Entidad] AS [Primer Apellido Paciente],
       en.[Segundo Apellido Entidad] AS [Segundo Apellido Paciente],
       en.[Primer Nombre Entidad] AS [Primer Nombre Paciente],
       en.[Segundo Nombre Entidad] AS [Segundo Nombre Paciente],
       en2.[Dirección EntidadII] AS [Direccion Paciente],
       Ciudad.[Id Ciudad],
       Ciudad.Ciudad,
       en2.[Teléfono Celular EntidadII] AS [Celular Paciente],
       CONVERT(DATE, en3.[Fecha Nacimiento EntidadIII], 101) AS [Fecha Nacimiento Paciente],
       en3.[Edad EntidadIII] AS [Edad Paciente],
       en3.[Id Unidad de Medida Edad],
       ume.[Descripción Unidad de Medida Edad],
       Sexo.[Id Sexo],
       Sexo.[Descripción Sexo] AS Sexo,
       en3.[Id Estado Civil],
       esc.[Estado Civil],
       ocu.[Id Ocupación],
       ocu.Ocupación,
       en24.[Id Tipo de Afiliado],
       tpa.[Descripción Tipo de Afiliado],
       en24.[Documento Entidad Prepago] AS [Documento EPS],
       en3.[Acompañante EntidadIII] AS [Nombre Responsable],
       en3.[Id Parentesco],
       en3.[Tel Acompañante EntidadIII] AS [Teléfono Responsable]
FROM Entidad AS en
LEFT JOIN [Tipo de Documento] AS td
  ON en.[Id Tipo de Documento] = td.[Id Tipo de Documento]
LEFT JOIN EntidadII AS en2
  ON en.[Documento Entidad] = en2.[Documento Entidad]
LEFT JOIN EntidadIII AS en3
  ON en.[Documento Entidad] = en3.[Documento Entidad]
INNER JOIN Ciudad
  ON en2.[Id Ciudad] = Ciudad.[Id Ciudad]
LEFT JOIN Sexo
  ON en3.[Id Sexo] = Sexo.[Id Sexo]
LEFT JOIN [Estado Civil] AS esc
  ON en3.[Id Estado Civil] = esc.[Id Estado Civil]
LEFT JOIN EntidadVI AS en6
  ON en.[Documento Entidad] = en6.[Documento Entidad]
INNER JOIN Ocupación AS ocu
  ON en6.[Id Ocupación] = ocu.[Id Ocupación]
LEFT JOIN EntidadXXIV AS en24
  ON en.[Documento Entidad] = en24.[Documento Entidad]
INNER JOIN [Tipo de Afiliado] AS tpa
  ON en24.[Id Tipo de Afiliado] = tpa.[Id Tipo de Afiliado]
LEFT JOIN Entidad AS enr
  ON en3.[Documento Responsable] = enr.[Documento Entidad]
LEFT JOIN [Unidad de Medida Edad] AS ume
  ON en3.[Id Unidad de Medida Edad] = ume.[Id Unidad de Medida Edad];
GO

-- =============================================================================
-- Lite Cnsta HcPacienteSnapshot
-- Usado por: GET /evolucion/paciente/:documento/datos (snapshot evolución)
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta HcPacienteSnapshot]
AS
SELECT en.[Documento Entidad],
       Ciudad.[Id Ciudad],
       en3.[Id Estado Civil],
       en24.[Documento Entidad Prepago] AS [Documento EPS],
       eps.[Nombre Completo Entidad] AS [Nombre EPS],
       en24.[Id Tipo de Afiliado],
       tpa.[Descripción Tipo de Afiliado] AS [Tipo de Afiliado],
       en2.[Teléfono No 1 EntidadII] AS [Teléfono 1],
       en2.[Teléfono Celular EntidadII] AS Celular,
       en2.[E-mail Nro 1 EntidadII] AS Email,
       en3.[Id Parentesco],
       en3.[Acompañante EntidadIII] AS [Nombre Responsable],
       en3.[Tel Acompañante EntidadIII] AS [Teléfono Responsable],
       en3.[Id Unidad de Medida Edad],
       ume.[Descripción Unidad de Medida Edad]
FROM Entidad AS en
LEFT JOIN EntidadII AS en2
  ON en.[Documento Entidad] = en2.[Documento Entidad]
LEFT JOIN EntidadIII AS en3
  ON en.[Documento Entidad] = en3.[Documento Entidad]
LEFT JOIN Ciudad
  ON en2.[Id Ciudad] = Ciudad.[Id Ciudad]
LEFT JOIN EntidadXXIV AS en24
  ON en.[Documento Entidad] = en24.[Documento Entidad]
LEFT JOIN Entidad AS eps
  ON en24.[Documento Entidad Prepago] = eps.[Documento Entidad]
LEFT JOIN [Tipo de Afiliado] AS tpa
  ON en24.[Id Tipo de Afiliado] = tpa.[Id Tipo de Afiliado]
LEFT JOIN [Unidad de Medida Edad] AS ume
  ON en3.[Id Unidad de Medida Edad] = ume.[Id Unidad de Medida Edad];
GO

-- =============================================================================
-- Lite Cnsta ListaPaciente
-- Usado por: GET /users (listado de pacientes)
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta ListaPaciente]
AS
SELECT COALESCE(TipoDoc.[Tipo de Documento] + ' ', '') + COALESCE(Ent.[Documento Entidad], '') AS id2,
       Ent.[Documento Entidad] AS id,
       Ent.[Nombre Completo Entidad] AS name,
       N'Paciente' AS role,
       N'Desarrollador' AS team,
       EstaEnt.[Estado Entidad] AS status,
       EntIII.[Edad EntidadIII] AS age,
       Ent.[Foto Entidad] AS avatar,
       EntII.[E-mail Nro 1 EntidadII] AS email,
       TipoEnt.[Descripción Tipo Entidad] AS tipoentidad
FROM Entidad AS Ent
INNER JOIN EntidadII AS EntII
  ON Ent.[Documento Entidad] = EntII.[Documento Entidad]
INNER JOIN [Función Por Entidad] AS FunEnt
  ON Ent.[Documento Entidad] = FunEnt.[Documento Entidad]
INNER JOIN EntidadIII AS EntIII
  ON EntII.[Documento Entidad] = EntIII.[Documento Entidad]
INNER JOIN [Tipo de Documento] AS TipoDoc
  ON Ent.[Id Tipo de Documento] = TipoDoc.[Id Tipo de Documento]
INNER JOIN [Estado Entidad] AS EstaEnt
  ON EntIII.[Id Estado Entidad] = EstaEnt.[Id Estado Entidad]
INNER JOIN [Tipo Entidad] AS TipoEnt
  ON EntIII.[Id Tipo Entidad] = TipoEnt.[Id Tipo Entidad]
WHERE (Ent.[Nombre Completo Entidad] LIKE '%[^ ]%')
  AND (FunEnt.[Id Función] = 3);
GO

-- =============================================================================
-- Lite Cnsta Empresa
-- Usado por: GET /company, GET /company/:doc, resolveDocumentoEmpresa
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta Empresa]
AS
SELECT em.[Documento Empresa] AS DocumentoEmpresa,
       em.[Nombre Comercial Empresa] AS NombreComercialEmpresa,
       em.[Nombre Comercial Empresa] AS NombreEmpresa,
       em3.[Dirección EmpresaIII] AS DireccionEmpresa,
       em3.[Teléfono No 1 EmpresaIII] AS TelefonoEmpresa,
       em3.[E-mail 1 EmpresaIII] AS CorreoEmpresa
FROM Empresa AS em
LEFT JOIN EmpresaIII AS em3
  ON em.[Documento Empresa] = em3.[Documento Empresa];
GO

-- =============================================================================
-- Lite Cnsta UsuarioPerfil
-- Usado por: GET /auth/me (sin columna de contraseña)
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta UsuarioPerfil]
AS
SELECT Contraseña.[Nombre de Usuario] AS username,
       en.[Documento Entidad] AS documentoEntidad,
       en.[Nombre Completo Entidad] AS nombreUsuario,
       en.[Primer Nombre Entidad] AS primerNombre,
       en.[Segundo Nombre Entidad] AS segundoNombre,
       en.[Primer Apellido Entidad] AS primerApellido,
       en.[Segundo Apellido Entidad] AS segundoApellido,
       NULLIF(LTRIM(RTRIM(en2.[E-mail Nro 1 EntidadII])), '') AS email,
       COALESCE(
         NULLIF(LTRIM(RTRIM(en2.[Teléfono Celular EntidadII])), ''),
         NULLIF(LTRIM(RTRIM(en2.[Teléfono No 1 EntidadII])), '')
       ) AS telefono,
       en.[Foto Entidad] AS foto,
       Contraseña.[Id Nivel] AS idNivel
FROM Contraseña
INNER JOIN Entidad AS en
  ON Contraseña.[Documento Entidad] = en.[Documento Entidad]
LEFT JOIN EntidadII AS en2
  ON en.[Documento Entidad] = en2.[Documento Entidad];
GO

-- =============================================================================
-- Lite Cnsta TipoEvaluacion
-- Usado por: GET /evolucion/tipos-evaluacion
-- [Tipo de Evaluación] no tiene Id Estado: se listan todos los tipos.
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta TipoEvaluacion]
AS
SELECT [Id Tipo de Evaluación],
       [Tipo de Evaluación],
       [Descripción Tipo de Evaluación]
FROM [Tipo de Evaluación];
GO

-- =============================================================================
-- Lite Cnsta AgendaCitas
-- Fuente: dbo.CompromisoVI (citas).
-- Usado por: GET /api/v1/agenda/citas?fecha=yyyy-MM-dd
--
-- ColorTipo: decimal OLE/BGR de [Tipo Compromiso].[Descripción Tipo Compromiso]
-- (p. ej. 65535 = amarillo). Front: R = n & 255, G = (n >> 8) & 255, B = (n >> 16) & 255.
--
-- Nest (AgendaService.listCitasDelDia):
--   SELECT IdCita, Fecha, HoraInicio, Hora, HoraFin, IdEstado,
--          IdTipoCompromiso, TipoCompromiso, ColorTipo,
--          DocumentoPaciente, NombrePaciente,
--          DocumentoProfesional, NombreProfesional,
--          Motivo, Estado
--   FROM dbo.[Lite Cnsta AgendaCitas]
--   WHERE Fecha >= CONVERT(datetime, @0, 120)   -- 'yyyy-MM-dd 00:00:00'
--     AND Fecha <  CONVERT(datetime, @1, 120)   -- día siguiente 00:00:00
--   ORDER BY NombreProfesional, HoraInicio, IdCita
--
-- Choque al crear (POST /agenda/citas). Canceladas: 60, 61, 64, 71.
--   SELECT TOP 1 [Id CompromisoVI]
--   FROM dbo.CompromisoVI
--   WHERE LTRIM(RTRIM([Entidad Responsable])) = LTRIM(RTRIM(@profesional))
--     AND [Fecha Inicio CompromisoVI] >= CONVERT(datetime, @desde, 120)
--     AND [Fecha Inicio CompromisoVI] < CONVERT(datetime, @hastaExcl, 120)
--     AND ISNULL([Id Estado], 0) NOT IN (60, 61, 64, 71)
--     AND CONVERT(time, [Hora Inicio CompromisoVI]) < CONVERT(time, @horaFin)
--     AND CONVERT(time, ISNULL([Hora Fin CompromisoVI], [Hora Inicio CompromisoVI]))
--         > CONVERT(time, @horaInicio)
--     AND (@idCita IS NULL OR [Id CompromisoVI] <> @idCita)  -- PATCH: no chocar consigo
--
-- Alta (POST /agenda/citas). Id Estado 58 = Vigente. Horas: 1899-12-30 + HH:mm.
-- Duración = horaInicio/horaFin del cliente (sin default de 30 min).
--   INSERT INTO dbo.CompromisoVI (
--     [Entidad Principal], [Entidad Responsable], [Descripción CompromisoIV],
--     [Fecha Inicio CompromisoVI], [Fecha Fin CompromisoVI],
--     [Hora Inicio CompromisoVI], [Hora Fin CompromisoVI],
--     [Id Tipo Compromiso], [Entidad Atendida], [Entidad Que Atendio],
--     [Fecha Digitacián CompromisoVI], [Id Estado],
--     [Documento Personal], [Documento Empresa]
--   )
--   OUTPUT INSERTED.[Id CompromisoVI]
--   VALUES (
--     @paciente, @profesional, @motivo,
--     @fecha00, @fecha00, @horaIni, @horaFin,
--     @idTipo, @paciente, @profesional,
--     SYSUTCDATETIME(), 58, @usuarioJwt, @empresa
--   )
--
-- Edición (PATCH /agenda/citas/:id). Duración = horaInicio/horaFin del cliente (sin default de 30 min).
--   UPDATE dbo.CompromisoVI
--   SET [Entidad Principal] = @paciente, [Entidad Responsable] = @profesional,
--       [Descripción CompromisoIV] = @motivo,
--       [Fecha Inicio CompromisoVI] = @fecha00, [Fecha Fin CompromisoVI] = @fecha00,
--       [Hora Inicio CompromisoVI] = @horaIni, [Hora Fin CompromisoVI] = @horaFin,
--       [Id Tipo Compromiso] = @idTipo,
--       [Entidad Atendida] = @paciente, [Entidad Que Atendio] = @profesional
--   WHERE [Id CompromisoVI] = @idCita
--   DELETE FROM dbo.CompromisoVII WHERE [Id CompromisoVI] = @idCita
--   INSERT INTO dbo.CompromisoVII ([Id CompromisoVI], [Código Objeto]) VALUES (...)
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta AgendaCitas]
AS
SELECT c.[Id CompromisoVI] AS IdCita,
       c.[Fecha Inicio CompromisoVI] AS Fecha,
       c.[Hora Inicio CompromisoVI] AS HoraInicio,
       FORMAT(c.[Hora Inicio CompromisoVI], 'HH:mm') AS Hora,
       c.[Hora Fin CompromisoVI] AS HoraFinDt,
       FORMAT(c.[Hora Fin CompromisoVI], 'HH:mm') AS HoraFin,
       c.[Id Estado] AS IdEstado,
       c.[Id Tipo Compromiso] AS IdTipoCompromiso,
       tc.[Tipo Compromiso] AS TipoCompromiso,
       TRY_CAST(tc.[Descripción Tipo Compromiso] AS int) AS ColorTipo,
       c.[Entidad Atendida] AS DocumentoPaciente,
       pac.[Nombre Completo Entidad] AS NombrePaciente,
       c.[Entidad Responsable] AS DocumentoProfesional,
       pro.[Nombre Completo Entidad] AS NombreProfesional,
       c.[Descripción CompromisoIV] AS Motivo,
       est.Estado AS Estado
FROM dbo.CompromisoVI AS c
LEFT JOIN dbo.Entidad AS pac
  ON c.[Entidad Atendida] = pac.[Documento Entidad]
LEFT JOIN dbo.Entidad AS pro
  ON c.[Entidad Responsable] = pro.[Documento Entidad]
LEFT JOIN dbo.Estado AS est
  ON c.[Id Estado] = est.[Id Estado]
LEFT JOIN dbo.[Tipo Compromiso] AS tc
  ON c.[Id Tipo Compromiso] = tc.[Id Tipo Compromiso];
GO

-- =============================================================================
-- Lite Cnsta AgendaProfesional
-- Función 17 = Profesional.
-- Usado por: GET /api/v1/agenda/profesionales
--
-- Nest:
--   SELECT DocumentoProfesional, NombreProfesional
--   FROM dbo.[Lite Cnsta AgendaProfesional]
--   ORDER BY NombreProfesional
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta AgendaProfesional]
AS
SELECT DISTINCT Ent.[Documento Entidad] AS DocumentoProfesional,
       Ent.[Nombre Completo Entidad] AS NombreProfesional
FROM Entidad AS Ent
INNER JOIN [Función Por Entidad] AS FunEnt
  ON Ent.[Documento Entidad] = FunEnt.[Documento Entidad]
WHERE FunEnt.[Id Función] = 17
  AND (Ent.[Nombre Completo Entidad] LIKE '%[^ ]%');
GO

-- =============================================================================
-- Lite Cnsta AgendaTipoCompromiso
-- Color OLE/BGR en [Descripción Tipo Compromiso] (p. ej. 65535 = amarillo).
-- Front: R = n & 255, G = (n >> 8) & 255, B = (n >> 16) & 255.
-- Usado por: GET /api/v1/agenda/tipos-compromiso
--
-- Nest:
--   SELECT IdTipoCompromiso, TipoCompromiso, ColorTipo
--   FROM dbo.[Lite Cnsta AgendaTipoCompromiso]
--   ORDER BY IdTipoCompromiso
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta AgendaTipoCompromiso]
AS
SELECT [Id Tipo Compromiso] AS IdTipoCompromiso,
       [Tipo Compromiso] AS TipoCompromiso,
       TRY_CAST([Descripción Tipo Compromiso] AS int) AS ColorTipo
FROM dbo.[Tipo Compromiso];
GO

-- =============================================================================
-- Lite Cnsta AgendaProcedimientos
-- Catálogo dbo.Objeto. Tiempo en [Duración Aproximada Objeto] (minutos).
-- Usado por: GET /api/v1/agenda/procedimientos?q=
--
-- Nest (AgendaService.listProcedimientos): TOP 40 en el SELECT, no en la vista.
--   SELECT TOP 40 CodigoObjeto, DescripcionObjeto, TiempoMinutos, UnidadTiempo
--   FROM dbo.[Lite Cnsta AgendaProcedimientos]
--   WHERE (@q vacío) OR Código/Descripción LIKE '%' + @q + '%'
--   ORDER BY CodigoObjeto
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta AgendaProcedimientos]
AS
SELECT o.[Código Objeto] AS CodigoObjeto,
       o.[Descripción Objeto] AS DescripcionObjeto,
       ISNULL(o.[Duración Aproximada Objeto], 0) AS TiempoMinutos,
       ut.[Unidad Tiempo] AS UnidadTiempo
FROM dbo.Objeto AS o
LEFT JOIN dbo.[Unidad Tiempo] AS ut
  ON o.[Id Unidad Tiempo] = ut.[Id Unidad Tiempo]
WHERE o.[Id Estado] = 1;
GO

-- =============================================================================
-- Lite Cnsta AgendaCitaProcedimientos
-- Líneas dbo.CompromisoVII (Código Objeto por Id CompromisoVI).
-- Usado por: GET /api/v1/agenda/citas (detalle de cada cita)
--
-- Nest:
--   SELECT IdCita, CodigoObjeto, TiempoMinutos, UnidadTiempo, DescripcionObjeto
--   FROM dbo.[Lite Cnsta AgendaCitaProcedimientos]
--   WHERE IdCita IN (...)
--
-- Alta de líneas (POST /agenda/citas) tras INSERT CompromisoVI:
--   INSERT INTO dbo.CompromisoVII ([Id CompromisoVI], [Código Objeto])
--   VALUES (@idCita, @codigoObjeto)
-- =============================================================================
CREATE OR ALTER VIEW dbo.[Lite Cnsta AgendaCitaProcedimientos]
AS
SELECT v.[Id CompromisoVI] AS IdCita,
       v.[Código Objeto] AS CodigoObjeto,
       ISNULL(o.[Duración Aproximada Objeto], 0) AS TiempoMinutos,
       ut.[Unidad Tiempo] AS UnidadTiempo,
       o.[Descripción Objeto] AS DescripcionObjeto
FROM dbo.CompromisoVII AS v
LEFT JOIN dbo.Objeto AS o
  ON LTRIM(RTRIM(v.[Código Objeto])) = LTRIM(RTRIM(o.[Código Objeto]))
LEFT JOIN dbo.[Unidad Tiempo] AS ut
  ON o.[Id Unidad Tiempo] = ut.[Id Unidad Tiempo];
GO

