import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSubmissionStore } from '../server/recruit-submissions.js';

const fields = (direction) => ({ name: '张三', student_id: 'A1001', grade: '大一', major: '计算机', direction, qq: '11111', wechat: '', email: '' });
const pdf = () => ({ originalname: 'report.pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(16)]) });

const setup = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-optional-report-'));
  return { root, store: createSubmissionStore(path.join(root, 'data')), cleanup: () => rm(root, { recursive: true, force: true }) };
};

test('before the lock a paper can be chosen without a report; the first report is still v1', async () => {
  const { store, cleanup } = await setup();
  try {
    const choice = await store.add({ cohort: 'c', fields: fields('CLIP'), applicantId: 'acc', reportRequired: false });
    assert.equal(choice.has_report, false);
    assert.equal(choice.final_name, '');
    assert.equal(choice.version, 0);
    assert.equal(await store.getFile(choice.id), null, 'there is no file to download');

    const changed = await store.add({ cohort: 'c', fields: fields('BLIP'), applicantId: 'acc', reportRequired: false });
    assert.equal(await store.lockedDirection('c', 'A1001'), 'BLIP', 'the newest choice counts');

    const report = await store.add({ cohort: 'c', fields: fields('BLIP'), file: pdf(), applicantId: 'acc', reportRequired: false });
    assert.equal(report.has_report, true);
    assert.equal(report.final_name, 'BLIP_张三_A1001_大一_计算机_v1.pdf');

    const own = await store.listOwn('c', 'acc');
    assert.deepEqual(own.map((item) => item.has_report), [true, false, false]);
    assert.ok((await store.list('c')).every((item) => typeof item.has_report === 'boolean'));

    assert.equal(await store.remove(changed.id), true, 'a choice without a report can be deleted');
  } finally {
    await cleanup();
  }
});

test('after the lock, or with a zip, the report is required', async () => {
  const { root, store, cleanup } = await setup();
  try {
    await assert.rejects(store.add({ cohort: 'c', fields: fields('CLIP'), applicantId: 'acc' }), { message: '请选择要提交的报告文件', status: 400 });
    const zipPath = path.join(root, 'code.upload');
    await writeFile(zipPath, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16)]));
    await assert.rejects(
      store.add({ cohort: 'c', fields: fields('CLIP'), applicantId: 'acc', reportRequired: false, attachment: { path: zipPath, originalname: 'code.zip', size: 20 } }),
      /同时上传报告/,
    );
    assert.deepEqual(await store.list('c'), []);
  } finally {
    await cleanup();
  }
});

test('the paper chosen without a report is the one that locks', async () => {
  const { store, cleanup } = await setup();
  try {
    await store.add({ cohort: 'c', fields: fields('CLIP'), applicantId: 'acc', reportRequired: false });
    await assert.rejects(store.add({ cohort: 'c', fields: fields('BLIP'), file: pdf(), applicantId: 'acc', lockDirection: true }), { status: 409 });
    const report = await store.add({ cohort: 'c', fields: fields('CLIP'), file: pdf(), applicantId: 'acc', lockDirection: true });
    assert.equal(report.version, 1);
  } finally {
    await cleanup();
  }
});
