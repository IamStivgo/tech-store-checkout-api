# Tech Store — API (checkout con tarjeta de crédito)

| Repositorio                                                                         | Contenido                                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [tech-store-checkout-web](https://github.com/IamStivgo/tech-store-checkout-web)     | Frontend: SPA React                                               |
| [tech-store-checkout-api](https://github.com/IamStivgo/tech-store-checkout-api)     | Backend: API NestJS, Swagger y modelo de datos (este repositorio) |
| [tech-store-checkout-infra](https://github.com/IamStivgo/tech-store-checkout-infra) | Infraestructura: Terraform y despliegue en AWS                    |

API serverless en NestJS con arquitectura hexagonal y Railway Oriented Programming para una tienda de accesorios tecnológicos: catálogo, cotización de envío, clientes, transacciones y pagos con tarjeta a través de una pasarela de pagos en modo sandbox.

> Proyecto en construcción. Este README se completa a medida que avanza la implementación.

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

`docker compose down -v` detiene DynamoDB Local y borra sus datos.

## Flujo de trabajo

- Ramas: `main` (estable), `develop` (integración) y `feature/HU-xxx-descripcion`.
- Commits en inglés con [Conventional Commits](https://www.conventionalcommits.org/), validados por commitlint.
- Antes de cada commit, lint-staged ejecuta ESLint y Prettier sobre los archivos modificados.
