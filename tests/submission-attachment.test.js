import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ATTACHMENT_MAX_FILE_BYTES, createSubmissionStore, validateAttachment } from '../server/recruit-submissions.js';

const fields = { name: '张三', student_id: 'A1001', grade: '大一', major: '计算机', direction: 'CLIP', qq: '11111', wechat: '', email: '' };
const pdf = () => ({ originalname: 'report.pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(16)]) });

const setup = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-attachment-'));
  const upload = async (name, content) => {
    const file = path.join(root, `${name}.upload`);
    await writeFile(file, content);
    return { path: file, originalname: name, size: content.length };
  };
  return { root, upload, store: createSubmissionStore(path.join(root, 'data')), cleanup: () => rm(root, { recursive: true, force: true }) };
};

test('stores the zip next to the report, names it after the report and hides where it is stored', async () => {
  const { root, upload, store, cleanup } = await setup();
  try {
    const zip = await upload('code.zip', Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]));
    const record = await store.add({ cohort: 'c', fields, file: pdf(), attachment: zip, applicantId: 'acc' });
    assert.equal(record.final_name, 'CLIP_张三_A1001_大一_计算机_v1.pdf');
    assert.equal(record.attachment_name, 'CLIP_张三_A1001_大一_计算机_v1_代码与结果.zip');
    assert.ok(!('attachment_stored' in record) && !('stored_name' in record));
    await assert.rejects(stat(zip.path), { code: 'ENOENT' }, 'the temporary upload is moved, not copied');
    const entry = await store.getAttachment(record.id);
    assert.equal((await stat(entry.filePath)).size, 68);
    assert.equal(entry.downloadName, record.attachment_name);
    assert.equal((await store.listOwn('c', 'acc'))[0].attachment_name, record.attachment_name);
    assert.ok((await store.list('c')).every((item) => !('attachment_stored' in item)));

    await store.remove(record.id);
    const left = await readdir(path.join(root, 'data', 'recruit-submissions', 'files'));
    assert.deepEqual(left, [], 'deleting a submission deletes both files');
  } finally {
    await cleanup();
  }
});

test('the zip is optional', async () => {
  const { store, cleanup } = await setup();
  try {
    const record = await store.add({ cohort: 'c', fields, file: pdf() });
    assert.equal(record.attachment_name, undefined);
    assert.equal(await store.getAttachment(record.id), null);
  } finally {
    await cleanup();
  }
});

test('refuses archives that are not zip files, are empty or too large, and keeps nothing', async () => {
  const { root, upload, store, cleanup } = await setup();
  try {
    await assert.rejects(store.add({ cohort: 'c', fields, file: pdf(), attachment: await upload('code.rar', Buffer.from('Rar!\x1a\x07\x00 rest')) }), /\.zip/);
    await assert.rejects(store.add({ cohort: 'c', fields, file: pdf(), attachment: await upload('fake.zip', Buffer.from('not a zip at all')) }), /不是有效的 zip/);
    await assert.rejects(store.add({ cohort: 'c', fields, file: pdf(), attachment: await upload('empty.zip', Buffer.alloc(0)) }), /空的/);
    await assert.rejects(validateAttachment({ path: '/nope', originalname: 'big.zip', size: ATTACHMENT_MAX_FILE_BYTES + 1 }), (error) => error.status === 413);
    assert.equal((await store.list('c')).length, 0);
    await assert.rejects(readdir(path.join(root, 'data', 'recruit-submissions', 'files')), { code: 'ENOENT' });
  } finally {
    await cleanup();
  }
});

test('refuses new submissions when the disk is nearly full, and writes nothing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-disk-'));
  try {
    const store = createSubmissionStore(path.join(root, 'data'), { minFreeBytes: Number.MAX_SAFE_INTEGER });
    await assert.rejects(store.add({ cohort: 'c', fields, file: pdf() }), (error) => error.status === 507 && /存储空间不足/.test(error.message));
    assert.deepEqual(await readdir(path.join(root, 'data', 'recruit-submissions', 'files')), []);
    assert.equal((await store.list('c')).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
