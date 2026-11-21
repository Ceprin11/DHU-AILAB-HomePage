import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDocsStore } from '../server/docs-store.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(16)]);

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-publish-'));
  const clock = { value: new Date('2026-11-21T00:00:00+08:00') };
  const open = () => createDocsStore(root, { now: () => clock.value });
  const store = open();
  await store.saveCohorts([
    { id: '2026-autumn', label: '26 秋季招新', status: 'current', directions: ['ViT'] },
    { id: '2027-autumn', label: '27 秋季招新', status: 'draft', directions: ['BERT'] },
  ]);
  await store.savePage('2027-autumn', 'index', { title: '总招新文档', body: '总览', draft: true });
  await store.savePage('2027-autumn', 'bert', { title: 'BERT', order: 2, body: 'BERT 正文' });
  await store.savePage('2027-autumn', 'wip', { title: '没写完', order: 9, draft: true, body: '...' });
  await store.saveAsset('2027-autumn', { filename: 'a.png', buffer: PNG });
  return { root, clock, open, store, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const rejects = (promise, pattern) => assert.rejects(promise, (error) => {
  assert.match(error.message, pattern);
  return true;
});

test('keeps an unpublished cohort invisible to visitors but editable by admins', async () => {
  const { store, cleanup } = await fixture();
  try {
    assert.deepEqual((await store.listCohorts()).map((cohort) => cohort.id), ['2026-autumn']);
    assert.equal(await store.getCohort('2027-autumn'), null);
    assert.deepEqual(await store.listPages('2027-autumn'), []);
    assert.equal(await store.getPage('2027-autumn', 'bert'), null);
    assert.equal(await store.resolvePublicAsset('2027-autumn', 'assets/a.png'), null);
    assert.notEqual(store.resolveAsset('2027-autumn', 'assets/a.png'), null);

    const admin = await store.readCohortsForAdmin();
    assert.deepEqual(admin.map((cohort) => [cohort.id, cohort.status]), [['2026-autumn', 'current'], ['2027-autumn', 'draft']]);
    assert.equal((await store.listPagesForAdmin('2027-autumn')).length, 3);
  } finally {
    await cleanup();
  }
});

test('publishing makes the cohort current, archives the previous one and releases drafts', async () => {
  const { store, cleanup } = await fixture();
  try {
    assert.deepEqual(await store.publishCohort('2027-autumn', { drafts: true }), { published: 2 });
    const cohorts = await store.listCohorts();
    assert.deepEqual(cohorts.map((cohort) => [cohort.id, cohort.status]), [['2026-autumn', 'archived'], ['2027-autumn', 'current']]);
    assert.equal(cohorts[1].submission.open, true);
    assert.deepEqual((await store.listPages('2027-autumn')).map((page) => page.slug), ['index', 'bert', 'wip']);
    assert.notEqual(await store.resolvePublicAsset('2027-autumn', 'assets/a.png'), null);
    const index = await store.getPageForAdmin('2027-autumn', 'index');
    assert.deepEqual([index.title, index.draft], ['总招新文档', false]);
    await rejects(store.publishCohort('2027-autumn'), /已经发布过了/);
    await rejects(store.publishCohort('nope'), /没有找到这一期招新/);
  } finally {
    await cleanup();
  }
});

test('can publish while keeping drafts private', async () => {
  const { store, cleanup } = await fixture();
  try {
    assert.deepEqual(await store.publishCohort('2027-autumn', { drafts: false }), { published: 0 });
    assert.deepEqual((await store.listPages('2027-autumn')).map((page) => page.slug), ['bert']);
  } finally {
    await cleanup();
  }
});

test('schedules a publish and applies it once the time has passed', async () => {
  const { store, clock, cleanup } = await fixture();
  try {
    const scheduled = await store.scheduleCohort('2027-autumn', { publishAt: '2026-11-22T09:00' });
    assert.deepEqual(scheduled, { publish_at: '2026-11-22 09:00', publish_drafts: true });
    const admin = (await store.readCohortsForAdmin()).find((cohort) => cohort.id === '2027-autumn');
    assert.deepEqual([admin.status, admin.publish_at], ['draft', '2026-11-22 09:00']);
    assert.equal(await store.getCohort('2027-autumn'), null);

    clock.value = new Date('2026-11-22T08:59:59+08:00');
    assert.equal(await store.getCohort('2027-autumn'), null);

    clock.value = new Date('2026-11-22T09:00:00+08:00');
    const cohorts = await store.listCohorts();
    assert.deepEqual(cohorts.map((cohort) => [cohort.id, cohort.status]), [['2026-autumn', 'archived'], ['2027-autumn', 'current']]);
    assert.equal((await store.listPages('2027-autumn')).length, 3);
    assert.equal((await store.readCohortsForAdmin()).find((cohort) => cohort.id === '2027-autumn').publish_at, '');
  } finally {
    await cleanup();
  }
});

test('catches up on a missed schedule after a restart', async () => {
  const { open, store, clock, cleanup } = await fixture();
  try {
    await store.scheduleCohort('2027-autumn', { publishAt: '2026-11-22 09:00', drafts: false });
    clock.value = new Date('2026-12-30T12:00:00+08:00');
    const restarted = open();
    assert.equal((await restarted.getCohort('2027-autumn')).status, 'current');
    assert.deepEqual((await restarted.listPages('2027-autumn')).map((page) => page.slug), ['bert']);
  } finally {
    await cleanup();
  }
});

test('validates schedules and lets them be cancelled', async () => {
  const { store, cleanup } = await fixture();
  try {
    await rejects(store.scheduleCohort('2027-autumn', { publishAt: '下周一' }), /格式应为/);
    await rejects(store.scheduleCohort('2027-autumn', { publishAt: '2026-12-06' }), /格式应为/);
    await rejects(store.scheduleCohort('2027-autumn', { publishAt: '2026-11-20 09:00' }), /必须晚于现在/);
    await rejects(store.scheduleCohort('2026-autumn', { publishAt: '2026-12-06 09:00' }), /已经发布/);
    await rejects(store.scheduleCohort('nope', { publishAt: '2026-12-06 09:00' }), /没有找到这一期招新/);

    await store.scheduleCohort('2027-autumn', { publishAt: '2026-12-06 09:00' });
    await store.cancelSchedule('2027-autumn');
    assert.equal((await store.readCohortsForAdmin()).find((cohort) => cohort.id === '2027-autumn').publish_at, '');
  } finally {
    await cleanup();
  }
});

test('keeps the schedule when settings are saved, and drops it once the status changes', async () => {
  const { store, cleanup } = await fixture();
  try {
    await store.scheduleCohort('2027-autumn', { publishAt: '2026-12-06 09:00', drafts: false });
    const settings = await store.readCohortsForAdmin();
    await store.saveCohorts(settings);
    const kept = (await store.readCohortsForAdmin()).find((cohort) => cohort.id === '2027-autumn');
    assert.deepEqual([kept.publish_at, kept.publish_drafts], ['2026-12-06 09:00', false]);

    await store.saveCohorts(settings.map((cohort) => (cohort.id === '2027-autumn' ? { ...cohort, status: 'upcoming' } : cohort)));
    assert.equal((await store.readCohortsForAdmin()).find((cohort) => cohort.id === '2027-autumn').publish_at, '');
    await rejects(store.saveCohorts(settings.map((cohort) => (cohort.id === '2027-autumn' ? { ...cohort, publish_at: 'soon' } : cohort))), /定时发布时间格式/);
  } finally {
    await cleanup();
  }
});

test('can pull a published cohort back to draft', async () => {
  const { store, cleanup } = await fixture();
  try {
    await store.unpublishCohort('2026-autumn');
    assert.deepEqual(await store.listCohorts(), []);
    assert.deepEqual(await store.listPages('2026-autumn'), []);
    await rejects(store.unpublishCohort('2026-autumn'), /还没有发布/);
    await rejects(store.unpublishCohort('nope'), /没有找到这一期招新/);
  } finally {
    await cleanup();
  }
});
