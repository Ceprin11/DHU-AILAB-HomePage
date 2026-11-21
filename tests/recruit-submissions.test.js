import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildSubmissionFileName,
  createSubmissionStore,
  normalizeSubmissionFields,
  sanitizeOriginalName,
  SUBMISSION_MAX_FILE_BYTES,
  validateSubmissionFile,
} from '../server/recruit-submissions.js';

const options = { directions: ['ViT', 'GPT-2'], grades: ['大一', '大二'] };
const form = (overrides = {}) => ({
  name: ' 张三 ', student_id: '2250001', grade: '大二', major: '人工智能', direction: 'GPT-2', qq: '12345678', note: '你好\u0000', ...overrides,
});
const zipFile = (name = '作业.pptx', size = 64) => ({
  originalname: name,
  buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(size)]),
});

test('requires every identity field and trims them', () => {
  assert.deepEqual(normalizeSubmissionFields(form(), options), {
    name: '张三', student_id: '2250001', grade: '大二', major: '人工智能', direction: 'GPT-2', qq: '12345678', wechat: '', email: '', note: '你好',
  });
  assert.throws(() => normalizeSubmissionFields(form({ name: '' }), options), /请填写姓名/);
  assert.throws(() => normalizeSubmissionFields(form({ student_id: '' }), options), /请填写学号/);
  assert.throws(() => normalizeSubmissionFields(form({ student_id: '22 5/0' }), options), /学号应为/);
  assert.throws(() => normalizeSubmissionFields(form({ student_id: '123' }), options), /学号应为/);
  assert.throws(() => normalizeSubmissionFields(form({ major: '  ' }), options), /请填写专业/);
  assert.throws(() => normalizeSubmissionFields(form({ name: 'a'.repeat(31) }), options), /姓名不能超过 30/);
  assert.throws(() => normalizeSubmissionFields(form({ note: 'n'.repeat(1001) }), options), /备注不能超过/);
});

test('needs at least one valid contact among QQ, WeChat and email', () => {
  const none = { qq: '', wechat: '', email: '' };
  assert.throws(() => normalizeSubmissionFields(form(none), options), /至少填写一个/);
  assert.throws(() => normalizeSubmissionFields(form({ ...none, qq: '   ' }), options), /至少填写一个/);
  assert.equal(normalizeSubmissionFields(form({ ...none, wechat: 'kepler_0614' }), options).wechat, 'kepler_0614');
  assert.equal(normalizeSubmissionFields(form({ ...none, email: 'a@b.cn' }), options).email, 'a@b.cn');
  assert.deepEqual(
    (({ qq, wechat, email }) => [qq, wechat, email])(normalizeSubmissionFields(form({ qq: '12345', wechat: 'abc_1', email: 'x@y.com' }), options)),
    ['12345', 'abc_1', 'x@y.com'],
  );
  assert.throws(() => normalizeSubmissionFields(form({ qq: '1234' }), options), /QQ 号应为/);
  assert.throws(() => normalizeSubmissionFields(form({ qq: '12ab5678' }), options), /QQ 号应为/);
  assert.throws(() => normalizeSubmissionFields(form({ wechat: '微信号' }), options), /微信号只能包含/);
  assert.throws(() => normalizeSubmissionFields(form({ qq: '', email: 'not-an-email' }), options), /邮箱格式不正确/);
  assert.throws(() => normalizeSubmissionFields(form({ qq: '', email: 'a b@c.com' }), options), /邮箱格式不正确/);
});

test('accepts only configured grades and directions', () => {
  assert.throws(() => normalizeSubmissionFields(form({ grade: '' }), options), /请选择年级/);
  assert.throws(() => normalizeSubmissionFields(form({ grade: '大三' }), options), /年级不在可选范围内/);
  assert.throws(() => normalizeSubmissionFields(form({ grade: '研一' }), options), /年级不在可选范围内/);
  assert.throws(() => normalizeSubmissionFields(form({ direction: '' }), options), /请选择方向/);
  assert.throws(() => normalizeSubmissionFields(form({ direction: '../etc' }), options), /方向不在可选范围内/);
  assert.equal(normalizeSubmissionFields(form({ direction: 'ignored' }), { ...options, directions: [] }).direction, '');
});

