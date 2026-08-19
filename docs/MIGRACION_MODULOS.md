# Plantillas de migración de módulos (NestJS)

Este documento resume cómo portar dominios del Express actual (**CeereLite**, proyecto legacy separado) al backend `back/` sin romper bases de clientes existentes.

## Principios

1. **Un módulo Nest por dominio**: `EvolucionModule`, `RipsModule`, `FacturacionModule`, etc.
2. **Contrato estable (DTOs de salida)**: las pantallas del nuevo `front/` no deben depender de nombres de columna SQL.
3. **SQL legacy encapsulado**: usar `DataSource.query` o `QueryRunner` con parámetros (`@0`, `@1`, …) en un `*Repository` o `*Service` dedicado; evitar duplicar consultas en controladores.
4. **Sin `synchronize: true`** en TypeORM contra bases de clientes.

## Orden sugerido (después del MVP Auth / Usuarios / Empresa)

### 1. Evolución clínica

**Referencia Express:** rutas bajo `server/routes/Evolucion/` (evoluciones, formatos, imágenes, listas RIPS).

**Plantilla Nest:**

```text
src/evolucion/
  evolucion.module.ts
  evolucion.controller.ts      → prefijo /api/v1/evolucion
  evolucion.service.ts         → orquestación
  evolucion.queries.ts         → strings SQL o funciones que devuelven SQL + params
  dto/
    *.dto.ts                   → entrada/salida validada
```

**Checklist**

- [ ] Inventariar endpoints usados por `src/components/Evolucion/` en el front legacy.
- [ ] Por cada endpoint: mismo JSON de respuesta o mapeo documentado en DTO.
- [ ] Archivos estáticos (formatos HTML/PDF): decidir `ServeStaticModule` vs lectura desde disco en servicio.

### 2. Relacionador RIPS

**Referencia Express:** `server/routes/Relacionador_Rips/`, `server/routes/Evolucion/ListasRIPS/`.

**Plantilla Nest:**

```text
src/rips/
  rips.module.ts
  rips.controller.ts
  rips.service.ts
  catalog/
                            → catálogos (modalidad, grupo servicio, etc.)
  generation/
                            → ZIP / JSON / validación Ministerio
```

**Checklist**

- [ ] Separar **lectura de catálogos** de **generación de archivos** (puede ser async más adelante).
- [ ] Parametrizar siempre `documentoEmpresa`, fechas y filtros por usuario autenticado (`JwtPayload.documentoEntidad` donde aplique).

### 3. Facturación

**Referencia Express:** `server/routes/Facturacion/`, `CrearResolucion`, resoluciones, productos.

**Plantilla Nest:**

```text
src/facturacion/
  facturacion.module.ts
  facturacion.controller.ts
  factura.service.ts
  resolucion.service.ts
  productos.service.ts
  dto/
```

**Checklist**

- [ ] Transacciones (`QueryRunner`) para alta de factura + ítems en una sola operación donde el legacy lo requiera.
- [ ] XML / DIAN: mantener lógica actual en un `XmlFacturacionService` aislado para pruebas.

## Convenciones de API

- Prefijo global: `/api/v1`.
- Health: `/health`, `/health/db` (sin versión).
- Autenticación: header `Authorization: Bearer <jwt>`.

## Próximo paso práctico

Elegir el primer subárea (por ejemplo solo `evoluciones` listado + detalle) y migrar un flujo vertical (endpoint + pantalla mínima en `front/`) antes de copiar el resto.
