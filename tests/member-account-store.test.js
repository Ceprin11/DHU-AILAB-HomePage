import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMemberAccountStore } from '../server/member-account-store.js';

const withStore = async (run) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ailab-member-account-'));
  try {
    await run(createMemberAccountStore(directory), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test('creates an account with a hashed initial password', async () => {
  await withStore(async (store, directory) => {
    const account = await store.createForMember('member-1', '20240001');
    assert.equal(account.account, '20240001');
    assert.equal(account.must_change_password, true);
    const authenticated = await store.authenticate('20240001', '20240001');
    assert.ok(authenticated);
    assert.ok(authenticated.last_login_at);
    assert.equal(await store.authenticate('20240001', 'wrong-password'), null);

    const file = await readFile(path.join(directory, 'member-accounts.json'), 'utf8');
    assert.equal(file.includes('"password_hash"'), true);
    assert.equal(file.includes('"password":"20240001"'), false);
  });
});

test('can create an account in a disabled state', async () => {
  await withStore(async (store) => {
    const account = await store.createForMember('member-1', '20240001', { active: false });
    assert.equal(account.active, false);
    assert.equal(await store.authenticate('20240001', '20240001'), null);
  });
});

test('changes password and invalidates the previous session version', async () => {
  await withStore(async (store) => {
    const created = await store.createForMember('member-1', '20240001');
    const changed = await store.changePassword('member-1', '20240001', 'secure-password-2026');
    assert.equal(changed.must_change_password, false);
    assert.ok(changed.session_version > created.session_version);
    assert.equal(await store.authenticate('20240001', '20240001'), null);
    assert.ok(await store.authenticate('20240001', 'secure-password-2026'));
  });
});

test('supports admin reset, disable and unique accounts', async () => {
  await withStore(async (store) => {
    await store.createForMember('member-1', '20240001');
    await assert.rejects(() => store.createForMember('member-2', '20240001'), /已被使用/);

    const disabled = await store.configureForMember('member-1', { account: '20240001', active: false });
    assert.equal(disabled.active, false);
    assert.equal(await store.authenticate('20240001', '20240001'), null);

    await store.configureForMember('member-1', { account: '20240001', active: true, resetPassword: true });
    const authenticated = await store.authenticate('20240001', '20240001');
    assert.equal(authenticated.must_change_password, true);
  });
});
