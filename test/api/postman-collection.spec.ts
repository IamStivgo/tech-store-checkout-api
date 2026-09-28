import { readFileSync } from 'node:fs';
import path from 'node:path';

interface PostmanRequest {
  readonly method: string;
  readonly url: {
    readonly raw: string;
    readonly host?: readonly string[];
    readonly path?: readonly string[];
  };
}

interface PostmanItem {
  readonly name: string;
  readonly request?: PostmanRequest;
  readonly item?: readonly PostmanItem[];
}

interface OpenApiDocument {
  readonly paths: Record<string, Record<string, unknown>>;
}

const DOCS = path.resolve(__dirname, '../../docs');
const API_PREFIX = '/api/v1';

const readJson = (file: string): unknown => JSON.parse(readFileSync(path.join(DOCS, file), 'utf8'));

const collection = readJson('postman/checkout-api.postman_collection.json') as {
  item: PostmanItem[];
  variable: { key: string; value: string }[];
};
const contract = readJson('openapi.json') as OpenApiDocument;

const requests = (items: readonly PostmanItem[]): PostmanRequest[] =>
  items.flatMap((item) => [...(item.request ? [item.request] : []), ...requests(item.item ?? [])]);

// Only the store API: the card tokenization goes straight to the payment provider.
const storeRequests = requests(collection.item)
  .filter(({ url }) => url.host?.[0] === '{{baseUrl}}')
  .map(({ method, url }) => ({ method, path: `/${(url.path ?? []).join('/')}` }));

const operations = Object.entries(contract.paths).flatMap(([template, methods]) =>
  Object.keys(methods).map((method) => ({
    method: method.toUpperCase(),
    template,
    // A contract parameter matches a collection variable or a literal value.
    pattern: new RegExp(`^${template.slice(API_PREFIX.length).replace(/\{[^}]+\}/g, '[^/]+')}$`),
  })),
);

describe('Postman collection', () => {
  it('has at least one request for every operation of the contract', () => {
    const missing = operations.filter(
      ({ method, pattern }) =>
        !storeRequests.some((request) => request.method === method && pattern.test(request.path)),
    );

    expect(missing.map(({ method, template }) => `${method} ${template}`)).toEqual([]);
  });

  it('only calls operations of the contract', () => {
    const unknown = storeRequests.filter(
      ({ method, path: requestPath }) =>
        !operations.some(
          (operation) => operation.method === method && operation.pattern.test(requestPath),
        ),
    );

    expect(unknown).toEqual([]);
  });

  it('ships placeholders instead of the payment provider credentials', () => {
    const variables = Object.fromEntries(collection.variable.map(({ key, value }) => [key, value]));

    expect(variables.providerBaseUrl).toMatch(/^https:\/\/<.+>/);
    expect(variables.providerPublicKey).toMatch(/^<.+>$/);
  });
});
