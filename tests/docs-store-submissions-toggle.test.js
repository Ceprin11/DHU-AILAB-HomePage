import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDocsStore } from '../server/docs-store.js';

const fixture = async (status = 'current', extra = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-toggle-'));
  const clock = { value: new Date('2026-11-21T12:00:00+08:00') };
  const store = createDocsStore(root, { now: () => clock.value });
  await store.saveCohorts([{ id: '2026-autumn', label: '26 秋季招新', status, directions: ['ViT'], ...extra }]);
  return { store, clock, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const adminRow = async (store) => (await store.readCohortsForAdmin())[0];

test('closing the switch takes the submit page away at once and opening it brings it back', async () => {
  const { store, cleanup } = await fixture();
  try {
    assert.equal((await store.getCohort('2026-autumn')).submission.open, true);
    assert.deepEqual((await adminRow(store)).submission_state, { open: true, reason: '' });

    await store.setSubmissionsOpen('2026-autumn', false);
    const closed = await store.getCohort('2026-autumn');
    assert.equal(closed.submission.open, false);
    assert.equal(closed.submission.reason, '本期暂不接收提交');
    assert.equal((await adminRow(store)).submissions, false);
    assert.equal((await adminRow(store)).submission_state.open, false);

    await store.setSubmissionsOpen('2026-autumn', true);
    assert.equal((await store.getCohort('2026-autumn')).submission.open, true);
    assert.equal((await adminRow(store)).submissions, true);
  } finally {
    await cleanup();
  }
});

test('the switch survives a restart and does not disturb the rest of the cohort settings', async () => {
  const { store, cleanup } = await fixture('current', { submission_deadline: '2026-12-06 18:00', description: '说明' });
  try {
    await store.setSubmissionsOpen('2026-autumn', false);
    const row = await adminRow(store);
    assert.equal(row.submission_deadline, '2026-12-06 18:00');
    assert.equal(row.description, '说明');
    assert.deepEqual(row.directions, ['ViT']);
    assert.equal(row.status, 'current');
  } finally {
    await cleanup();
  }
});

test('the admin state explains why a switched-on cohort is still closed', async () => {
  const { store, clock, cleanup } = await fixture('current', { submission_deadline: '2026-11-21 10:00' });
  try {
    const row = await adminRow(store);
    assert.equal(row.submissions, true);
    assert.deepEqual(row.submission_state, { open: false, reason: '已过提交截止时间' });
    clock.value = new Date('2026-11-21T09:00:00+08:00');
    assert.equal((await adminRow(store)).submission_state.open, true);
  } finally {
    await cleanup();
  }
});

test('an unpublished cohort can be switched ahead of publishing, and an unknown cohort is refused', async () => {
  const { store, cleanup } = await fixture('draft');
  try {
    assert.equal((await adminRow(store)).submission_state.open, false);
    await store.setSubmissionsOpen('2026-autumn', false);
    await store.publishCohort('2026-autumn', { drafts: true });
    assert.equal((await store.getCohort('2026-autumn')).submission.open, false);
    await assert.rejects(store.setSubmissionsOpen('nope', true), /没有找到这一期招新/);
  } finally {
    await cleanup();
  }
});
