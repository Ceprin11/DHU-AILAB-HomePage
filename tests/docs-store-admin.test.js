import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ASSET_MAX_BYTES, createDocsStore, sanitizeAssetName, seedContentDirectory } from '../server/docs-store.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(32)]);

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-docs-admin-'));
  const store = createDocsStore(root);
  await store.saveCohorts([
    { id: '2026-autumn', label: '26 秋季招新', status: 'current', directions: ['ViT', 'BERT'] },
    { id: '2027-autumn', label: '27 秋季招新', status: 'upcoming' },
  ]);
  return { root, store, cleanup: () => rm(root, { recursive: true, force: true }) };
};

const rejects = (promise, pattern, status) => assert.rejects(promise, (error) => {
  assert.match(error.message, pattern);
  if (status) assert.equal(error.status, status);
  return true;
});

test('saves cohorts, normalizes them and drops empty settings', async () => {
  const { root, store, cleanup } = await fixture();
  try {
    const saved = await store.saveCohorts([
      { id: '2026-autumn', label: ' 26 秋季招新 ', status: 'current', description: '  ', directions: [' ViT ', 'ViT', '', 'BERT'], submission_deadline: '2026-12-06 18:00', submissions: true },
      { id: '2026-summer', label: '26 暑期招新', status: 'archived', submissions: false },
    ]);
    assert.deepEqual(saved[0], { id: '2026-autumn', label: '26 秋季招新', status: 'current', directions: ['ViT', 'BERT'], submission_deadline: '2026-12-06 18:00' });
    assert.deepEqual(saved[1], { id: '2026-summer', label: '26 暑期招新', status: 'archived', submissions: false });
    const admin = await store.readCohortsForAdmin();
    assert.equal(admin[0].submissions, true);
    assert.equal(admin[1].submissions, false);
    assert.equal(admin[0].submission_deadline, '2026-12-06 18:00');
    assert.equal((await store.getCohort('2026-autumn')).submission.directions.length, 2);
    assert.match(await readFile(path.join(root, 'cohorts.json'), 'utf8'), /"2026-autumn"/);
  } finally {
    await cleanup();
  }
});

test('rejects invalid cohort settings', async () => {
  const { store, cleanup } = await fixture();
  try {
    const base = { id: 'a-1', label: 'A', status: 'archived' };
    await rejects(store.saveCohorts('nope'), /批次列表不正确/);
    await rejects(store.saveCohorts([{ ...base, id: '../x' }]), /批次编号/);
    await rejects(store.saveCohorts([{ ...base, id: 'Upper' }]), /批次编号/);
    await rejects(store.saveCohorts([{ ...base, label: '  ' }]), /批次名称/);
    await rejects(store.saveCohorts([{ ...base, status: 'weird' }]), /批次状态/);
    await rejects(store.saveCohorts([base, base]), /不能重复/);
    await rejects(store.saveCohorts([{ ...base, status: 'current' }, { ...base, id: 'b-2', status: 'current' }]), /只能有一个/);
    await rejects(store.saveCohorts([{ ...base, submission_deadline: '下周五' }]), /截止时间格式/);
    await rejects(store.saveCohorts([{ ...base, directions: Array.from({ length: 21 }, (_, i) => `d${i}`) }]), /最多 20/);
    await rejects(store.saveCohorts([{ ...base, directions: ['x'.repeat(31)] }]), /不超过 30/);
    assert.equal((await store.readCohortsForAdmin()).length, 2, 'failed saves must not change the saved list');
  } finally {
    await cleanup();
  }
});

test('creates, edits and deletes a page, keeping drafts private', async () => {
  const { store, cleanup } = await fixture();
  try {
    await store.savePage('2026-autumn', 'gpt-2', { title: 'GPT-2: 教程', order: 2, summary: '他说"好"', draft: false, body: '# 正文\r\n\r\n内容  \n\n' });
    await store.savePage('2026-autumn', 'index', { title: '总招新文档', body: '总览' });
    await store.savePage('2026-autumn', 'wip', { title: '草稿', draft: true, body: '没写完' });

    const raw = await store.getPageForAdmin('2026-autumn', 'gpt-2');
    assert.deepEqual([raw.title, raw.order, raw.summary, raw.draft, raw.body], ['GPT-2: 教程', 2, '他说"好"', false, '# 正文\n\n内容\n']);

    assert.deepEqual((await store.listPages('2026-autumn')).map((page) => page.slug), ['index', 'gpt-2']);
    const adminList = await store.listPagesForAdmin('2026-autumn');
    assert.deepEqual(adminList.map((page) => [page.slug, page.draft]), [['index', false], ['gpt-2', false], ['wip', true]]);
    assert.equal(await store.getPage('2026-autumn', 'wip'), null);

    await store.savePage('2026-autumn', 'gpt-2', { title: '改名', order: '', body: '新内容' });
    const edited = await store.getPageForAdmin('2026-autumn', 'gpt-2');
    assert.deepEqual([edited.title, edited.order, edited.summary, edited.body], ['改名', '', '', '新内容\n']);

    assert.equal(await store.deletePage('2026-autumn', 'gpt-2'), true);
    assert.equal(await store.deletePage('2026-autumn', 'gpt-2'), false);
    assert.equal(await store.getPageForAdmin('2026-autumn', 'gpt-2'), null);
  } finally {
    await cleanup();
  }
});

