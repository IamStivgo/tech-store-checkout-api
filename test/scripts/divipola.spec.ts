import { toDepartments, toTitleCase } from '../../scripts/coverage/divipola';

describe('toTitleCase', () => {
  it.each([
    ['MEDELLÍN', 'Medellín'],
    ['VALLE DEL CAUCA', 'Valle del Cauca'],
    ['LA GUAJIRA', 'La Guajira'],
    ['CARTAGENA DE INDIAS', 'Cartagena de Indias'],
    ['BOGOTÁ, D.C.', 'Bogotá, D.C.'],
    ['PIENDAMÓ - TUNÍA', 'Piendamó - Tunía'],
    ['EL CARMEN DE VIBORAL', 'El Carmen de Viboral'],
    [
      'ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA',
      'Archipiélago de San Andrés, Providencia y Santa Catalina',
    ],
  ])('turns %s into %s', (name, expected) => {
    expect(toTitleCase(name)).toBe(expected);
  });
});

describe('toDepartments', () => {
  it('groups municipalities by department, sorted by code', () => {
    const departments = toDepartments([
      { cod_dpto: '25', dpto: 'CUNDINAMARCA', cod_mpio: '25754', nom_mpio: 'SOACHA' },
      { cod_dpto: '05', dpto: 'ANTIOQUIA', cod_mpio: '05088', nom_mpio: 'BELLO' },
      { cod_dpto: '05', dpto: 'ANTIOQUIA', cod_mpio: '05001', nom_mpio: 'MEDELLÍN' },
    ]);

    expect(departments).toEqual([
      {
        code: '05',
        name: 'Antioquia',
        cities: [
          { code: '05001', name: 'Medellín' },
          { code: '05088', name: 'Bello' },
        ],
      },
      { code: '25', name: 'Cundinamarca', cities: [{ code: '25754', name: 'Soacha' }] },
    ]);
  });
});
