/** Row of the DIVIPOLA municipalities dataset published by DANE on datos.gov.co. */
export interface DivipolaRow {
  readonly cod_dpto: string;
  readonly dpto: string;
  readonly cod_mpio: string;
  readonly nom_mpio: string;
}

export interface CityData {
  readonly code: string;
  readonly name: string;
}

export interface DepartmentData {
  readonly code: string;
  readonly name: string;
  readonly cities: readonly CityData[];
}

const CONNECTORS = new Set(['de', 'del', 'e', 'el', 'la', 'las', 'los', 'y']);
const KEPT_AS_IS = new Set(['D.C.']);

const capitalize = (word: string): string =>
  word.charAt(0).toLocaleUpperCase('es-CO') + word.slice(1).toLocaleLowerCase('es-CO');

const titleCaseWord = (word: string, isFirst: boolean): string => {
  if (KEPT_AS_IS.has(word)) {
    return word;
  }
  const lower = word.toLocaleLowerCase('es-CO');
  return !isFirst && CONNECTORS.has(lower) ? lower : capitalize(word);
};

/** "VALLE DEL CAUCA" → "Valle del Cauca", "BOGOTÁ, D.C." → "Bogotá, D.C.". Each " - " part starts a new name. */
export const toTitleCase = (name: string): string =>
  name
    .trim()
    .split(' - ')
    .map((part) =>
      part
        .split(/\s+/)
        .map((word, index) => titleCaseWord(word, index === 0))
        .join(' '),
    )
    .join(' - ');

const byCode = <T extends { readonly code: string }>(first: T, second: T): number =>
  first.code.localeCompare(second.code);

export const toDepartments = (rows: readonly DivipolaRow[]): DepartmentData[] => {
  const departments = new Map<string, { name: string; cities: CityData[] }>();

  for (const row of rows) {
    const department = departments.get(row.cod_dpto) ?? {
      name: toTitleCase(row.dpto),
      cities: [],
    };
    department.cities.push({ code: row.cod_mpio, name: toTitleCase(row.nom_mpio) });
    departments.set(row.cod_dpto, department);
  }

  return [...departments]
    .map(([code, { name, cities }]) => ({ code, name, cities: cities.toSorted(byCode) }))
    .toSorted(byCode);
};