test('validates page names, limits and the target cohort', async () => {
  const { store, cleanup } = await fixture();
  try {
    for (const slug of ['../x', 'a/b', 'a.b', 'a b', '', 'x'.repeat(61)]) {
      await rejects(store.savePage('2026-autumn', slug, { body: 'x' }), /文档名只能包含/, 400);
    }
    for (const slug of ['submit', 'submissions']) await rejects(store.savePage('2026-autumn', slug, { body: 'x' }), /系统保留/);
    await rejects(store.savePage('2026-autumn', 'a', { title: 't'.repeat(101), body: 'x' }), /标题不能超过/);
    await rejects(store.savePage('2026-autumn', 'a', { summary: 's'.repeat(301), body: 'x' }), /简介不能超过/);
    await rejects(store.savePage('2026-autumn', 'a', { order: 'abc', body: 'x' }), /排序必须是数字/);
    await rejects(store.savePage('2026-autumn', 'a', { body: 'x'.repeat(400001) }), /正文太长/);
    await rejects(store.savePage('2099-unknown', 'a', { body: 'x' }), /没有找到这一期招新/, 404);
    await rejects(store.savePage('../2026-autumn', 'a', { body: 'x' }), /没有找到这一期招新/, 404);
    await rejects(store.listPagesForAdmin('nope'), /没有找到这一期招新/, 404);
  } finally {
    await cleanup();
  }
});

test('imports a markdown file, honouring its front matter and refusing silent overwrites', async () => {
  const { store, cleanup } = await fixture();
  try {
    const text = '---\ntitle: BERT 教程\norder: 4\ndraft: true\n---\n# BERT\n\n正文';
    assert.deepEqual(await store.importPage('2026-autumn', { filename: '实验室招新 BERT (终版).md', text }), { slug: '实验室招新-BERT-终版', directory: '2026-autumn' });
    const page = await store.getPageForAdmin('2026-autumn', '实验室招新-BERT-终版');
    assert.deepEqual([page.title, page.order, page.draft, page.body], ['BERT 教程', 4, true, '# BERT\n\n正文\n']);

    await rejects(store.importPage('2026-autumn', { filename: '实验室招新 BERT (终版).md', text: '# 新' }), /已存在同名文档/, 409);
    await store.importPage('2026-autumn', { filename: '实验室招新 BERT (终版).md', text: '# 新', overwrite: true });
    assert.equal((await store.getPageForAdmin('2026-autumn', '实验室招新-BERT-终版')).body, '# 新\n');

    assert.equal((await store.importPage('2026-autumn', { filename: 'submit.md', text: '# x' })).slug, 'submit-doc');
    await rejects(store.importPage('2026-autumn', { filename: '!!!.md', text: '# x' }), /无法从文件名/);
  } finally {
    await cleanup();
  }
});

test('stores assets under safe names, never overwriting existing files', async () => {
  const { root, store, cleanup } = await fixture();
  try {
    const first = await store.saveAsset('2026-autumn', { filename: '范式对比 微调.PNG', buffer: PNG });
    assert.deepEqual([first.path, first.inline, first.extension], ['assets/范式对比_微调.png', true, '.png']);
    const second = await store.saveAsset('2026-autumn', { filename: '范式对比 微调.png', buffer: PNG });
    assert.equal(second.path, 'assets/范式对比_微调-2.png');
    const doc = await store.saveAsset('2026-autumn', { directory: 'templates', filename: '../../报告 模板.zip', buffer: ZIP });
    assert.deepEqual([doc.path, doc.inline], ['templates/报告_模板.zip', false]);
    assert.ok((await stat(path.join(root, '2026-autumn', 'templates', '报告_模板.zip'))).isFile());

    assert.deepEqual((await store.listAssets('2026-autumn')).map((item) => item.path), ['assets/范式对比_微调-2.png', 'assets/范式对比_微调.png', 'templates/报告_模板.zip']);
    assert.notEqual(store.resolveAsset('2026-autumn', first.path), null);
  } finally {
    await cleanup();
  }
});

