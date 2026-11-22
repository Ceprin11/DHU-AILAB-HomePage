import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const SUBMISSION_MAX_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_SUBMISSIONS_PER_COHORT = 1000;

const OFFICE_ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OFFICE_LEGACY_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const PDF_SIGNATURE = Buffer.from('%PDF');
const BINARY_SIGNATURES = {
  '.pdf': [PDF_SIGNATURE],
  '.pptx': [OFFICE_ZIP_SIGNATURE],
  '.ppt': [OFFICE_LEGACY_SIGNATURE],
};
export const MARKUP_EXTENSIONS = new Set(['.html', '.htm']);

export const SUBMISSION_EXTENSIONS = new Set([...Object.keys(BINARY_SIGNATURES), ...MARKUP_EXTENSIONS]);

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// eslint-disable-next-line no-control-regex
const stripControlCharacters = (value) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

const readText = (body, key, label, { max, required = true, pattern, patternMessage } = {}) => {
  const value = stripControlCharacters(body[key]).trim();
  if (!value && required) throw createError(`请填写${label}`);
  if (value.length > max) throw createError(`${label}不能超过 ${max} 个字`);
  if (value && pattern && !pattern.test(value)) throw createError(patternMessage);
  return value;
};

const readChoice = (body, key, label, options) => {
  const value = stripControlCharacters(body[key]).trim();
  if (!value) throw createError(`请选择${label}`);
  if (!options.includes(value)) throw createError(`${label}不在可选范围内`);
  return value;
};

const readContacts = (body) => {
  const optional = { required: false };
  const contacts = {
    qq: readText(body, 'qq', 'QQ', { ...optional, max: 12, pattern: /^[0-9]{5,12}$/, patternMessage: 'QQ 号应为 5-12 位数字' }),
    wechat: readText(body, 'wechat', '微信', { ...optional, max: 30, pattern: /^[A-Za-z0-9_-]{3,30}$/, patternMessage: '微信号只能包含字母、数字、下划线和短横线' }),
    email: readText(body, 'email', '邮箱', { ...optional, max: 80, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: '邮箱格式不正确' }),
  };
  if (!contacts.qq && !contacts.wechat && !contacts.email) throw createError('QQ、微信、邮箱至少填写一个');
  return contacts;
};

export const normalizeSubmissionFields = (body = {}, { directions = [], grades = [] } = {}) => ({
  name: readText(body, 'name', '姓名', { max: 30 }),
  student_id: readText(body, 'student_id', '学号', { max: 20, pattern: /^[A-Za-z0-9]{4,20}$/, patternMessage: '学号应为 4-20 位字母或数字' }),
  grade: readChoice(body, 'grade', '年级', grades),
  major: readText(body, 'major', '专业', { max: 30 }),
  direction: directions.length ? readChoice(body, 'direction', '方向', directions) : '',
  ...readContacts(body),
  note: readText(body, 'note', '备注', { max: 1000, required: false }),
});

export const sanitizeOriginalName = (value) => {
  const base = stripControlCharacters(value).replace(/[\r\n\t]+/g, '').split(/[\\/]/).pop().replace(/ {2,}/g, ' ').trim();
  return base.slice(-120) || 'file';
};

// eslint-disable-next-line no-control-regex
const FILE_NAME_FORBIDDEN = /[\\/:*?"<>|\s\u0000-\u001f\u007f.]+/g;
const fileNamePart = (value) => String(value || '').replace(FILE_NAME_FORBIDDEN, '').slice(0, 20);

export const buildSubmissionFileName = ({ direction, name, student_id: studentId, grade, major }, version, extension) => (
  `${[direction, name, studentId, grade, major].map(fileNamePart).filter(Boolean).join('_')}_v${version}${extension}`
);

export const validateSubmissionFile = (file) => {
  if (!file?.buffer?.length) throw createError('请选择要提交的文件');
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!SUBMISSION_EXTENSIONS.has(extension)) {
    throw createError('文件类型不支持，仅支持 PDF、PPT、HTML');
  }
  if (file.buffer.length > SUBMISSION_MAX_FILE_BYTES) {
    throw createError(`文件不能超过 ${SUBMISSION_MAX_FILE_BYTES / 1024 / 1024}MB`, 413);
  }
  const signatures = BINARY_SIGNATURES[extension];
  if (signatures) {
    if (!signatures.some((signature) => file.buffer.subarray(0, signature.length).equals(signature))) {
      throw createError('文件内容与扩展名不符，请确认文件没有损坏');
    }
  } else {
    const head = file.buffer.subarray(0, 8192);
    if (head.includes(0) || !head.includes(0x3c)) throw createError('文件内容与扩展名不符，请确认文件没有损坏');
  }
  return extension;
};

