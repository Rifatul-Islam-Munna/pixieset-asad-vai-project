const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchBackendJson, BackendRequestError } = require('../lib/backend-request.ts');

function html(status = 502) {
  return new Response('<!DOCTYPE html><h1>Bad Gateway</h1>', { status, headers: { 'content-type': 'text/html' } });
}

test('a transient HTML 502 recovers without JSON parsing failure, preserving auth and cache options', async (t) => {
  let count = 0;
  const seen = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    seen.push(init); count++;
    return count === 1 ? html() : Response.json({ data: ['gallery'] });
  });
  const init = { headers: { access_token: 'test-token' }, next: { revalidate: 0, tags: ['collections'] } };
  assert.deepEqual(await fetchBackendJson('https://api.test/collections', init), { data: ['gallery'] });
  assert.equal(count, 2);
  assert.deepEqual(seen[1].headers, init.headers); assert.deepEqual(seen[1].next, init.next);
});

test('persistent HTML 502 returns a clean service error after three attempts', async (t) => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => { count++; return html(); });
  await assert.rejects(fetchBackendJson('https://api.test/collections'), (error) => {
    assert.ok(error instanceof BackendRequestError); assert.equal(error.statusCode, 502);
    assert.match(error.message, /temporarily unavailable/);
    assert.doesNotMatch(error.message, /DOCTYPE|Unexpected token|Bad Gateway/); return true;
  });
  assert.equal(count, 3);
});

test('authentication failures remain 401/403 and never retry', async (t) => {
  for (const status of [401, 403]) {
    let count = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => { count++; return html(status); });
    await assert.rejects(fetchBackendJson('https://api.test/profile'), (error) => error.statusCode === status);
    assert.equal(count, 1); mock.mock.restore();
  }
});

test('POST/payment mutations are never retried after gateway failure', async (t) => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => { count++; return html(); });
  await assert.rejects(fetchBackendJson('https://api.test/checkout', { method: 'POST', body: '{}' }), BackendRequestError);
  assert.equal(count, 1);
});

test('normal validation messages remain useful and do not retry', async (t) => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => { count++; return Response.json({ message: ['Choose a photo'] }, { status: 400 }); });
  await assert.rejects(fetchBackendJson('https://api.test/photos'), /Choose a photo/);
  assert.equal(count, 1);
});

test('network failures can recover on a read request', async (t) => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++count === 1) throw new TypeError('fetch failed');
    return Response.json({ data: true });
  });
  assert.deepEqual(await fetchBackendJson('https://api.test/profile'), { data: true });
  assert.equal(count, 2);
});

test('malformed JSON success responses do not leak parser errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<!DOCTYPE html>', { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(fetchBackendJson('https://api.test/profile'), (error) => {
    assert.ok(error instanceof BackendRequestError); assert.doesNotMatch(error.message, /DOCTYPE|Unexpected token/); return true;
  });
});

test('caller cancellation never retries', async (t) => {
  let count = 0; const controller = new AbortController(); controller.abort();
  t.mock.method(globalThis, 'fetch', async () => { count++; return Response.json({}); });
  await assert.rejects(fetchBackendJson('https://api.test/profile', { signal: controller.signal }));
  assert.equal(count, 0);
});
