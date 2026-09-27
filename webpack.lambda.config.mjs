// Bundles each Lambda handler into a single self-contained file at the root of dist-lambda/:
// lambda.js (API Gateway) and reconcile.js (scheduler). The infrastructure creates the functions
// with the handlers lambda.handler and reconcile.handler, so these names are a contract.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import webpack from 'webpack';

const require = createRequire(import.meta.url);

// Terraform owns the Lambda environment, so the version travels inside the bundle. The deploy
// workflow passes APP_VERSION with the commit; an APP_VERSION set on the function still wins.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION = process.env.APP_VERSION ?? version;

// Optional integrations that Nest and its libraries require lazily; bundling them would fail
// because they are not installed, and ignoring them is safe because they are never used.
const LAZY_IMPORTS = new Set([
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets',
  '@nestjs/websockets/socket-module',
  '@fastify/static',
  'class-transformer/storage',
]);

const isNotInstalled = (request) => {
  try {
    require.resolve(request);
    return false;
  } catch {
    return true;
  }
};

export default {
  mode: 'production',
  target: 'node24',
  entry: {
    lambda: './src/lambda.ts',
    reconcile: './src/reconcile.handler.ts',
  },
  output: {
    path: path.resolve(import.meta.dirname, 'dist-lambda'),
    filename: '[name].js',
    library: { type: 'commonjs2' },
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  module: {
    // The AWS SDK loads credential providers with import(); keep them inside each handler file.
    parser: { javascript: { dynamicImportMode: 'eager' } },
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'ts-loader',
        // Type checking is done by `npm run typecheck`; ES modules let webpack drop unused code.
        options: {
          configFile: 'tsconfig.build.json',
          transpileOnly: true,
          compilerOptions: { module: 'es2022', moduleResolution: 'bundler' },
        },
      },
    ],
  },
  // Nest resolves providers by class reference, but logs and errors use class names.
  optimization: {
    minimize: false,
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: `process.env.APP_VERSION ??= ${JSON.stringify(APP_VERSION)};`,
      raw: true,
      entryOnly: true,
    }),
    new webpack.IgnorePlugin({
      checkResource: (request) => LAZY_IMPORTS.has(request) && isNotInstalled(request),
    }),
  ],
  // Known dynamic requires of optional features this API never uses (other HTTP adapters,
  // optional packages, Express view engines, ESM file-type detection). The bundle smoke test
  // (test/bundle) proves the handlers work without them; any other warning is still reported.
  ignoreWarnings: [
    {
      module:
        /node_modules\/(@nestjs\/common\/utils\/load-package\.util|@nestjs\/core\/helpers\/(load-adapter|optional-require)|express\/lib\/view|load-esm\/index)\.js$/,
      message: /Critical dependency: the request of a dependency is an expression/,
    },
  ],
  performance: {
    hints: false,
  },
};