const sameStudent = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const sameName = (a, b) => String(a).replace(/\s+/g, '').toLowerCase() === String(b).replace(/\s+/g, '').toLowerCase();

// After the paper choice is locked, a student keeps the paper of their newest submission.
// People who never submitted before the lock may still pick one; their first submission then locks them too.
export const checkDirectionLock = (records, cohort, fields) => {
  const mine = records.filter((record) => record.cohort === cohort && sameStudent(record.student_id, fields.student_id));
  if (!mine.length) return;
  const latest = mine.reduce((best, record) => (record.created_at >= best.created_at ? record : best));
  if (!sameName(latest.name, fields.name)) throw createError('学号和姓名与之前提交的记录不一致，请核对后再提交', 403);
  // The message must not name the paper: someone who only knows a student id and name would learn another person's choice.
  if (latest.direction !== fields.direction) throw createError('论文已经锁定：只能继续提交你第一次选的那一篇，请重新选择论文', 409);
};

export const createSubmissionStore = (dataDirectory) => {
  const directory = path.join(dataDirectory, 'recruit-submissions');
  const filesDirectory = path.join(directory, 'files');
  const indexPath = path.join(directory, 'index.json');
  let queue = Promise.resolve();

  const readIndex = async () => {
    try {
      const parsed = JSON.parse(await readFile(indexPath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  };

  const writeIndex = async (records) => {
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${indexPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(records, null, 2));
    await rename(temporaryPath, indexPath);
  };

  const enqueue = (task) => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  const serialize = ({ stored_name: _storedName, ...record }, { includeContact = false } = {}) => {
    if (includeContact) return record;
    const { qq: _qq, wechat: _wechat, email: _email, contact: _legacyContact, ...visible } = record;
    return visible;
  };

  return {
    add({ cohort, fields, file, lockDirection = false }) {
      const extension = validateSubmissionFile(file);
      return enqueue(async () => {
        const records = await readIndex();
        if (lockDirection) checkDirectionLock(records, cohort, fields);
        if (records.filter((record) => record.cohort === cohort).length >= MAX_SUBMISSIONS_PER_COHORT) {
          throw createError('本期提交数量已达上限，请联系实验室', 429);
        }
        const version = 1 + records.filter((record) => (
          record.cohort === cohort
          && record.student_id.toLowerCase() === fields.student_id.toLowerCase()
          && record.direction === fields.direction
        )).length;
        const id = crypto.randomUUID();
        const storedName = `${id}${extension}`;
        await mkdir(filesDirectory, { recursive: true });
        await writeFile(path.join(filesDirectory, storedName), file.buffer, { flag: 'wx' });
        const record = {
          id,
          cohort,
          ...fields,
          version,
          final_name: buildSubmissionFileName(fields, version, extension),
          original_name: sanitizeOriginalName(file.originalname),
          extension,
          size: file.buffer.length,
          stored_name: storedName,
          created_at: new Date().toISOString(),
        };
        try {
          await writeIndex([...records, record]);
        } catch (error) {
          await rm(path.join(filesDirectory, storedName), { force: true });
          throw error;
        }
        return serialize(record, { includeContact: true });
      });
    },

    renameCohort(cohort, nextCohort) {
      return enqueue(async () => {
        const records = await readIndex();
        const count = records.filter((record) => record.cohort === cohort).length;
        if (count) await writeIndex(records.map((record) => (record.cohort === cohort ? { ...record, cohort: nextCohort } : record)));
        return count;
      });
    },

    async list(cohort, options) {
      const records = await readIndex();
      return records
        .filter((record) => !cohort || record.cohort === cohort)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((record) => serialize(record, options));
    },

    async getFile(id) {
      const record = (await readIndex()).find((item) => item.id === id);
      if (!record) return null;
      return { filePath: path.join(filesDirectory, record.stored_name), downloadName: record.final_name, record: serialize(record) };
    },

    remove(id) {
      return enqueue(async () => {
        const records = await readIndex();
        const record = records.find((item) => item.id === id);
        if (!record) return false;
        await writeIndex(records.filter((item) => item.id !== id));
        await rm(path.join(filesDirectory, record.stored_name), { force: true });
        return true;
      });
    },
  };
};
