import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const ACCOUNT_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const PASSWORD_KEY_LENGTH = 64;

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeAccount = (value = '') => String(value).trim();
const accountKey = (value = '') => normalizeAccount(value).toLowerCase();

const validateAccount = (account) => {
  if (!ACCOUNT_PATTERN.test(account)) {
    throw createError('学号或工号应为 4-64 位字母、数字、下划线或短横线');
  }
};

const derivePassword = async (password, salt) => {
  const key = await scryptAsync(String(password), salt, PASSWORD_KEY_LENGTH);
  return Buffer.from(key).toString('base64');
};

const createPasswordRecord = async (password) => {
  const salt = crypto.randomBytes(16).toString('base64');
  return { password_salt: salt, password_hash: await derivePassword(password, salt) };
};

const verifyPassword = async (password, record) => {
  const actual = Buffer.from(await derivePassword(password, record.password_salt), 'base64');
  const expected = Buffer.from(record.password_hash, 'base64');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const publicAccount = (record) => record ? ({
  member_id: record.member_id,
  account: record.account,
  active: record.active !== false,
  must_change_password: record.must_change_password !== false,
  session_version: record.session_version || 1,
  last_login_at: record.last_login_at || '',
  created_date: record.created_date,
  updated_date: record.updated_date,
}) : null;

export function createMemberAccountStore(dataDirectory) {
  const dataFile = path.join(dataDirectory, 'member-accounts.json');
  let ensurePromise = null;
  let cachedRecords = null;
  let mutationQueue = Promise.resolve();

  const ensureData = () => {
    if (!ensurePromise) {
      ensurePromise = (async () => {
        await mkdir(dataDirectory, { recursive: true });
        try {
          await readFile(dataFile, 'utf8');
        } catch {
          await writeFile(dataFile, '[]\n', 'utf8');
        }
      })();
    }
    return ensurePromise;
  };

  const readRecords = async () => {
    await ensureData();
    if (!cachedRecords) {
      const parsed = JSON.parse(await readFile(dataFile, 'utf8'));
      if (!Array.isArray(parsed)) throw createError('成员账号数据格式错误', 500);
      cachedRecords = parsed;
    }
    return cachedRecords;
  };

  const saveRecords = async (records) => {
    const temporaryFile = `${dataFile}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    await rename(temporaryFile, dataFile);
    cachedRecords = records;
  };

  const enqueueMutation = (operation) => {
    const result = mutationQueue.then(operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const findByMemberId = (records, memberId) => records.find((item) => item.member_id === memberId);
  const findByAccount = (records, account) => records.find((item) => accountKey(item.account) === accountKey(account));

  return {
    async listSummaries() {
      await mutationQueue;
      return (await readRecords()).map(publicAccount);
    },

    async getByMemberId(memberId) {
      await mutationQueue;
      return publicAccount(findByMemberId(await readRecords(), memberId));
    },

    async authenticate(account, password) {
      return enqueueMutation(async () => {
        const records = structuredClone(await readRecords());
        const record = findByAccount(records, account);
        if (!record || record.active === false || !await verifyPassword(password, record)) return null;
        record.last_login_at = new Date().toISOString();
        await saveRecords(records);
        return publicAccount(record);
      });
    },

    async createForMember(memberId, account, { active = true } = {}) {
      const normalizedAccount = normalizeAccount(account);
      validateAccount(normalizedAccount);
      return enqueueMutation(async () => {
        const records = structuredClone(await readRecords());
        if (findByMemberId(records, memberId)) throw createError('该成员已经拥有登录账号', 409);
        if (findByAccount(records, normalizedAccount)) throw createError('该学号或工号已被使用', 409);
        const now = new Date().toISOString();
        const record = {
          member_id: memberId,
          account: normalizedAccount,
          ...await createPasswordRecord(normalizedAccount),
          active: active !== false,
          must_change_password: true,
          session_version: 1,
          created_date: now,
          updated_date: now,
        };
        records.push(record);
        await saveRecords(records);
        return publicAccount(record);
      });
    },

    async configureForMember(memberId, { account, active, resetPassword = false }) {
      const normalizedAccount = normalizeAccount(account);
      if (normalizedAccount) validateAccount(normalizedAccount);
      return enqueueMutation(async () => {
        const records = structuredClone(await readRecords());
        let record = findByMemberId(records, memberId);
        if (!record) {
          if (!normalizedAccount) throw createError('请填写学号或工号');
          if (findByAccount(records, normalizedAccount)) throw createError('该学号或工号已被使用', 409);
          const now = new Date().toISOString();
          record = {
            member_id: memberId,
            account: normalizedAccount,
            ...await createPasswordRecord(normalizedAccount),
            active: active !== false,
            must_change_password: true,
            session_version: 1,
            created_date: now,
            updated_date: now,
          };
          records.push(record);
        } else {
          if (normalizedAccount && accountKey(normalizedAccount) !== accountKey(record.account)) {
            const conflict = findByAccount(records, normalizedAccount);
            if (conflict && conflict.member_id !== memberId) throw createError('该学号或工号已被使用', 409);
            record.account = normalizedAccount;
            resetPassword = true;
          }
          if (typeof active === 'boolean' && active !== record.active) {
            record.active = active;
            record.session_version = (record.session_version || 1) + 1;
          }
          if (resetPassword) {
            Object.assign(record, await createPasswordRecord(record.account));
            record.must_change_password = true;
            record.session_version = (record.session_version || 1) + 1;
          }
          record.updated_date = new Date().toISOString();
        }
        await saveRecords(records);
        return publicAccount(record);
      });
    },

    async changePassword(memberId, currentPassword, newPassword) {
      return enqueueMutation(async () => {
        const records = structuredClone(await readRecords());
        const record = findByMemberId(records, memberId);
        if (!record || record.active === false) throw createError('成员账号不可用', 403);
        if (!await verifyPassword(currentPassword, record)) throw createError('当前密码错误', 401);
        if (String(newPassword).length < 8 || String(newPassword).length > 128) {
          throw createError('新密码长度应为 8-128 位');
        }
        if (String(newPassword) === record.account) throw createError('新密码不能与学号或工号相同');
        Object.assign(record, await createPasswordRecord(newPassword));
        record.must_change_password = false;
        record.session_version = (record.session_version || 1) + 1;
        record.updated_date = new Date().toISOString();
        await saveRecords(records);
        return publicAccount(record);
      });
    },

    async removeForMember(memberId) {
      return enqueueMutation(async () => {
        const records = structuredClone(await readRecords());
        const nextRecords = records.filter((item) => item.member_id !== memberId);
        if (nextRecords.length !== records.length) await saveRecords(nextRecords);
        return { success: true };
      });
    },
  };
}
