# Tech Store — API (checkout con tarjeta de crédito)

| Repositorio                                                                         | Contenido                                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [tech-store-checkout-web](https://github.com/IamStivgo/tech-store-checkout-web)     | Frontend: SPA React                                               |
| [tech-store-checkout-api](https://github.com/IamStivgo/tech-store-checkout-api)     | Backend: API NestJS, Swagger y modelo de datos (este repositorio) |
| [tech-store-checkout-infra](https://github.com/IamStivgo/tech-store-checkout-infra) | Infraestructura: Terraform y despliegue en AWS                    |

API serverless en NestJS con arquitectura hexagonal y Railway Oriented Programming para una tienda de accesorios tecnológicos: catálogo, cotización de envío, clientes, transacciones y pagos con tarjeta a través de una pasarela de pagos en modo sandbox.

> Proyecto en construcción. Este README se completa a medida que avanza la implementación.

## Estado de la entrega

- **API en producción:** https://d7vch0fsx8645.cloudfront.net/api/v1 (health en `/api/v1/health`). **Swagger UI:** https://d7vch0fsx8645.cloudfront.net/api-docs/index.html. El contrato versionado está en `docs/openapi.json`.
- **Publicado en producción (`v0.2.0`):** catálogo y stock, cobertura DIVIPOLA, cotización (tarifa de servicio + envío por zona y peso + envío gratis) y clientes con idempotencia (`Idempotency-Key`) y datos enmascarados.
- **Implementado en `develop`:**
  - transacciones con reserva de stock atómica (DynamoDB `TransactWriteItems`);
  - cancelación;
  - integración con la pasarela de pagos (tokens de aceptación, firma de integridad, pago y consulta);
  - procesamiento del pago con asignación de la entrega;
  - endurecimiento HTTP (helmet, límite de 16 KB, 415).
- **Credenciales del sandbox:**
  - probadas contra la pasarela: 4242 → `APPROVED`, 4111 → `DECLINED`;
  - las llaves privadas viven en AWS SSM (SecureString), nunca en el repositorio.
- **Pendiente:**
  - endpoint `POST /transactions/{id}/payment`;
  - webhook y conciliación programada;
  - variables de la pasarela en la Lambda y release `v0.3.0`.
- **Calidad:**
  - 626 pruebas (unitarias y HTTP): ~99 % de statements, ~91 % de ramas;
  - reglas hexagonales verificadas con dependency-cruiser;
  - smoke tests del bundle de Lambda.

## Stack

| Componente   | Elección                               |
| ------------ | -------------------------------------- |
| Runtime      | Node.js 24                             |
| Framework    | NestJS 11 + TypeScript (modo estricto) |
| Persistencia | Amazon DynamoDB (AWS SDK v3)           |
| Despliegue   | AWS Lambda + API Gateway               |
| Pruebas      | Jest                                   |

## Estructura

```
src/
├── config/              # Configuración tipada y validada
├── shared/              # Kernel compartido (domain, application, infrastructure)
└── modules/             # Un módulo por contexto de negocio
    └── <módulo>/
        ├── domain/          # Entidades, value objects y puertos (sin dependencias externas)
        ├── application/     # Casos de uso
        └── infrastructure/  # Adaptadores: HTTP, DynamoDB, pasarela de pagos
scripts/                 # Seed, exportación de OpenAPI y utilidades
seed/                    # Catálogo semilla
docs/                    # OpenAPI y colección Postman
test/                    # Pruebas de API, builders y fakes
```

## Ejecución local

Requisitos: Node.js 24 (`nvm use`) y Docker.

```bash
npm ci
cp .env.example .env
docker compose up -d dynamodb   # DynamoDB Local en 127.0.0.1:8000
npm run db:create-tables        # Crea las tablas en DynamoDB Local
npm run seed                    # Carga el catálogo de 10 productos
npm run start:dev               # http://localhost:3000/api/v1/products
```

| Script                          | Descripción                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run start:dev`             | Servidor local con recarga y logs legibles                                                                                                      |
| `npm run db:create-tables`      | Crea las tablas en DynamoDB Local; se puede repetir sin problemas. Solo funciona con `DYNAMODB_ENDPOINT` (en AWS las tablas las crea Terraform) |
| `npm run seed`                  | Carga o actualiza el catálogo de `seed/products.json` sin reiniciar el stock de los productos existentes                                        |
| `npm run seed -- --reset-stock` | Igual, pero reinicia el stock al valor inicial del seed                                                                                         |
| `npm test`                      | Pruebas con cobertura (umbrales: 85 % statements, lines y functions; 81 % branches)                                                             |
| `npm run typecheck`             | Verificación de tipos con TypeScript                                                                                                            |
| `npm run lint`                  | ESLint con reglas estrictas de TypeScript                                                                                                       |
| `npm run lint:deps`             | Reglas de la arquitectura hexagonal con dependency-cruiser                                                                                      |
| `npm run format:check`          | Verifica el formato con Prettier                                                                                                                |
| `npm run format`                | Aplica el formato con Prettier                                                                                                                  |
| `npm run package:lambda`        | Bundle de webpack para Lambda: `dist-lambda/lambda.js` y `reconcile.js` (autocontenidos) y `dist-lambda.zip`                                    |
| `npm run build:api-docs`        | Genera Swagger UI estático en `dist-api-docs/` (se publica en `/api-docs/`)                                                                     |
| `npm run test:artifacts`        | Pruebas de humo del bundle de Lambda y del sitio de documentación ya generados                                                                  |
| `npm run openapi:export`        | Regenera el contrato `docs/openapi.json` desde los controladores (una prueba falla si quedó desactualizado)                                     |

`docker compose down -v` detiene DynamoDB Local y borra sus datos.

## Despliegue (GitHub Actions con OIDC, sin llaves de AWS)

La infraestructura (Lambdas, API Gateway, CloudFront, tablas y roles) vive en [tech-store-checkout-infra](https://github.com/IamStivgo/tech-store-checkout-infra); este repositorio solo despliega su código. Los nombres de los recursos se leen de los parámetros SSM `/checkout-app/prod/deploy/*`.

| Workflow      | Cuándo                                             | Qué hace                                                                                                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy.yml`  | Cuando el CI de `main` termina en verde (o manual) | Tras la aprobación del environment `production`: bundle y Swagger UI → nuevo código en las Lambdas `api` y `reconcile` → versión publicada y alias `live` movido → `api-docs/` en S3 e invalidación → prueba de `/api/v1/health` por CloudFront. Si la prueba falla, `live` vuelve a la versión anterior |
| `seed.yml`    | Manual                                             | Carga o actualiza el catálogo en producción (opción para reiniciar el stock)                                                                                                                                                                                                                             |
| `release.yml` | Tag `v*`                                           | Verifica que el tag coincida con la versión de `package.json` y del contrato y crea el release con `openapi.json` adjunto (el repositorio web genera sus tipos desde ahí)                                                                                                                                |

Configuración del repositorio: variable `AWS_REGION` y secrets `AWS_DEPLOY_ROLE_ARN` y `AWS_SEED_ROLE_ARN` (contienen el ID de la cuenta: como secrets se enmascaran en los logs). El endpoint `GET /api/v1/health` informa la versión desplegada (`<versión>+<commit>`).

## Flujo de trabajo

- Ramas: `main` (estable), `develop` (integración) y `feature/HU-xxx-descripcion`.
- Commits en inglés con [Conventional Commits](https://www.conventionalcommits.org/), validados por commitlint.
- Antes de cada commit, lint-staged ejecuta ESLint y Prettier sobre los archivos modificados.

## Datos de terceros

Los departamentos y municipios de `src/modules/coverage/infrastructure/coverage-data.json` provienen de [DIVIPOLA - Códigos municipios](https://www.datos.gov.co/d/gdxc-w37w), publicado por el Departamento Administrativo Nacional de Estadística (DANE) bajo la licencia [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Los nombres se convirtieron de mayúsculas a formato de título; los datos derivados conservan la misma licencia. `npm run coverage:build` los actualiza sin modificar las zonas ni las tarifas de envío.
