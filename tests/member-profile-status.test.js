import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStore } from '../server/store.js';

const withStore = async (run) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ailab-member-profile-'));
  try {
    await run(createStore(directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test('stores draft and published member profile states', async () => {
  await withStore(async (store) => {
    const draft = await store.create('Member', { name: '测试成员', profile_status: 'draft' });
    assert.equal(draft.profile_status, 'draft');

    const published = await store.update('Member', draft.id, {
      photo_url: '/uploads/member.webp',
      profile_status: 'published',
    });
    assert.equal(published.profile_status, 'published');
    assert.equal(published.photo_url, '/uploads/member.webp');
  });
});

test('keeps legacy members valid and rejects unknown profile states', async () => {
  await withStore(async (store) => {
    const legacy = await store.create('Member', { name: '现有成员' });
    assert.equal(legacy.profile_status, undefined);
    await assert.rejects(
      () => store.update('Member', legacy.id, { profile_status: 'unexpected' }),
      /profile_status is invalid/,
    );
  });
});
