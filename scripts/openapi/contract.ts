import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/** Committed contract: the web repository generates its API types from this file. */
export const OPENAPI_FILE = join(ROOT, 'docs', 'openapi.json');

/** The contract version follows the package version, bumped on each release. */
export const contractVersion = (): string =>
  (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;
