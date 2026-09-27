// Checks the static Swagger UI (dist-api-docs/), run after `npm run build:api-docs`. The site is
// served under a Content-Security-Policy that forbids inline scripts and external calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const DOCS_DIR = path.resolve(import.meta.dirname, '../../dist-api-docs');
const read = (file) => readFileSync(path.join(DOCS_DIR, file), 'utf8');

describe('API docs site', () => {
  it('publishes the committed contract', () => {
    const contract = readFileSync(
      path.resolve(import.meta.dirname, '../../docs/openapi.json'),
      'utf8',
    );

    assert.equal(read('openapi.json'), contract);
  });

  it('loads every script from its own origin, never inline', () => {
    const html = read('index.html');
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];

    assert.ok(scripts.length > 0);
    for (const [, attributes, body] of scripts) {
      assert.match(attributes, /src="\.\/[\w.-]+\.js"/);
      assert.equal(body.trim(), '');
    }
  });

  it('points Swagger UI to the local contract without the external validator', () => {
    const initializer = read('swagger-initializer.js');

    assert.match(initializer, /url: '\.\/openapi\.json'/);
    assert.match(initializer, /validatorUrl: null/);
  });

  it('ships every asset the page references', () => {
    const html = read('index.html');

    for (const [, asset] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) {
      assert.doesNotThrow(() => readFileSync(path.join(DOCS_DIR, asset)), `missing ${asset}`);
    }
  });
});
