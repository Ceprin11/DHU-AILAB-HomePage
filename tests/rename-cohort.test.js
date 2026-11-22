import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDocsStore } from '../server/docs-store.js';
import { createSubmissionStore } from '../server/recruit-submissions.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]);

const setup = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-rename-'));
  const store = createDocsStore(path.join(root, 'content'));
  await store.saveCohorts([
    { id: '2026-autumn', label: '26 秋季招新', status: 'current', directions: ['ViT'] },
    { id: '2025-autumn', label: '25 秋季招新', status: 'archived' },
  ]);
  return { root, store, cleanup: () => rm(root, { recursive: true, force: true }) };
};

test('renames a cohort together with its pages and assets', async () => {
  const { root, store, cleanup } = await setup();
  try {
    await store.savePage('2026-autumn', 'vit', { title: 'ViT', body: '![图](assets/a.png)', draft: false });
    await store.saveAsset('2026-autumn', { filename: 'a.png', buffer: PNG });
    assert.equal(await store.renameCohort('2026-autumn', ' 2026-fall '), '2026-fall');
    assert.equal((await store.readCohortsForAdmin()).map((cohort) => cohort.id).join(), '2026-fall,2025-autumn');
    assert.equal((await store.readCohortsForAdmin())[0].status, 'current');
    assert.match((await store.getPage('2026-fall', 'vit')).body, /assets\/a\.png/);
    assert.ok((await stat(path.join(root, 'content', '2026-fall', 'assets', 'a.png'))).isFile());
    await assert.rejects(stat(path.join(root, 'content', '2026-autumn')), { code: 'ENOENT' });
    assert.equal(await store.getPage('2026-autumn', 'vit'), null);
  } finally {
    await cleanup();
  }
});

test('refuses unusable new ids without changing anything', async () => {
  const { root, store, cleanup } = await setup();
  try {
    await mkdir(path.join(root, 'content', 'taken'), { recursive: true });
    for (const id of ['', 'Fall 2026', '../x', '2026-autumn', '2025-autumn', 'taken']) {
      await assert.rejects(store.renameCohort('2026-autumn', id), /批次编号|一样|已经有|同名/);
    }
    await assert.rejects(store.renameCohort('missing', '2026-fall'), { status: 404 });
    assert.match(await readFile(path.join(root, 'content', 'cohorts.json'), 'utf8'), /"2026-autumn"/);
  } finally {
    await cleanup();
  }
});

test('renames a cohort that has no folder yet', async () => {
  const { store, cleanup } = await setup();
  try {
    await store.renameCohort('2025-autumn', '2025-fall');
    assert.ok((await store.readCohortsForAdmin()).some((cohort) => cohort.id === '2025-fall'));
  } finally {
    await cleanup();
  }
});

test('moves the received submissions to the new cohort id', async () => {
  const { root, cleanup } = await setup();
  try {
    const submissions = createSubmissionStore(path.join(root, 'data'));
    const fields = { name: '张三', student_id: '20260001', grade: '大一', major: '计算机', direction: 'ViT', qq: '1', wechat: '', email: '' };
    await submissions.add({ cohort: '2026-autumn', fields, file: { originalname: 'a.html', buffer: Buffer.from('<p>hi</p>') } });
    await submissions.add({ cohort: '2025-autumn', fields, file: { originalname: 'b.html', buffer: Buffer.from('<p>hi</p>') } });
    assert.equal(await submissions.renameCohort('2026-autumn', '2026-fall'), 1);
    assert.equal((await submissions.list('2026-fall')).length, 1);
    assert.equal((await submissions.list('2026-autumn')).length, 0);
    assert.equal((await submissions.list('2025-autumn')).length, 1);
    assert.equal(await submissions.renameCohort('nothing', 'x-y'), 0);
  } finally {
    await cleanup();
  }
});

test('lists only the applicant\'s own submissions, newest first, with their contact details', async () => {
  const { root, cleanup } = await setup();
  try {
    const submissions = createSubmissionStore(path.join(root, 'data'));
    const base = { name: '张三', grade: '大一', major: '计算机', direction: 'ViT', wechat: '', email: '' };
    const file = () => ({ originalname: 'a.html', buffer: Buffer.from('<p>hi</p>') });
    await submissions.add({ cohort: '2026-autumn', fields: { ...base, student_id: 'A1001', qq: '11111' }, file: file() });
    await submissions.add({ cohort: '2026-autumn', fields: { ...base, name: '李四', student_id: 'B2002', qq: '22222' }, file: file() });
    await submissions.add({ cohort: '2026-autumn', fields: { ...base, student_id: 'A1001', qq: '33333' }, file: file() });
    await submissions.add({ cohort: '2025-autumn', fields: { ...base, student_id: 'A1001', qq: '44444' }, file: file() });
    const own = await submissions.listOwn('2026-autumn', 'a1001');
    assert.deepEqual(own.map((item) => item.qq), ['33333', '11111']);
    assert.ok(own.every((item) => !('name' in item) && !('student_id' in item) && !('stored_name' in item)));
    assert.deepEqual(await submissions.listOwn('2026-autumn', 'C3003'), []);
  } finally {
    await cleanup();
  }
});
