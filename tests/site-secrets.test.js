import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAdminCredentials, loadSessionKey } from '../server/site-secrets.js';

const withDirectory = async (run) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ailab-secrets-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test('the session key depends on a key kept on the server, not only on SESSION_SECRET', async () => withDirectory(async (directory) => {
  const first = await loadSessionKey(directory, 'public-secret-from-the-repository');
  const again = await loadSessionKey(directory, 'public-secret-from-the-repository');
  assert.deepEqual(first, again, 'the same server keeps the same key across restarts');

  await withDirectory(async (otherServer) => {
    const elsewhere = await loadSessionKey(otherServer, 'public-secret-from-the-repository');
    assert.notDeepEqual(first, elsewhere, 'knowing SESSION_SECRET alone does not give the signing key');
  });

  const file = path.join(directory, 'secrets', 'session-key');
  assert.ok((await readFile(file, 'utf8')).trim().length >= 32);
  assert.equal((await stat(file)).mode & 0o077, 0, 'only the owner can read the key');
}));

test('the super administrator password starts as ADMIN_PASSWORD and can be changed', async () => withDirectory(async (directory) => {
  const credentials = createAdminCredentials(directory, { environmentPassword: 'environment-password' });
  assert.equal(await credentials.verify('environment-password'), true);
  assert.equal(await credentials.verify('wrong'), false);
  assert.equal(await credentials.isCustomized(), false);
  assert.equal(await credentials.version(), 0);

  await assert.rejects(credentials.change('wrong', 'a-brand-new-password'), { status: 401 });
  await assert.rejects(credentials.change('environment-password', 'short'), { status: 400 });
  await assert.rejects(credentials.change('environment-password', 'environment-password'), { status: 400 });

  assert.equal(await credentials.change('environment-password', 'a-brand-new-password'), 1);
  assert.equal(await credentials.verify('a-brand-new-password'), true);
  assert.equal(await credentials.verify('environment-password'), false, 'the old password stops working');
  assert.equal(await credentials.isCustomized(), true);

  const stored = await readFile(path.join(directory, 'secrets', 'admin-password.json'), 'utf8');
  assert.ok(!stored.includes('a-brand-new-password'), 'only a hash is stored');

  // A restart reads the stored password; ADMIN_PASSWORD is ignored from now on.
  const restarted = createAdminCredentials(directory, { environmentPassword: 'environment-password' });
  assert.equal(await restarted.verify('environment-password'), false);
  assert.equal(await restarted.verify('a-brand-new-password'), true);
  assert.equal(await restarted.version(), 1);
  assert.equal(await restarted.change('a-brand-new-password', 'another-new-password'), 2);
}));

test('two password changes at the same time do not both succeed with the same current password', async () => withDirectory(async (directory) => {
  const credentials = createAdminCredentials(directory, { environmentPassword: 'environment-password' });
  const results = await Promise.allSettled([
    credentials.change('environment-password', 'first-new-password'),
    credentials.change('environment-password', 'second-new-password'),
  ]);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'rejected']);
  assert.equal(await credentials.verify('first-new-password'), true);
}));
