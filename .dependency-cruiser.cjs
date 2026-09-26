const EXTERNAL_DEPENDENCY_TYPES = [
  'core',
  'npm',
  'npm-dev',
  'npm-optional',
  'npm-peer',
  'npm-bundled',
  'npm-no-pkg',
  'npm-unknown',
];

const DOMAIN = '^src/(shared|modules/[^/]+)/domain/';
const APPLICATION = '^src/(shared|modules/[^/]+)/application/';
const PRODUCTION_CODE = { path: '^src/', pathNot: '\\.spec\\.ts$' };

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'The domain only depends on TypeScript and the shared domain kernel.',
      severity: 'error',
      from: { path: DOMAIN, pathNot: '\\.spec\\.ts$' },
      to: { dependencyTypes: EXTERNAL_DEPENDENCY_TYPES },
    },
    {
      name: 'domain-no-outer-layers',
      comment: 'Dependencies point inwards: the domain never knows application or infrastructure.',
      severity: 'error',
      from: { path: DOMAIN },
      to: { path: '^src/(shared|modules/[^/]+)/(application|infrastructure)/' },
    },
    {
      name: 'application-is-framework-free',
      comment: 'Use cases are plain classes; frameworks and SDKs live in infrastructure.',
      severity: 'error',
      from: { path: APPLICATION, pathNot: '\\.spec\\.ts$' },
      to: { dependencyTypes: EXTERNAL_DEPENDENCY_TYPES },
    },
    {
      name: 'application-no-infrastructure',
      comment: 'Use cases depend on ports, never on adapters.',
      severity: 'error',
      from: { path: APPLICATION },
      to: { path: '^src/(shared|modules/[^/]+)/infrastructure/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'production-code-not-to-tests',
      comment: 'Test helpers and specs never reach the Lambda bundle.',
      severity: 'error',
      from: PRODUCTION_CODE,
      to: { path: ['^test/', '\\.spec\\.ts$'] },
    },
    {
      name: 'production-code-not-to-dev-deps',
      comment: 'devDependencies are not installed in the Lambda bundle or the Docker image.',
      severity: 'error',
      from: PRODUCTION_CODE,
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
