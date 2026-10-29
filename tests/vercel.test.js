import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';

const previousVercel = process.env.VERCEL;
process.env.VERCEL = '1';
const { default: handler } = await import('../api/[...path].js');
if (previousVercel === undefined) delete process.env.VERCEL;
else process.env.VERCEL = previousVercel;

const server = createServer(handler);
let base;

beforeAll(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('Vercel API function', () => {
  it('serves the bundled datasets through the health and catalogue routes', async () => {
    const healthResponse = await fetch(`${base}/health`);
    const health = await healthResponse.json();
    expect(healthResponse.status).toBe(200);
    expect(health.products).toBe(21);
    expect(health.dataVersion).toBeTruthy();

    const productsResponse = await fetch(`${base}/products`);
    const products = await productsResponse.json();
    expect(productsResponse.status).toBe(200);
    expect(products.count).toBe(21);
  });
});
