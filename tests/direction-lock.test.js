import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDocsStore } from '../server/docs-store.js';
import { checkDirectionLock, createSubmissionStore } from '../server/recruit-submissions.js';

const pptx = () => ({ originalname: 'a.pptx', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(32)]) });
const fields = (overrides = {}) => ({ name: '张三', student_id: '2250001', grade: '大二', major: '人工智能', direction: 'ViT', qq: '12345678', wechat: '', email: '', note: '', ...overrides });
const rejects = (promise, pattern) => assert.rejects(promise, (error) => {
  assert.match(error.message, pattern);
  return true;
});

const docsFixture = async (extra = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-lock-'));
  const clock = { value: new Date('2026-11-21T12:00:00+08:00') };
  const store = createDocsStore(root, { now: () => clock.value });
  await store.saveCohorts([{ id: '2026-autumn', label: '26 秋季招新', status: 'current', directions: ['ViT', 'BERT'], ...extra }]);
  return { store, clock, cleanup: () => rm(root, { recursive: true, force: true }) };
};

test('a cohort has no lock until a time is set, and the lock starts at that moment (Beijing time)', async () => {
  const { store, clock, cleanup } = await docsFixture();
  try {
    assert.equal((await store.getCohort('2026-autumn')).submission.directionLock, null);
    assert.equal((await store.readCohortsForAdmin())[0].direction_lock_at, '');

    await store.saveCohorts([{ id: '2026-autumn', label: 'x', status: 'current', directions: ['ViT'], direction_lock_at: '2026-11-28 23:59' }]);
    assert.equal((await store.readCohortsForAdmin())[0].direction_lock_at, '2026-11-28 23:59');
    const before = (await store.getCohort('2026-autumn')).submission.directionLock;
    assert.deepEqual(before, { at: '2026-11-28T15:59:00.000Z', locked: false });

    clock.value = new Date('2026-11-28T23:58:59+08:00');
    assert.equal((await store.getCohort('2026-autumn')).submission.directionLock.locked, false);
    clock.value = new Date('2026-11-28T23:59:00+08:00');
    assert.equal((await store.getCohort('2026-autumn')).submission.directionLock.locked, true);
  } finally {
    await cleanup();
  }
});

test('the lock time must be a valid Beijing time and is not exposed as a raw field to visitors', async () => {
  const { store, cleanup } = await docsFixture({ direction_lock_at: '2026-11-28 23:59' });
  try {
    await rejects(store.saveCohorts([{ id: '2026-autumn', label: 'x', status: 'current', direction_lock_at: '下周一' }]), /论文锁定时间格式/);
    await rejects(store.saveCohorts([{ id: '2026-autumn', label: 'x', status: 'current', direction_lock_at: '2026-11-28' }]), /论文锁定时间格式/);
    const cohort = await store.getCohort('2026-autumn');
    assert.equal('direction_lock_at' in cohort, false);
    assert.ok(cohort.submission.directionLock);
    // the switch and the publish state keep the lock time
    await store.setSubmissionsOpen('2026-autumn', false);
    assert.equal((await store.readCohortsForAdmin())[0].direction_lock_at, '2026-11-28 23:59');
  } finally {
    await cleanup();
  }
});

const records = [
  { cohort: 'c', student_id: '2250001', name: '张三', direction: 'ViT', created_at: '2026-11-21T01:00:00.000Z' },
  { cohort: 'c', student_id: '2250001', name: '张三', direction: 'BERT', created_at: '2026-11-22T01:00:00.000Z' },
  { cohort: 'other', student_id: '2250009', name: '李四', direction: 'ViT', created_at: '2026-11-22T01:00:00.000Z' },
];

test('after the lock a student keeps the paper of their newest submission', () => {
  assert.doesNotThrow(() => checkDirectionLock(records, 'c', fields({ direction: 'BERT' })));
  assert.throws(() => checkDirectionLock(records, 'c', fields({ direction: 'ViT' })), /锁定.*BERT/);
});

test('the lock is per student, ignores letter case of the id and spaces in the name', () => {
  assert.doesNotThrow(() => checkDirectionLock(records, 'c', fields({ student_id: '2250002', direction: 'ViT', name: '王五' })));
  assert.doesNotThrow(() => checkDirectionLock([{ ...records[0], student_id: 'AB12345' }], 'c', fields({ student_id: 'ab12345', name: '张 三' })));
  assert.doesNotThrow(() => checkDirectionLock(records, 'c', fields({ student_id: '2250009', name: '李四', direction: 'BERT' })), 'another cohort does not count');
});

test('a different name on a known student id is refused after the lock', () => {
  assert.throws(() => checkDirectionLock(records, 'c', fields({ name: '赵六', direction: 'BERT' })), /不一致/);
});

test('the store only applies the lock when asked, so students can still change paper before it', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-lock-store-'));
  try {
    const store = createSubmissionStore(root);
    await store.add({ cohort: 'c', fields: fields({ direction: 'ViT' }), file: pptx() });
    const changed = await store.add({ cohort: 'c', fields: fields({ direction: 'BERT' }), file: pptx() });
    assert.match(changed.final_name, /^BERT_张三_2250001/);

    await rejects(store.add({ cohort: 'c', fields: fields({ direction: 'ViT' }), file: pptx(), lockDirection: true }), /锁定.*BERT/);
    const again = await store.add({ cohort: 'c', fields: fields({ direction: 'BERT' }), file: pptx(), lockDirection: true });
    assert.equal(again.version, 2);

    // someone who never submitted before the lock may still choose once, and is then locked too
    const late = await store.add({ cohort: 'c', fields: fields({ student_id: '2250077', name: '新同学', direction: 'ViT' }), file: pptx(), lockDirection: true });
    assert.equal(late.version, 1);
    await rejects(store.add({ cohort: 'c', fields: fields({ student_id: '2250077', name: '新同学', direction: 'BERT' }), file: pptx(), lockDirection: true }), /锁定.*ViT/);
    assert.equal((await store.list('c')).length, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
