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