test('builds a predictable file name from the identity fields', () => {
  const fields = { direction: 'GPT-2', name: '张三', student_id: '2250001', grade: '大二', major: '人工智能' };
  assert.equal(buildSubmissionFileName(fields, 1, '.pptx'), 'GPT-2_张三_2250001_大二_人工智能_v1.pptx');
  assert.equal(buildSubmissionFileName(fields, 3, '.pdf'), 'GPT-2_张三_2250001_大二_人工智能_v3.pdf');
  assert.equal(
    buildSubmissionFileName({ ...fields, name: '../李 四:*?', major: '计算机/科学 与技术.exe' }, 1, '.docx'),
    'GPT-2_李四_2250001_大二_计算机科学与技术exe_v1.docx',
  );
  assert.equal(buildSubmissionFileName({ ...fields, direction: '' }, 1, '.pdf'), '张三_2250001_大二_人工智能_v1.pdf');
});

test('only accepts supported file types whose content matches the extension', () => {
  assert.equal(validateSubmissionFile(zipFile('a.pptx')), '.pptx');
  assert.equal(validateSubmissionFile({ originalname: 'a.PDF', buffer: Buffer.from('%PDF-1.7 body') }), '.pdf');
  assert.equal(validateSubmissionFile({ originalname: 'a.PPT', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]) }), '.ppt');
  assert.equal(validateSubmissionFile({ originalname: 'a.html', buffer: Buffer.from('<!doctype html><h1>报告</h1>') }), '.html');
  assert.equal(validateSubmissionFile({ originalname: 'a.HTM', buffer: Buffer.from('<p>hi</p>') }), '.htm');
  for (const name of ['a.exe', 'a.svg', 'a.js', 'a.docx', 'a.doc', 'a.zip', 'a.md', 'a.txt', 'a.ipynb', 'a.py', 'a.xhtml', 'a']) {
    assert.throws(() => validateSubmissionFile({ originalname: name, buffer: Buffer.from('<p>x</p>') }), /仅支持 PDF、PPT、HTML/, name);
  }
  assert.throws(() => validateSubmissionFile({ originalname: 'fake.pdf', buffer: Buffer.from('not a pdf') }), /与扩展名不符/);
  assert.throws(() => validateSubmissionFile({ originalname: 'fake.pptx', buffer: Buffer.from('plain text') }), /与扩展名不符/);
  assert.throws(() => validateSubmissionFile({ originalname: 'fake.ppt', buffer: Buffer.from('plain text') }), /与扩展名不符/);
  assert.throws(() => validateSubmissionFile({ originalname: 'bin.html', buffer: Buffer.from([60, 0, 66]) }), /与扩展名不符/);
  assert.throws(() => validateSubmissionFile({ originalname: 'plain.html', buffer: Buffer.from('no markup here') }), /与扩展名不符/);
  assert.throws(() => validateSubmissionFile({ originalname: 'a.pdf', buffer: Buffer.alloc(0) }), /请选择要提交的文件/);
  assert.throws(() => validateSubmissionFile({ originalname: 'big.pptx', buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(SUBMISSION_MAX_FILE_BYTES)]) }), /文件不能超过/);
});

