import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { SUBMISSION_GRADES } from './docs-store.js';

// Accounts for people who apply to the lab. They are not members: they can only sign in to fill in the application,
// and nothing in the member or admin API accepts their session.
const scryptAsync = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9]{4,20}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;
// No 0/O/1/l/I: temporary passwords are read out and typed by hand.
const TEMP_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// eslint-disable-next-line no-control-regex
const clean = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
const idKey = (value) => String(value ?? '').trim().toLowerCase();

export const normalizeApplicantProfile = (input = {}) => {
  const name = clean(input.name);
  const studentId = clean(input.student_id);
  const grade = clean(input.grade);
  const major = clean(input.major);
  if (!name) throw createError('请填写姓名');
  if (name.length > 30) throw createError('姓名不能超过 30 个字');
  if (!STUDENT_ID_PATTERN.test(studentId)) throw createError('学号应为 4-20 位字母或数字');
  if (!SUBMISSION_GRADES.includes(grade)) throw createError('请选择年级');
  if (!major) throw createError('请填写专业');
  if (major.length > 30) throw createError('专业不能超过 30 个字');
  return { name, student_id: studentId, grade, major };
};

export const validatePassword = (password) => {
  const value = String(password ?? '');
  if (value.length < PASSWORD_MIN) throw createError(`密码至少 ${PASSWORD_MIN} 位`);
  if (value.length > PASSWORD_MAX) throw createError(`密码不能超过 ${PASSWORD_MAX} 位`);
  return value;
};

const derive = async (password, salt) => Buffer.from(await scryptAsync(String(password), salt, KEY_LENGTH)).toString('base64');

const passwordRecord = async (password) => {
  const salt = crypto.randomBytes(16).toString('base64');
  return { password_salt: salt, password_hash: await derive(password, salt) };
};

const passwordMatches = async (password, record) => {
  const actual = Buffer.from(await derive(password, record.password_salt), 'base64');
  const expected = Buffer.from(record.password_hash, 'base64');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const generateTemporaryPassword = () => Array.from(crypto.randomBytes(10), (byte) => TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]).join('');

// What leaves the store: never the password hash or salt.
const publicApplicant = (record) => (record ? {
  id: record.id,
  student_id: record.student_id,
  name: record.name,
  grade: record.grade,
  major: record.major,
  session_version: record.session_version || 1,
  created_at: record.created_at,
  last_login_at: record.last_login_at || '',
} : null);

export const createApplicantStore = (dataDirectory) => {
  const dataFile = path.join(dataDirectory, 'recruit-applicants.json');
  let queue = Promise.resolve();

  const read = async () => {
    try {
      const parsed = JSON.parse(await readFile(dataFile, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  };

  const write = async (records) => {
    await mkdir(path.dirname(dataFile), { recursive: true });
    const temporary = `${dataFile}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2), { mode: 0o600 });
    await rename(temporary, dataFile);
  };

  const mutate = (task) => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  // A fixed record to compare against when the student id is unknown, so a miss takes as long as a wrong password.
  const decoy = passwordRecord(crypto.randomBytes(12).toString('hex'));

  return {
    async register(profile, password) {
      const normalized = normalizeApplicantProfile(profile);
      const secret = validatePassword(password);
      return mutate(async () => {
        const records = await read();
        if (records.some((record) => idKey(record.student_id) === idKey(normalized.student_id))) {
          throw createError('这个学号已经注册过了，请直接登录；忘记密码请联系实验室管理员', 409);
        }
        const record = {
          id: crypto.randomUUID(),
          ...normalized,
          ...(await passwordRecord(secret)),
          session_version: 1,
          created_at: new Date().toISOString(),
          last_login_at: new Date().toISOString(),
        };
        await write([...records, record]);
        return publicApplicant(record);
      });
    },

    async authenticate(studentId, password) {
      const record = (await read()).find((item) => idKey(item.student_id) === idKey(studentId));
      const ok = await passwordMatches(String(password ?? ''), record || await decoy);
      if (!record || !ok) return null;
      return mutate(async () => {
        const records = await read();
        const index = records.findIndex((item) => item.id === record.id);
        if (index < 0) return null;
        records[index] = { ...records[index], last_login_at: new Date().toISOString() };
        await write(records);
        return publicApplicant(records[index]);
      });
    },

    async getById(id) {
      return publicApplicant((await read()).find((record) => record.id === id));
    },

    async list() {
      return (await read()).map(publicApplicant).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async changePassword(id, currentPassword, newPassword) {
      const secret = validatePassword(newPassword);
      return mutate(async () => {
        const records = await read();
        const index = records.findIndex((record) => record.id === id);
        if (index < 0) throw createError('账号不存在', 404);
        if (!(await passwordMatches(String(currentPassword ?? ''), records[index]))) throw createError('当前密码不正确', 403);
        records[index] = { ...records[index], ...(await passwordRecord(secret)), session_version: (records[index].session_version || 1) + 1 };
        await write(records);
        return publicApplicant(records[index]);
      });
    },

    // The administrator hands the temporary password to the student; every session of that account ends.
    resetPassword(id) {
      return mutate(async () => {
        const records = await read();
        const index = records.findIndex((record) => record.id === id);
        if (index < 0) throw createError('账号不存在', 404);
        const password = generateTemporaryPassword();
        records[index] = { ...records[index], ...(await passwordRecord(password)), session_version: (records[index].session_version || 1) + 1 };
        await write(records);
        return { applicant: publicApplicant(records[index]), password };
      });
    },

    remove(id) {
      return mutate(async () => {
        const records = await read();
        if (!records.some((record) => record.id === id)) return false;
        await write(records.filter((record) => record.id !== id));
        return true;
      });
    },
  };
};
