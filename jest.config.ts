import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageReporters: ['text-summary', 'json-summary', 'lcov', 'html'],
  coverageThreshold: {
    global: { statements: 85, lines: 85, functions: 85, branches: 81 },
  },
};

export default config;
