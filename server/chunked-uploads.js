import crypto from 'node:crypto';
import { mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { ATTACHMENT_MAX_FILE_BYTES, sanitizeOriginalName, SUBMISSION_EXTENSIONS, SUBMISSION_MAX_FILE_BYTES } from './recruit-submissions.js';

// Files for a submission are uploaded in small pieces before the submission itself is sent.
//
// The reverse proxy in front of the site ends any request that takes longer than 60 seconds. On a slow dorm or phone
// network a 20MB report already takes longer than that, so one big multipart request would fail. Each piece here is
// small enough to finish in a few seconds, a failed piece is simply sent again, and an interrupted upload continues
// from the last byte the server has.

export const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_SESSIONS_PER_OWNER = 4;
const MAX_SESSIONS = 300;
const IDLE_MS = 2 * 60 * 60 * 1000;

const KINDS = {
  report: { maxBytes: SUBMISSION_MAX_FILE_BYTES, label: '报告文件', extensions: SUBMISSION_EXTENSIONS, typeMessage: '报告文件类型不支持，仅支持 PDF、PPT、HTML' },
  attachment: { maxBytes: ATTACHMENT_MAX_FILE_BYTES, label: '压缩包', extensions: new Set(['.zip']), typeMessage: '代码与结果请打包成一个 .zip 文件' },
};

const createError = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });

export function createChunkedUploads(directory, { now = () => Date.now() } = {}) {
  const sessions = new Map();

  const discard = async (id) => {
    const session = sessions.get(id);
    sessions.delete(id);
    if (session) await rm(session.path, { force: true });
  };

  const own = (id, owner) => {
    const session = sessions.get(String(id || ''));
    if (!session || session.owner !== owner) throw createError('上传已失效，请重新选择文件后再提交', 404);
    return session;
  };

  const sweep = async () => {
    const cutoff = now() - IDLE_MS;
    await Promise.all([...sessions.values()].filter((session) => session.touchedAt < cutoff).map((session) => discard(session.id)));
  };

  return {
    async start({ owner, kind, name, size }) {
      const rules = KINDS[kind];
      if (!rules) throw createError('上传类型不正确');
      const originalname = sanitizeOriginalName(name);
      const extension = path.extname(originalname).toLowerCase();
      if (!rules.extensions.has(extension)) throw createError(rules.typeMessage);
      const bytes = Number(size);
      if (!Number.isInteger(bytes) || bytes <= 0) throw createError(`${rules.label}是空的，请重新选择`);
      if (bytes > rules.maxBytes) throw createError(`${rules.label}不能超过 ${rules.maxBytes / 1024 / 1024}MB`, 413);

      await sweep();
      // A student who keeps re-picking files only holds a few unfinished uploads; the oldest one goes.
      const mine = [...sessions.values()].filter((session) => session.owner === owner).sort((a, b) => a.touchedAt - b.touchedAt);
      for (const old of mine.slice(0, Math.max(0, mine.length - MAX_SESSIONS_PER_OWNER + 1))) await discard(old.id);
      if (sessions.size >= MAX_SESSIONS) throw createError('现在提交的人比较多，请稍等几分钟再试', 503);

      await mkdir(directory, { recursive: true });
      const id = crypto.randomUUID();
      const file = path.join(directory, `${id}.part`);
      const handle = await open(file, 'wx');
      await handle.close();
      sessions.set(id, { id, owner, kind, originalname, size: bytes, received: 0, path: file, touchedAt: now(), queue: Promise.resolve() });
      return { id, received: 0, size: bytes, chunk_bytes: MAX_CHUNK_BYTES };
    },

    status(id, owner) {
      const session = own(id, owner);
      return { id: session.id, received: session.received, size: session.size };
    },

    // `offset` is where this piece starts. A piece the server already has (a retry after a lost reply) is accepted
    // without writing it again; a piece that would leave a gap is refused with the offset to continue from.
    async append({ id, owner, offset, data }) {
      const session = own(id, owner);
      const run = async () => {
        const start = Number(offset);
        const length = data?.length || 0;
        if (!Number.isInteger(start) || start < 0) throw createError('上传位置不正确');
        if (!length) throw createError('上传内容是空的');
        if (length > MAX_CHUNK_BYTES) throw createError('上传分片太大', 413);
        if (start + length > session.size) throw createError('上传内容超出了文件大小，请重新选择文件', 400);
        session.touchedAt = now();
        if (start + length <= session.received) return { received: session.received, size: session.size };
        if (start !== session.received) throw createError('上传位置不连续', 409, { received: session.received });
        const handle = await open(session.path, 'r+');
        try {
          await handle.write(data, 0, length, start);
        } finally {
          await handle.close();
        }
        session.received = start + length;
        return { received: session.received, size: session.size };
      };
      const result = session.queue.then(run, run);
      session.queue = result.catch(() => {});
      return result;
    },

    // Hands a finished upload over to the submission. The caller owns the file from here on.
    async take({ id, owner, kind }) {
      const session = own(id, owner);
      await session.queue;
      if (session.kind !== kind) throw createError('上传的文件和提交的项目对不上，请重新选择文件');
      if (session.received !== session.size) throw createError(`${KINDS[kind].label}还没有上传完整，请重新提交`);
      sessions.delete(session.id);
      return { path: session.path, originalname: session.originalname, size: session.size };
    },

    discard,
    sweep,
    get size() {
      return sessions.size;
    },
  };
}
