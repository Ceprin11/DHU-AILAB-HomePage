import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

// Secrets that must never come only from a file checked into the repository.
//
// The session signing key mixes SESSION_SECRET with a random key that is created once on the server and kept in
// data/secrets. Anyone who has read SESSION_SECRET (for example from a public docker-compose.yml) still cannot sign a
// session cookie.
//
// The super administrator's password starts as ADMIN_PASSWORD. Once it is changed from the website, the new password
// is stored as a scrypt hash in data/secrets and ADMIN_PASSWORD stops working.

const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
export const ADMIN_PASSWORD_MIN_LENGTH = 12;

const secretsDirectoryOf = (dataDirectory) => path.join(dataDirectory, 'secrets');

const createError = (message, status) => Object.assign(new Error(message), { status });

const writePrivateFile = async (target, contents) => {
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, target);
};

export async function loadSessionKey(dataDirectory, environmentSecret = '') {
  const directory = secretsDirectoryOf(dataDirectory);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'session-key');
  let localKey = '';
  try {
    localKey = (await readFile(file, 'utf8')).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (localKey.length < 32) {
    localKey = crypto.randomBytes(48).toString('base64url');
    try {
      // 'wx' so two processes starting together cannot end up with different keys.
      await writeFile(file, `${localKey}\n`, { mode: 0o600, flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      localKey = (await readFile(file, 'utf8')).trim();
    }
  }
  return crypto.createHash('sha256').update(String(environmentSecret)).update('\0').update(localKey).digest();
}

const sameText = (a, b) => {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
};

export function createAdminCredentials(dataDirectory, { environmentPassword }) {
  const file = path.join(secretsDirectoryOf(dataDirectory), 'admin-password.json');
  let cached;
  let queue = Promise.resolve();

  const read = async () => {
    if (cached !== undefined) return cached;
    try {
      const record = JSON.parse(await readFile(file, 'utf8'));
      cached = record && record.salt && record.hash ? record : null;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      cached = null;
    }
    return cached;
  };

  const matches = async (password) => {
    const record = await read();
    if (!record) return sameText(password, environmentPassword);
    const key = Buffer.from(await scryptAsync(String(password), Buffer.from(record.salt, 'base64'), KEY_LENGTH));
    const expected = Buffer.from(record.hash, 'base64');
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  };

  return {
    // Increases every time the password changes, so sessions signed before the change stop working.
    async version() {
      return (await read())?.version || 0;
    },

    async isCustomized() {
      return Boolean(await read());
    },

    verify: matches,

    change(currentPassword, nextPassword) {
      const run = async () => {
        const next = String(nextPassword || '');
        if (!await matches(currentPassword || '')) throw createError('当前密码错误', 401);
        if (next.length < ADMIN_PASSWORD_MIN_LENGTH) throw createError(`新密码至少需要 ${ADMIN_PASSWORD_MIN_LENGTH} 位`, 400);
        if (next.length > 128) throw createError('新密码不能超过 128 位', 400);
        if (next === String(currentPassword) || sameText(next, environmentPassword)) throw createError('新密码不能和原来的密码相同', 400);
        const salt = crypto.randomBytes(16);
        const hash = Buffer.from(await scryptAsync(next, salt, KEY_LENGTH)).toString('base64');
        const record = { salt: salt.toString('base64'), hash, version: ((await read())?.version || 0) + 1, updated_at: new Date().toISOString() };
        await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
        await writePrivateFile(file, `${JSON.stringify(record, null, 2)}\n`);
        cached = record;
        return record.version;
      };
      const result = queue.then(run, run);
      queue = result.catch(() => {});
      return result;
    },
  };
}
