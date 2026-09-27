import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { OPENAPI_TITLE } from '../src/shared/infrastructure/http/openapi/openapi-document';

import { OPENAPI_FILE } from './openapi/contract';

// Static Swagger UI published by the deploy workflow under /api-docs/ of the CloudFront
// distribution, so the Lambda never serves documentation assets.
const OUT_DIR = join(__dirname, '..', 'dist-api-docs');
const SWAGGER_UI_DIR = dirname(require.resolve('swagger-ui-dist/package.json'));
const SWAGGER_UI_FILES = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'favicon-32x32.png',
  'favicon-16x16.png',
  'LICENSE',
  'NOTICE',
];

// The /api-docs/* Content-Security-Policy only allows scripts from 'self': no inline scripts.
const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${OPENAPI_TITLE}</title>
    <link rel="stylesheet" href="./swagger-ui.css" />
    <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="./swagger-ui-bundle.js"></script>
    <script src="./swagger-initializer.js"></script>
  </body>
</html>
`;

// validatorUrl: null keeps Swagger UI from calling an external validator (blocked by the CSP).
const INITIALIZER_JS = `window.addEventListener('load', () => {
  window.ui = SwaggerUIBundle({
    url: './openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    validatorUrl: null,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout',
  });
});
`;

const main = (): void => {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  for (const file of SWAGGER_UI_FILES) {
    copyFileSync(join(SWAGGER_UI_DIR, file), join(OUT_DIR, file));
  }
  copyFileSync(OPENAPI_FILE, join(OUT_DIR, 'openapi.json'));
  writeFileSync(join(OUT_DIR, 'index.html'), INDEX_HTML);
  writeFileSync(join(OUT_DIR, 'swagger-initializer.js'), INITIALIZER_JS);

  console.log(`API docs written to ${OUT_DIR}`);
};

main();
