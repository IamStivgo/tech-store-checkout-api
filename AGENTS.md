# AGENTS.md

Guidance for AI coding assistants working in this repository.

## Project

Checkout API for a tech accessories store: product catalog, delivery pricing, customers, transactions and credit card payments through a third-party payment provider (sandbox only). Built with NestJS 11, TypeScript (strict), DynamoDB and AWS Lambda.

## Architecture rules

- Hexagonal architecture per business module: `src/modules/<module>/{domain,application,infrastructure}`.
- Dependency direction: `infrastructure → application → domain`. Never the other way.
- `domain/` and `application/` must not import any npm package or Node module (`@nestjs/*`, the AWS SDK, `zod`, `node:crypto`…). Use cases are plain classes that receive ports through the constructor; wiring happens in infrastructure with `useFactory`. These rules are enforced by `npm run lint:deps`; do not relax them.
- Railway Oriented Programming: business errors are returned as typed `Result`/`ResultAsync` values (`src/shared/domain`). Do not `throw` for business rules; exceptions are only for unexpected failures.
- Controllers only map DTO → command, call the use case and map the `Result` to HTTP (Problem Details, RFC 9457).
- All money amounts are integers in cents and are always computed on the server.

## Code conventions

- Identifiers, code, comments and commit messages in English. The README is in Spanish.
- File names in `kebab-case` with a role suffix: `.entity.ts`, `.vo.ts`, `.port.ts`, `.use-case.ts`, `.controller.ts`, `.dto.ts`, `.adapter.ts`, `.mapper.ts`, `.response.ts`, `.openapi.ts`, `.spec.ts`.
- No `export default`, no `any`, `readonly` by default, small functions, no magic numbers.
- Comments only for non-obvious constraints.

## Testing

- Jest. Tests are written alongside the implementation, following the AAA pattern, with names that describe behavior.
- Unit tests use no real network or AWS: in-memory repositories, `aws-sdk-client-mock`, mocked `fetch`, fake clock and id generator.
- Coverage gates: statements, lines and functions ≥ 85 %, branches ≥ 81 %.

## Security and compliance (mandatory)

- Never write the name of the company that proposed this exercise anywhere in the repository: code, comments, configuration, commit messages, branch names or docs. Refer to it as "payment provider".
- Never commit secrets, keys or real provider URLs; use placeholders and `.env` (git-ignored).
- The card number (PAN) and CVC never reach this API; cards are tokenized in the browser.
- Never log personal data, tokens or secrets.

## Commands

```bash
nvm use                         # Node.js 24
npm ci
docker compose up -d dynamodb   # DynamoDB Local on 127.0.0.1:8000
npm test                        # Jest with coverage gates
npm run typecheck
npm run lint
npm run lint:deps               # hexagonal rules (dependency-cruiser)
npm run format:check
npm run package:lambda          # webpack bundle → dist-lambda/{lambda,reconcile}.js + dist-lambda.zip
npm run build:api-docs          # static Swagger UI → dist-api-docs/ (published under /api-docs/)
npm run test:artifacts          # smoke tests of dist-lambda/ and dist-api-docs/ (node:test)
npm run openapi:export          # regenerate docs/openapi.json after any API change
```

## OpenAPI contract

- `docs/openapi.json` is the contract the web repository generates its types from. It is generated from the controllers (`npm run openapi:export`) and committed; `test/api/openapi.api.spec.ts` fails when it is out of date.
- Document every endpoint with `@ApiTags`, `@ApiOperation`, `@ApiOkResponse` and `ApiProblemResponses(...)` (errors are Problem Details).
- Response schemas are classes in `*.openapi.ts` that `implements` the response interface (`*.response.ts` or presenter types) and use `@ApiSchema({ name })`, so TypeScript keeps docs and code in sync. Keep response interfaces out of controllers to avoid import cycles.

## Lambda bundle

- `webpack.lambda.config.mjs` bundles `src/lambda.ts` and `src/reconcile.handler.ts` into self-contained `lambda.js` and `reconcile.js` at the zip root. The infrastructure configures the handlers `lambda.handler` and `reconcile.handler`: keep the file names and the `handler` exports.
- Do not add lazily-required Nest integrations or packages that load files at runtime without checking `npm run test:artifacts`. New webpack warnings are errors to investigate, not noise: only the known optional requires are ignored.
- The bundle is not minified on purpose (readable class names in logs). Cold start measured at ~0.4 s `Init Duration`.

## Git workflow

- Branches: `main` (stable), `develop` (integration), `feature/HU-xxx-description`.
- Conventional Commits, enforced by commitlint; lint-staged runs ESLint and Prettier on staged files.
- The developer creates branches and commits; assistants propose changes and commit messages.
