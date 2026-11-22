import assert from 'node:assert/strict';
import test from 'node:test';
import { importWithRetry } from '../src/lib/lazy-with-retry.js';
import { isProxyThrottle, proxyRetryDelay } from '../src/api/client.js';

test('a page that fails to load is tried again before giving up', async () => {
  let calls = 0;
  const waits = [];
  const module = await importWithRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error('429');
    return { default: 'page' };
  }, { wait: async (ms) => { waits.push(ms); } });
  assert.equal(module.default, 'page');
  assert.equal(calls, 3);
  assert.equal(waits.length, 2);

  await assert.rejects(importWithRetry(async () => { throw new Error('gone'); }, { delays: [1, 1], wait: async () => {} }), /gone/);
});

test('only the proxy\'s 429 is retried, never the site\'s own login or submission limits', () => {
  const proxy = new Response('Too Many Requests', { status: 429, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const site = new Response(JSON.stringify({ message: '登录尝试次数过多，请稍后再试' }), { status: 429, headers: { 'content-type': 'application/json; charset=utf-8' } });
  assert.equal(isProxyThrottle(proxy), true);
  assert.equal(isProxyThrottle(site), false);
  assert.equal(isProxyThrottle(new Response('{}', { status: 200 })), false);

  const withRetryAfter = new Response('', { status: 429, headers: { 'retry-after': '2' } });
  const delay = proxyRetryDelay(withRetryAfter, 0);
  assert.ok(delay >= 2000 && delay <= 2400);
  assert.ok(proxyRetryDelay(proxy, 0) >= 700);
});
