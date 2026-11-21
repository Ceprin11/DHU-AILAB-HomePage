import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDocsStore, getSubmissionState, isInlineAsset, parseFrontmatter } from '../server/docs-store.js';

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-docs-'));
  await mkdir(path.join(root, '2026-autumn', 'assets'), { recursive: true });
  await mkdir(path.join(root, '2027-autumn'), { recursive: true });
  await writeFile(path.join(root, 'cohorts.json'), JSON.stringify([
    { id: '2026-autumn', label: '26 秋季招新', status: 'current' },
    { id: '2027-autumn', label: '27 秋季招新', status: 'upcoming' },
    { id: '../escape', label: '非法', status: 'current' },
    { id: 'no-label', label: '  ' },
  ]));
  await writeFile(path.join(root, '2026-autumn', 'index.md'), '---\ntitle: 招新总览\n---\n# 总览\n正文');
  await writeFile(path.join(root, '2026-autumn', 'gpt-2.md'), '---\ntitle: "GPT-2 教程"\norder: 2\nsummary: 入门\n---\n正文');
  await writeFile(path.join(root, '2026-autumn', 'bert.md'), '# BERT 教程\n\n没有 frontmatter');
  await writeFile(path.join(root, '2026-autumn', 'draft.md'), '---\ndraft: true\n---\n# 未完成');
  await writeFile(path.join(root, '2026-autumn', 'assets', 'fig.png'), 'png');
  await writeFile(path.join(root, '2026-autumn', 'assets', 'secret.md'), 'secret');
  await writeFile(path.join(root, 'outside.png'), 'png');
  return { root, store: createDocsStore(root), cleanup: () => rm(root, { recursive: true, force: true }) };
};

test('parses simple frontmatter and leaves plain markdown untouched', () => {
  assert.deepEqual(parseFrontmatter('---\ntitle: "A: B"\norder: 3\ndraft: true\n---\n# H'), {
    meta: { title: 'A: B', order: '3', draft: true },
    body: '# H',
  });
  assert.deepEqual(parseFrontmatter('# 只有正文\n---\n不是 frontmatter'), {
    meta: {},
    body: '# 只有正文\n---\n不是 frontmatter',
  });
});

test('lists only valid cohorts with a normalized status', async () => {
  const { store, cleanup } = await createFixture();
  try {
    const cohorts = await store.listCohorts();
    assert.deepEqual(cohorts.map((cohort) => [cohort.id, cohort.status]), [
      ['2026-autumn', 'current'],
      ['2027-autumn', 'upcoming'],
    ]);
    assert.equal((await store.getCohort('2027-autumn')).label, '27 秋季招新');
    assert.equal(await store.getCohort('../escape'), null);
  } finally {
    await cleanup();
  }
});

test('lists pages with index first, explicit order next, and drafts hidden', async () => {
  const { store, cleanup } = await createFixture();
  try {
    const pages = await store.listPages('2026-autumn');
    assert.deepEqual(pages.map((page) => page.slug), ['index', 'gpt-2', 'bert']);
    assert.equal(pages[1].title, 'GPT-2 教程');
    assert.equal(pages[1].summary, '入门');
    assert.equal(pages[2].title, 'BERT 教程');
    assert.equal(Object.hasOwn(pages[0], 'body'), false);
    assert.deepEqual(await store.listPages('2027-autumn'), []);
    assert.deepEqual(await store.listPages('missing-cohort'), []);
  } finally {
    await cleanup();
  }
});

test('reads one page and rejects drafts, unknown pages and unsafe names', async () => {
  const { store, cleanup } = await createFixture();
  try {
    const page = await store.getPage('2026-autumn', 'gpt-2');
    assert.equal(page.body, '正文');
    assert.equal(await store.getPage('2026-autumn', 'draft'), null);
    assert.equal(await store.getPage('2026-autumn', 'missing'), null);
    assert.equal(await store.getPage('2026-autumn', '../cohorts'), null);
    assert.equal(await store.getPage('../2026-autumn', 'index'), null);
  } finally {
    await cleanup();
  }
});

test('resolves only allowed assets inside the cohort directory', async () => {
  const { root, store, cleanup } = await createFixture();
  try {
    assert.equal(store.resolveAsset('2026-autumn', 'assets/fig.png'), path.join(root, '2026-autumn', 'assets', 'fig.png'));
    assert.equal(store.resolveAsset('2026-autumn', 'assets/secret.md'), null);
    assert.equal(store.resolveAsset('2026-autumn', '../outside.png'), null);
    assert.equal(store.resolveAsset('2026-autumn', '../../outside.png'), null);
    assert.equal(store.resolveAsset('../2026-autumn', 'assets/fig.png'), null);
    assert.equal(store.resolveAsset('2026-autumn', ''), null);
  } finally {
    await cleanup();
  }
});

