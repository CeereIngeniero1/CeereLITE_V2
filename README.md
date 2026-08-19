# Nuevo CeereLite — monorepo (Nest + React)

## Estructura

- `back/` — API **NestJS** + **TypeORM** + SQL Server (`/api/v1/...`, health en raíz).
- `front/` — SPA **React** + **Vite** (JS).

## Requisitos

- Node 18+
- SQL Server (Express 2014+ u otra instancia accesible en red local).

## Configuración

1. Copia `back/.env.example` → `back/.env` y ajusta `DB_*`, `JWT_SECRET`, y opcionalmente `STATIC_IMAGES_PATH` (carpeta de fotos, igual que en CeereLite).
2. Copia `front/.env.example` → `front/.env` si el API no está en `http://localhost:3001`:

   ```env
   VITE_API_BASE_URL=http://localhost:3001
   ```

## Arranque en desarrollo

Terminal 1 — API:

```bash
cd back
npm run start:dev
```

- `GET http://localhost:3001/health`
- `GET http://localhost:3001/health/db`
- `POST http://localhost:3001/api/v1/auth/login` body: `{ "username", "password" }`

Terminal 2 — Front:

```bash
cd front
npm run dev
```

Abre la URL que indique Vite (por defecto `http://localhost:5173`). La app usa rutas `/principal/...` (sidebar al estilo CeereLite); solo **Inicio** tiene datos reales por ahora, el resto son placeholders para migración.

## Endpoints MVP (v1)

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/api/v1/auth/login` | No |
| GET | `/api/v1/auth/me` | JWT |
| GET | `/api/v1/users` | JWT |
| GET | `/api/v1/company` | JWT |
| GET | `/api/v1/company/:docEmpresa` | JWT |

La lógica de login y consultas replica el comportamiento del Express actual en `CeereLite` (tablas `Contraseña`, `Entidad`, `Empresa`, etc.).

## Migración de módulos

Ver [docs/MIGRACION_MODULOS.md](docs/MIGRACION_MODULOS.md) para plantillas y orden sugerido (Evolución, RIPS, Facturación).
