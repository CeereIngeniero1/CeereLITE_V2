# back (NestJS)

Ver [.env.example](.env.example) y el [README del monorepo](../README.md).

## Comandos

- `npm run start:dev` — desarrollo con watch
- `npm run build` — compilación
- `npm run start:prod` — ejecutar `dist/main.js` (tras `build`)

## Notas

- Health sin prefijo: `/health`, `/health/db`
- API versionada: `/api/v1/...`
- Fotos pacientes: `STATIC_IMAGES_PATH` + `GET /static-images/...` (same origin que el API)

## Vistas SQL (CeereLITE)

Las lecturas con JOIN viven en vistas de SQL Server. El script acumulativo es [sql/instalar-actualizar.sql](sql/instalar-actualizar.sql); hay que ejecutarlo a mano en la base (el API no lo corre).

Nombre: `Lite Cnsta {Nombre}` → `dbo.[Lite Cnsta HcHistorial]`. No usar `vw_Lite`.

Al agregar una consulta: primero el `CREATE OR ALTER VIEW` en ese archivo, después el `SELECT … FROM dbo.[Lite Cnsta …]` en el servicio Nest, y volver a ejecutar el script en SQL Server.

## Agenda

- `GET /api/v1/agenda/citas?fecha=yyyy-MM-dd` (JWT) — citas del día desde `dbo.CompromisoVI` vía `dbo.[Lite Cnsta AgendaCitas]`.
- `GET /api/v1/agenda/profesionales` — catálogo función 17 (`dbo.[Lite Cnsta AgendaProfesional]`).
- `GET /api/v1/agenda/tipos-compromiso` — tipos y color OLE (`dbo.[Lite Cnsta AgendaTipoCompromiso]`).
- `GET /api/v1/agenda/procedimientos?q=` — TOP 40 de `dbo.Objeto` vía `dbo.[Lite Cnsta AgendaProcedimientos]`.
- `POST /api/v1/agenda/citas` — alta en `CompromisoVI` y líneas en `CompromisoVII`. `horaFin` = suma de tiempos (si la suma es 0, 30 min). 409 si el horario se cruza (no cuentan estados 60, 61, 64, 71). `idTipoCompromiso` y cada `codigosObjeto` deben existir en catálogo.

SELECT del día:

```sql
SELECT IdCita, Fecha, HoraInicio, Hora, HoraFin, IdEstado,
       IdTipoCompromiso, TipoCompromiso, ColorTipo,
       DocumentoPaciente, NombrePaciente,
       DocumentoProfesional, NombreProfesional,
       Motivo, Estado
FROM dbo.[Lite Cnsta AgendaCitas]
WHERE Fecha >= CONVERT(datetime, @0, 120)
  AND Fecha < CONVERT(datetime, @1, 120)
ORDER BY NombreProfesional, HoraInicio, IdCita
```

Choque:

```sql
SELECT TOP 1 [Id CompromisoVI]
FROM dbo.CompromisoVI
WHERE LTRIM(RTRIM([Entidad Responsable])) = LTRIM(RTRIM(@profesional))
  AND [Fecha Inicio CompromisoVI] >= CONVERT(datetime, @desde, 120)
  AND [Fecha Inicio CompromisoVI] < CONVERT(datetime, @hastaExcl, 120)
  AND ISNULL([Id Estado], 0) NOT IN (60, 61, 64, 71)
  AND CONVERT(time, [Hora Inicio CompromisoVI]) < CONVERT(time, @horaFin)
  AND CONVERT(time, ISNULL([Hora Fin CompromisoVI], [Hora Inicio CompromisoVI]))
      > CONVERT(time, @horaInicio)
```

Catálogo de tipos (`GET /agenda/tipos-compromiso`):

```sql
SELECT IdTipoCompromiso, TipoCompromiso, ColorTipo
FROM dbo.[Lite Cnsta AgendaTipoCompromiso]
ORDER BY IdTipoCompromiso
```

`ColorTipo` es el decimal OLE/BGR de `[Tipo Compromiso].[Descripción Tipo Compromiso]` (p. ej. `65535` = amarillo). En el front: `R = n & 255`, `G = (n >> 8) & 255`, `B = (n >> 16) & 255`.

Procedimientos (`GET /agenda/procedimientos`):

```sql
SELECT TOP 40 CodigoObjeto, DescripcionObjeto, TiempoMinutos, UnidadTiempo
FROM dbo.[Lite Cnsta AgendaProcedimientos]
ORDER BY CodigoObjeto
```

Líneas de una cita:

```sql
SELECT IdCita, CodigoObjeto, TiempoMinutos, UnidadTiempo, DescripcionObjeto
FROM dbo.[Lite Cnsta AgendaCitaProcedimientos]
WHERE IdCita IN (...)
```

El INSERT de `CompromisoVI` / `CompromisoVII` está comentado junto a las vistas en [sql/instalar-actualizar.sql](sql/instalar-actualizar.sql). Tras cambiar vistas, ejecutar de nuevo ese script en SQL Server.

## Impresión HC

El pie **Impreso por CeereSio** se agrega en historial, evolución de texto y formato abierto. La URL `localhost:5173/...` la pone el navegador: en el diálogo de impresión desmarcar **Encabezados y pies de página**.
