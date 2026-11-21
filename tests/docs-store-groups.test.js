import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDocsStore } from '../server/docs-store.js';

const DIRECTIONS = ['ConvNeXt', 'ViT', 'BERT', 'GPT-2', 'CLIP', 'BLIP'];
const GROUPS = [
  { name: 'CV', directions: ['ConvNeXt', 'ViT'] },
  { name: 'NLP', directions: ['BERT', 'GPT-2'] },
  { name: '多模态', directions: ['CLIP', 'BLIP'] },
];

const fixture = async (status = 'draft') => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-groups-'));
  const store = createDocsStore(root);
  await store.saveCohorts([{ id: '2026-autumn', label: '26 秋季招新', status, directions: DIRECTIONS, groups: GROUPS }]);
  await store.savePage('2026-autumn', 'index', { title: '总招新文档', body: '总览' });
  await store.savePage('2026-autumn', 'clip', { title: 'CLIP', group: '多模态', order: 1, body: 'CLIP' });
  await store.savePage('2026-autumn', 'bert', { title: 'BERT', group: 'NLP', order: 2, body: 'BERT' });
  await store.savePage('2026-autumn', 'vit', { title: 'ViT', group: 'CV', order: 3, body: 'ViT' });
  await store.savePage('2026-autumn', 'convnext', { title: 'ConvNeXt', group: 'CV', order: 4, body: 'ConvNeXt' });
  await store.savePage('2026-autumn', 'notice', { title: '须知', order: 5, body: '须知' });
  await store.savePage('2026-autumn', 'wip', { title: '没写完', group: 'NLP', order: 9, draft: true, body: '...' });
  return { store, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const rejects = (promise, pattern) => assert.rejects(promise, (error) => {
  assert.match(error.message, pattern);
  return true;
});

test('keeps the groups of a cohort and exposes them to visitors and in the submission rules', async () => {
  const { store, cleanup } = await fixture('current');
  try {
    assert.deepEqual((await store.readCohortsForAdmin())[0].groups, GROUPS);
    const cohort = await store.getCohort('2026-autumn');
    assert.deepEqual(cohort.groups, GROUPS);
    assert.deepEqual(cohort.submission.groups, GROUPS);
    assert.deepEqual(cohort.submission.directions, DIRECTIONS);
  } finally {
    await cleanup();
  }
});

test('rejects groups that name an unknown direction, repeat a direction or repeat a name', async () => {
  const { store, cleanup } = await fixture();
  try {
    const save = (groups) => store.saveCohorts([{ id: '2026-autumn', label: 'x', status: 'draft', directions: DIRECTIONS, groups }]);
    await rejects(save([{ name: 'CV', directions: ['Nope'] }]), /不在选择方向中/);
    await rejects(save([{ name: 'CV', directions: ['ViT'] }, { name: 'NLP', directions: ['ViT'] }]), /多个分组/);
    await rejects(save([{ name: 'CV', directions: ['ViT'] }, { name: 'CV', directions: ['BERT'] }]), /重复/);
    await rejects(save([{ name: ' ', directions: [] }]), /不能为空/);
    assert.deepEqual((await store.readCohortsForAdmin())[0].groups, GROUPS);
  } finally {
    await cleanup();
  }
});

test('lists pages un-grouped first, then group by group, each block by its sort number', async () => {
  const { store, cleanup } = await fixture('current');
  try {
    const pages = await store.listPages('2026-autumn');
    assert.deepEqual(pages.map((page) => page.slug), ['index', 'notice', 'vit', 'convnext', 'bert', 'clip']);
    assert.deepEqual(pages.map((page) => page.group), ['', '', 'CV', 'CV', 'NLP', '多模态']);
    assert.deepEqual((await store.listPagesForAdmin('2026-autumn')).map((page) => page.slug), ['index', 'notice', 'vit', 'convnext', 'bert', 'wip', 'clip']);
  } finally {
    await cleanup();
  }
});

test('refuses a page in a group that does not exist and ignores the group on the overview', async () => {
  const { store, cleanup } = await fixture();
  try {
    await rejects(store.savePage('2026-autumn', 'x', { title: 'x', group: '语音', body: 'x' }), /没有“语音”这个分组/);
    await store.savePage('2026-autumn', 'index', { title: '总招新文档', group: 'CV', body: '总览' });
    assert.equal((await store.getPageForAdmin('2026-autumn', 'index')).group, '');
  } finally {
    await cleanup();
  }
});

test('a page whose group was removed from the cohort falls back to un-grouped', async () => {
  const { store, cleanup } = await fixture('current');
  try {
    await store.saveCohorts([{ id: '2026-autumn', label: '26 秋季招新', status: 'current', directions: DIRECTIONS, groups: GROUPS.slice(0, 1) }]);
    const pages = await store.listPages('2026-autumn');
    assert.deepEqual(pages.filter((page) => page.group === '').map((page) => page.slug), ['index', 'clip', 'bert', 'notice']);
    assert.equal((await store.getPageForAdmin('2026-autumn', 'bert')).group, '');
  } finally {
    await cleanup();
  }
});

test('reordering rewrites the sort numbers and groups in the order given and keeps drafts as drafts', async () => {
  const { store, cleanup } = await fixture('current');
  try {
    await store.reorderPages('2026-autumn', [
      { slug: 'index' },
      { slug: 'notice', group: '' },
      { slug: 'vit', group: 'CV' },
      { slug: 'convnext', group: 'CV' },
      { slug: 'clip', group: 'NLP' },
      { slug: 'bert', group: 'NLP' },
      { slug: 'wip', group: 'NLP' },
    ]);
    const admin = await store.listPagesForAdmin('2026-autumn');
    assert.deepEqual(admin.map((page) => page.slug), ['index', 'notice', 'vit', 'convnext', 'clip', 'bert', 'wip']);
    assert.deepEqual(admin.map((page) => page.group), ['', '', 'CV', 'CV', 'NLP', 'NLP', 'NLP']);
    assert.equal(admin.find((page) => page.slug === 'wip').draft, true);
    assert.equal((await store.getPageForAdmin('2026-autumn', 'bert')).body.trim(), 'BERT');
    assert.deepEqual((await store.listPages('2026-autumn')).map((page) => page.slug), ['index', 'notice', 'vit', 'convnext', 'clip', 'bert']);
  } finally {
    await cleanup();
  }
});

test('reordering validates the request before touching any page', async () => {
  const { store, cleanup } = await fixture();
  try {
    const before = (await store.listPagesForAdmin('2026-autumn')).map((page) => [page.slug, page.order, page.group]);
    await rejects(store.reorderPages('2026-autumn', [{ slug: 'vit', group: 'CV' }, { slug: 'vit', group: 'CV' }]), /重复/);
    await rejects(store.reorderPages('2026-autumn', [{ slug: 'vit', group: 'CV' }, { slug: 'missing' }]), /没有找到文档/);
    await rejects(store.reorderPages('2026-autumn', [{ slug: 'vit', group: '语音' }]), /没有“语音”这个分组/);
    await rejects(store.reorderPages('2026-autumn', [{ slug: '../x' }]), /文档名/);
    await rejects(store.reorderPages('nope', []), /没有找到这一期招新/);
    assert.deepEqual((await store.listPagesForAdmin('2026-autumn')).map((page) => [page.slug, page.order, page.group]), before);
  } finally {
    await cleanup();
  }
});

test('publishing still works when a draft page points at a group that no longer exists', async () => {
  const { store, cleanup } = await fixture();
  try {
    await store.saveCohorts([{ id: '2026-autumn', label: '26 秋季招新', status: 'draft', directions: DIRECTIONS, groups: GROUPS.slice(0, 1) }]);
    const result = await store.publishCohort('2026-autumn', { drafts: true });
    assert.equal(result.published, 1);
    assert.equal((await store.getPage('2026-autumn', 'wip')).group, '');
  } finally {
    await cleanup();
  }
});

test('preview shows an unpublished cohort the way it will look once published, only for the preview call', async () => {
  const { store, cleanup } = await fixture('draft');
  try {
    assert.equal(await store.getCohort('2026-autumn'), null);
    assert.deepEqual(await store.listPages('2026-autumn'), []);
    assert.equal(await store.getPage('2026-autumn', 'vit'), null);

    const cohort = await store.getCohort('2026-autumn', { preview: true });
    assert.equal(cohort.status, 'draft');
    assert.equal(cohort.preview, true);
    assert.equal(cohort.submission.open, true);
    assert.deepEqual(cohort.groups, GROUPS);
    assert.deepEqual((await store.listCohorts({ preview: true })).map((item) => item.id), ['2026-autumn']);
    assert.deepEqual(await store.listCohorts(), []);

    const pages = await store.listPages('2026-autumn', { preview: true });
    assert.deepEqual(pages.map((page) => page.slug), ['index', 'notice', 'vit', 'convnext', 'bert', 'wip', 'clip']);
    assert.equal(pages.find((page) => page.slug === 'wip').draft, true);
    assert.equal((await store.getPage('2026-autumn', 'wip', { preview: true })).body.trim(), '...');
    assert.equal(await store.getPage('2026-autumn', 'wip'), null);
  } finally {
    await cleanup();
  }
});

test('preview of a published cohort also shows its draft pages, a normal read does not', async () => {
  const { store, cleanup } = await fixture('current');
  try {
    assert.equal((await store.listPages('2026-autumn')).some((page) => page.slug === 'wip'), false);
    assert.equal((await store.listPages('2026-autumn', { preview: true })).some((page) => page.slug === 'wip'), true);
    assert.equal((await store.getCohort('2026-autumn', { preview: true })).preview, true);
    assert.equal((await store.getCohort('2026-autumn')).preview, undefined);
    assert.equal(await store.getCohort('missing', { preview: true }), null);
  } finally {
    await cleanup();
  }
});

test('saving a page without a sort number keeps the position the list arrows gave it', async () => {
  const { store, cleanup } = await fixture('current');
  try {
    await store.reorderPages('2026-autumn', [{ slug: 'index' }, { slug: 'vit', group: 'CV' }, { slug: 'convnext', group: 'CV' }]);
    const before = (await store.getPageForAdmin('2026-autumn', 'convnext')).order;
    await store.savePage('2026-autumn', 'convnext', { title: 'ConvNeXt v2', group: 'CV', body: '新正文' });
    assert.equal((await store.getPageForAdmin('2026-autumn', 'convnext')).order, before);
    assert.deepEqual((await store.listPages('2026-autumn')).filter((page) => page.group === 'CV').map((page) => page.slug), ['vit', 'convnext']);
    await store.savePage('2026-autumn', 'convnext', { title: 'ConvNeXt v2', group: 'CV', order: 1, body: '新正文' });
    assert.equal((await store.getPageForAdmin('2026-autumn', 'convnext')).order, 1);
  } finally {
    await cleanup();
  }
});