test('refuses unsafe assets', async () => {
  const { store, cleanup } = await fixture();
  try {
    const upload = (filename, buffer = PNG, extra = {}) => store.saveAsset('2026-autumn', { filename, buffer, ...extra });
    for (const name of ['a.html', 'a.svg', 'a.js', 'a.md', 'a.exe', 'a', '.png']) await rejects(upload(name), /不支持的文件类型/, 400);
    await rejects(upload('fake.png', Buffer.from('not a png')), /与扩展名 \.png 不符/);
    await rejects(upload('fake.pdf', PNG), /与扩展名 \.pdf 不符/);
    await rejects(upload('fake.docx', Buffer.from('plain text')), /与扩展名 \.docx 不符/);
    await rejects(upload('bin.txt', Buffer.from([65, 0, 66])), /与扩展名 \.txt 不符/);
    await rejects(upload('a.png', Buffer.alloc(0)), /文件是空的/);
    await rejects(upload('big.zip', Buffer.concat([ZIP, Buffer.alloc(ASSET_MAX_BYTES)])), /不能超过/, 413);
    for (const directory of ['../x', 'a/b/c', '..', 'a b', 'x'.repeat(31)]) await rejects(upload('a.png', PNG, { directory }), /文件夹名/);
    await rejects(store.saveAsset('2099-unknown', { filename: 'a.png', buffer: PNG }), /没有找到这一期招新/, 404);
    assert.deepEqual(await store.listAssets('2026-autumn'), []);
  } finally {
    await cleanup();
  }
});

test('deletes only assets inside the cohort folder', async () => {
  const { root, store, cleanup } = await fixture();
  try {
    await writeFile(path.join(root, 'outside.png'), PNG);
    const saved = await store.saveAsset('2026-autumn', { filename: 'a.png', buffer: PNG });
    await rejects(store.deleteAsset('2026-autumn', '../outside.png'), /文件路径不正确/);
    await rejects(store.deleteAsset('2026-autumn', 'cohorts.json'), /文件路径不正确/);
    assert.ok((await stat(path.join(root, 'outside.png'))).isFile());
    assert.equal(await store.deleteAsset('2026-autumn', saved.path), true);
    assert.equal(await store.deleteAsset('2026-autumn', saved.path), false);
  } finally {
    await cleanup();
  }
});

test('cleans asset names', () => {
  assert.equal(sanitizeAssetName('范式对比 微调vs零样本.PNG'), '范式对比_微调vs零样本.png');
  assert.equal(sanitizeAssetName('../../etc/passwd.docx'), 'passwd.docx');
  assert.equal(sanitizeAssetName('..hidden.pdf'), 'hidden.pdf');
  assert.equal(sanitizeAssetName('a b/c\\d:e*f.pdf'), 'd_e_f.pdf');
  assert.equal(sanitizeAssetName(''), '');
});

test('seeds content once and never overwrites existing content', async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), 'ailab-seed-'));
  try {
    const source = path.join(base, 'content');
    const target = path.join(base, 'data', 'recruit-content');
    await mkdir(path.join(source, '2026-autumn'), { recursive: true });
    await writeFile(path.join(source, 'cohorts.json'), '[]');
    await writeFile(path.join(source, 'README.md'), 'author notes');
    await writeFile(path.join(source, '2026-autumn', 'index.md'), '# 起始');

    assert.equal(await seedContentDirectory(path.join(base, 'missing'), target), false);
    assert.equal(await seedContentDirectory(source, target), true);
    assert.equal(await readFile(path.join(target, '2026-autumn', 'index.md'), 'utf8'), '# 起始');
    await assert.rejects(stat(path.join(target, 'README.md')));

    await writeFile(path.join(target, '2026-autumn', 'index.md'), '# 管理员改过');
    await writeFile(path.join(source, '2026-autumn', 'index.md'), '# 仓库又改了');
    assert.equal(await seedContentDirectory(source, target), false);
    assert.equal(await readFile(path.join(target, '2026-autumn', 'index.md'), 'utf8'), '# 管理员改过');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test('serializes writes so concurrent saves never lose pages', async () => {
  const { store, cleanup } = await fixture();
  try {
    await Promise.all(Array.from({ length: 15 }, (_, index) => store.savePage('2026-autumn', `p${index}`, { title: `P${index}`, order: index, body: `b${index}` })));
    assert.equal((await store.listPagesForAdmin('2026-autumn')).length, 15);
  } finally {
    await cleanup();
  }
});