test('lists attachments referenced by relative links and ignores everything else', async () => {
  const { root, store, cleanup } = await createFixture();
  try {
    await mkdir(path.join(root, '2026-autumn', 'templates'), { recursive: true });
    await writeFile(path.join(root, '2026-autumn', 'templates', '申请表 模板.docx'), 'docx-bytes');
    await writeFile(path.join(root, '2026-autumn', 'templates', 'data.zip'), 'zip');
    await writeFile(path.join(root, '2026-autumn', 'attach.md'), [
      '[申请表](templates/%E7%94%B3%E8%AF%B7%E8%A1%A8%20%E6%A8%A1%E6%9D%BF.docx)',
      '[同一个文件](./templates/申请表 模板.docx)'.replace(' 模板', '%20模板'),
      '[压缩包](templates/data.zip "标题")',
      '![图](assets/fig.png)',
      '[外链](https://example.com/a.docx)',
      '[越界](../outside.png)',
      '[缺失](templates/missing.pptx)',
      '[页面](index.md)',
      '```',
      '[代码里的](templates/data.zip)',
      '```',
    ].join('\n'));
    const page = await store.getPage('2026-autumn', 'attach');
    assert.deepEqual(page.attachments.map((item) => [item.name, item.label, item.size]), [
      ['申请表 模板.docx', '申请表', 10],
      ['data.zip', '压缩包', 3],
    ]);
    assert.deepEqual((await store.getPage('2026-autumn', 'index')).attachments, []);
  } finally {
    await cleanup();
  }
});

test('allows document downloads but never markdown sources or scripts', async () => {
  const { store, cleanup } = await createFixture();
  try {
    for (const name of ['a.docx', 'a.pptx', 'a.xlsx', 'a.zip', 'a.ipynb', 'a.PDF']) {
      assert.notEqual(store.resolveAsset('2026-autumn', `files/${name}`), null, name);
    }
    for (const name of ['a.md', 'a.html', 'a.js', 'a.svg', 'a.exe', 'a']) {
      assert.equal(store.resolveAsset('2026-autumn', `files/${name}`), null, name);
    }
    assert.equal(isInlineAsset('x/a.png'), true);
    assert.equal(isInlineAsset('x/a.docx'), false);
  } finally {
    await cleanup();
  }
});

test('reserves the submit slug for the submission page', async () => {
  const { root, store, cleanup } = await createFixture();
  try {
    await writeFile(path.join(root, '2026-autumn', 'submit.md'), '# 占用');
    assert.equal(await store.getPage('2026-autumn', 'submit'), null);
    assert.equal((await store.listPages('2026-autumn')).some((page) => page.slug === 'submit'), false);
  } finally {
    await cleanup();
  }
});

test('opens submissions only for the current cohort before its deadline', async () => {
  const now = new Date('2026-12-01T12:00:00+08:00');
  const open = getSubmissionState({ status: 'current', directions: ['CV', 'NLP'] }, now);
  assert.deepEqual([open.open, open.deadline, open.reason, open.directions], [true, '', '', ['CV', 'NLP']]);
  assert.ok(open.grades.includes('大二'));
  assert.deepEqual(getSubmissionState({ status: 'current' }, now).directions, []);
  assert.equal(getSubmissionState({ status: 'current', submissions: false }, now).open, false);
  assert.match(getSubmissionState({ status: 'upcoming' }, now).reason, /还没有开始/);
  assert.match(getSubmissionState({ status: 'archived' }, now).reason, /已结束/);
  assert.equal(getSubmissionState({ status: 'current', submission_deadline: '2026-12-01 12:30' }, now).open, true);
  assert.equal(getSubmissionState({ status: 'current', submission_deadline: '2026-12-01 11:59' }, now).open, false);
  assert.equal(getSubmissionState({ status: 'current', submission_deadline: '2026-12-01' }, new Date('2026-12-01T23:30:00+08:00')).open, true);
  assert.equal(getSubmissionState({ status: 'current', submission_deadline: '2026-12-01' }, new Date('2026-12-02T00:01:00+08:00')).open, false);
  assert.match(getSubmissionState({ status: 'current', submission_deadline: '下周五' }, now).reason, /配置有误/);
});

test('exposes the submission state on cohorts without leaking raw settings', async () => {
  const { store, cleanup } = await createFixture();
  try {
    const cohorts = await store.listCohorts();
    assert.equal(cohorts.find((cohort) => cohort.id === '2026-autumn').submission.open, true);
    assert.equal(cohorts.find((cohort) => cohort.id === '2027-autumn').submission.open, false);
    assert.equal(Object.hasOwn(cohorts[0], 'submission_deadline'), false);
  } finally {
    await cleanup();
  }
});
