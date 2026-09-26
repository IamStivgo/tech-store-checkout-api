import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { toDepartments, type DivipolaRow } from './coverage/divipola';

const DATASET_URL = 'https://www.datos.gov.co/resource/gdxc-w37w.json';
const DATASET_PAGE = 'https://www.datos.gov.co/d/gdxc-w37w';
const MAX_ROWS = 5000;
const COVERAGE_FILE = join(
  __dirname,
  '..',
  'src',
  'modules',
  'coverage',
  'infrastructure',
  'coverage-data.json',
);

const fetchMunicipalities = async (): Promise<DivipolaRow[]> => {
  const url = `${DATASET_URL}?$select=cod_dpto,dpto,cod_mpio,nom_mpio&$limit=${MAX_ROWS}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`DIVIPOLA download failed with HTTP ${response.status}`);
  }
  return (await response.json()) as DivipolaRow[];
};

/**
 * Refreshes only the departments and cities of coverage-data.json from DIVIPOLA (DANE);
 * zones, rates and overrides are edited by hand and kept untouched.
 */
const main = async (): Promise<void> => {
  const current = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8')) as Record<string, unknown>;
  const departments = toDepartments(await fetchMunicipalities());

  const updated = {
    ...current,
    source: {
      name: 'DIVIPOLA - Códigos municipios',
      publisher: 'Departamento Administrativo Nacional de Estadística (DANE)',
      url: DATASET_PAGE,
      license: 'CC BY-SA 4.0',
      retrievedAt: new Date().toISOString().slice(0, 10),
    },
    departments,
  };

  writeFileSync(COVERAGE_FILE, `${JSON.stringify(updated, null, 2)}\n`);

  const cities = departments.reduce((total, department) => total + department.cities.length, 0);
  console.log(`Wrote ${departments.length} departments and ${cities} cities to ${COVERAGE_FILE}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
