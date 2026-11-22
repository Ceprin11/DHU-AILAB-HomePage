import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createChunkedUploads, MAX_CHUNK_BYTES } from '../server/chunked-uploads.js';

const setup = async (options) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-chunks-'));
  return { root, uploads: createChunkedUploads(root, options), cleanup: () => rm(root, { recursive: true, force: true }) };
};

test('a file sent in pieces, with a repeated piece and a gap, arrives intact', async () => {
  const { uploads, cleanup } = await setup();
  try {
    const content = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(3000, 7)]);
    const { id } = await uploads.start({ owner: 'a', kind: 'report', name: 'report.pdf', size: content.length });
    assert.equal((await uploads.append({ id, owner: 'a', offset: 0, data: content.subarray(0, 1000) })).received, 1000);
    // the reply was lost and the browser sends the same piece again
    assert.equal((await uploads.append({ id, owner: 'a', offset: 0, data: content.subarray(0, 1000) })).received, 1000);
    // a piece that would leave a gap is refused with where to continue
    await assert.rejects(uploads.append({ id, owner: 'a', offset: 2000, data: content.subarray(2000, 3000) }), { status: 409, received: 1000 });
    await uploads.append({ id, owner: 'a', offset: 1000, data: content.subarray(1000) });
    assert.deepEqual(uploads.status(id, 'a'), { id, received: content.length, size: content.length });
    const taken = await uploads.take({ id, owner: 'a', kind: 'report' });
    assert.deepEqual(await readFile(taken.path), content);
    assert.equal(taken.originalname, 'report.pdf');
    await assert.rejects(uploads.take({ id, owner: 'a', kind: 'report' }), { status: 404 }, 'an upload is handed over only once');
  } finally {
    await cleanup();
  }
});

test('uploads belong to one account and are checked before anything is stored', async () => {
  const { uploads, cleanup } = await setup();
  try {
    await assert.rejects(uploads.start({ owner: 'a', kind: 'report', name: 'notes.docx', size: 10 }), /仅支持 PDF/);
    await assert.rejects(uploads.start({ owner: 'a', kind: 'attachment', name: 'code.rar', size: 10 }), /\.zip/);
    await assert.rejects(uploads.start({ owner: 'a', kind: 'report', name: 'r.pdf', size: 31 * 1024 * 1024 }), { status: 413 });
    await assert.rejects(uploads.start({ owner: 'a', kind: 'attachment', name: 'c.zip', size: 0 }), /空的/);
    await assert.rejects(uploads.start({ owner: 'a', kind: 'other', name: 'c.zip', size: 5 }), /类型/);

    const { id } = await uploads.start({ owner: 'a', kind: 'attachment', name: 'code.zip', size: 10 });
    await assert.rejects(uploads.append({ id, owner: 'b', offset: 0, data: Buffer.alloc(5) }), { status: 404 }, 'another account cannot write to it');
    await assert.rejects(uploads.take({ id, owner: 'b', kind: 'attachment' }), { status: 404 });
    await assert.rejects(uploads.append({ id, owner: 'a', offset: 0, data: Buffer.alloc(11) }), /超出/);
    await assert.rejects(uploads.append({ id, owner: 'a', offset: 0, data: Buffer.alloc(MAX_CHUNK_BYTES + 1) }), { status: 413 });
    await uploads.append({ id, owner: 'a', offset: 0, data: Buffer.alloc(5) });
    await assert.rejects(uploads.take({ id, owner: 'a', kind: 'attachment' }), /还没有上传完整/);
    await assert.rejects(uploads.take({ id, owner: 'a', kind: 'report' }), /对不上/);
  } finally {
    await cleanup();
  }
});

test('each account keeps only a few unfinished uploads, and idle ones are cleared', async () => {
  let clock = 0;
  const { root, uploads, cleanup } = await setup({ now: () => clock });
  try {
    const ids = [];
    for (let i = 0; i < 6; i += 1) {
      clock += 1;
      ids.push((await uploads.start({ owner: 'a', kind: 'attachment', name: 'c.zip', size: 10 })).id);
    }
    assert.equal(uploads.size, 4);
    assert.throws(() => uploads.status(ids[0], 'a'), { status: 404 }, 'the oldest ones were dropped');
    assert.equal((await readdir(root)).length, 4, 'and their files deleted');

    clock += 3 * 60 * 60 * 1000;
    await uploads.sweep();
    assert.equal(uploads.size, 0);
    assert.deepEqual(await readdir(root), []);
  } finally {
    await cleanup();
  }
});

test('pieces sent at the same time are written in order', async () => {
  const { uploads, cleanup } = await setup();
  try {
    const content = Buffer.from('%PDF-1.7\n' + 'x'.repeat(991));
    const { id } = await uploads.start({ owner: 'a', kind: 'report', name: 'r.pdf', size: content.length });
    const results = await Promise.allSettled([0, 250, 500, 750].map((offset) => uploads.append({ id, owner: 'a', offset, data: content.subarray(offset, offset + 250) })));
    assert.ok(results.every((result) => result.status === 'fulfilled'));
    assert.deepEqual(await readFile((await uploads.take({ id, owner: 'a', kind: 'report' })).path), content);
  } finally {
    await cleanup();
  }
});