test('removes path segments and control characters from original file names', () => {
  assert.equal(sanitizeOriginalName('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeOriginalName('C:\\Users\\me\\简历.docx'), '简历.docx');
  assert.equal(sanitizeOriginalName('a\u0007b\n.pdf'), 'ab.pdf');
  assert.equal(sanitizeOriginalName(''), 'file');
});

test('stores a submission privately under the enforced name', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-submissions-'));
  try {
    const store = createSubmissionStore(root);
    const fields = normalizeSubmissionFields(form(), options);
    const record = await store.add({ cohort: '2026-autumn', fields, file: zipFile('../我的作业.pptx') });
    assert.equal(record.final_name, 'GPT-2_张三_2250001_大二_人工智能_v1.pptx');
    assert.equal(record.original_name, '我的作业.pptx');
    assert.equal(record.version, 1);
    assert.equal(Object.hasOwn(record, 'stored_name'), false);

    const entry = await store.getFile(record.id);
    assert.equal(entry.downloadName, 'GPT-2_张三_2250001_大二_人工智能_v1.pptx');
    assert.ok(entry.filePath.startsWith(path.join(root, 'recruit-submissions', 'files')));
    assert.equal(path.basename(entry.filePath).includes('张三'), false);
    assert.equal((await readFile(entry.filePath)).length, record.size);
    assert.equal(['qq', 'wechat', 'email'].some((key) => Object.hasOwn(entry.record, key)), false);
    assert.equal(await store.getFile('missing'), null);
    assert.equal(await store.getFile('../index'), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('numbers repeated submissions instead of overwriting earlier ones', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-submissions-'));
  try {
    const store = createSubmissionStore(root);
    const nlp = normalizeSubmissionFields(form(), options);
    const cv = normalizeSubmissionFields(form({ direction: 'ViT' }), options);
    const other = normalizeSubmissionFields(form({ student_id: '2250002', name: '李四' }), options);
    const first = await store.add({ cohort: '2026-autumn', fields: nlp, file: zipFile('a.pptx') });
    const second = await store.add({ cohort: '2026-autumn', fields: nlp, file: zipFile('b.pptx') });
    const differentDirection = await store.add({ cohort: '2026-autumn', fields: cv, file: zipFile('c.pptx') });
    const differentPerson = await store.add({ cohort: '2026-autumn', fields: other, file: zipFile('d.pptx') });
    const nextCohort = await store.add({ cohort: '2027-autumn', fields: nlp, file: zipFile('e.pptx') });
    assert.deepEqual([first, second, differentDirection, differentPerson, nextCohort].map((item) => item.version), [1, 2, 1, 1, 1]);
    assert.equal(second.final_name, 'GPT-2_张三_2250001_大二_人工智能_v2.pptx');
    assert.equal((await store.getFile(first.id)).downloadName, 'GPT-2_张三_2250001_大二_人工智能_v1.pptx');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hides contact details unless explicitly requested and lists newest first', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-submissions-'));
  try {
    const store = createSubmissionStore(root);
    const fields = normalizeSubmissionFields(form(), options);
    const first = await store.add({ cohort: '2026-autumn', fields, file: zipFile('a.pptx') });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await store.add({ cohort: '2026-autumn', fields, file: zipFile('b.pptx') });

    const forMember = await store.list('2026-autumn');
    assert.deepEqual(forMember.map((item) => item.id), [second.id, first.id]);
    assert.equal(forMember.some((item) => ['qq', 'wechat', 'email', 'contact', 'stored_name'].some((key) => Object.hasOwn(item, key))), false);
    const forAdmin = await store.list('2026-autumn', { includeContact: true });
    assert.equal(forAdmin[0].qq, '12345678');
    assert.equal(forAdmin.some((item) => Object.hasOwn(item, 'stored_name')), false);
    assert.deepEqual(await store.list('2027-autumn'), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('deletes both the record and the stored file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-submissions-'));
  try {
    const store = createSubmissionStore(root);
    const fields = normalizeSubmissionFields(form(), options);
    const first = await store.add({ cohort: '2026-autumn', fields, file: zipFile('a.pptx') });
    const second = await store.add({ cohort: '2026-autumn', fields, file: zipFile('b.pptx') });
    const { filePath } = await store.getFile(first.id);
    assert.equal(await store.remove(first.id), true);
    assert.equal(await store.remove(first.id), false);
    await assert.rejects(access(filePath));
    assert.deepEqual((await store.list()).map((item) => item.id), [second.id]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('keeps every record and unique versions when submissions arrive at the same time', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-submissions-'));
  try {
    const store = createSubmissionStore(root);
    const fields = normalizeSubmissionFields(form(), options);
    await Promise.all(Array.from({ length: 12 }, (_, index) => store.add({ cohort: '2026-autumn', fields, file: zipFile(`${index}.pptx`) })));
    const records = await store.list('2026-autumn');
    assert.equal(records.length, 12);
    assert.deepEqual(records.map((item) => item.version).sort((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index + 1));
    assert.equal(new Set(records.map((item) => item.final_name)).size, 12);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
