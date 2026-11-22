import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { copyFile, mkdir, open, readFile, rename, rm, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const SUBMISSION_MAX_FILE_BYTES = 30 * 1024 * 1024;
// The optional code-and-results archive that goes with a report.
export const ATTACHMENT_MAX_FILE_BYTES = 100 * 1024 * 1024;
const ZIP_SIGNATURES = [Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.from([0x50, 0x4b, 0x07, 0x08])];
export const MAX_SUBMISSIONS_PER_COHORT = 5000;
// Refuse new submissions before the disk is full, so the site and earlier submissions keep working.
export const MIN_FREE_DISK_BYTES = 2 * 1024 * 1024 * 1024;
// One student's share, so a handful of accounts cannot use up the cohort's whole quota.
export const MAX_SUBMISSIONS_PER_STUDENT = 30;

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

// The paper a student is held to once the choice is locked: the one of their newest submission ('' if none).
// Ties on the timestamp go to the later record, which is stored after the earlier one.
const newestDirection = (records, cohort, studentId) => {
  let latest = null;
  for (const record of records) {
    if (record.cohort === cohort && sameStudent(record.student_id, studentId) && (!latest || record.created_at >= latest.created_at)) latest = record;
  }
  return latest ? latest.direction : '';
};

// After the paper choice is locked, a student keeps the paper of their newest submission.
// People who never submitted before the lock may still pick one; their first submission then locks them too.
// Who the student is comes from their signed-in account, so there is no separate name check here.
export const checkDirectionLock = (records, cohort, fields) => {
  const locked = newestDirection(records, cohort, fields.student_id);
  // The message does not name the paper; the student's own page shows it.
  if (locked && locked !== fields.direction) throw createError('论文已经锁定：只能继续提交你之前选的那一篇，请重新选择论文', 409);
};

// Checks the optional archive (a file uploaded to disk: { path, originalname, size }) without reading all of it.
export const validateAttachment = async (attachment) => {
  if (!attachment) return;
  if (!attachment.size) throw createError('代码与结果压缩包是空的，请重新选择');
  if (path.extname(attachment.originalname || '').toLowerCase() !== '.zip') throw createError('代码与结果只能打包成一个 .zip 文件');
  if (attachment.size > ATTACHMENT_MAX_FILE_BYTES) throw createError(`压缩包不能超过 ${ATTACHMENT_MAX_FILE_BYTES / 1024 / 1024}MB`, 413);
  const handle = await open(attachment.path, 'r');
  try {
    const head = Buffer.alloc(4);
    await handle.read(head, 0, 4, 0);
    if (!ZIP_SIGNATURES.some((signature) => head.equals(signature))) throw createError('压缩包内容不是有效的 zip，请确认文件没有损坏');
  } finally {
    await handle.close();
  }
};

const moveFile = async (from, to) => {
  try {
    await rename(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await copyFile(from, to);
    await rm(from, { force: true });
  }
};

// "ViT_张三_2250001_大一_计算机_v2.pdf" → "ViT_张三_2250001_大一_计算机_v2_代码与结果.zip"
const attachmentNameFor = (finalName) => `${finalName.replace(/\.[^.]+$/, '')}_代码与结果.zip`;

export const createSubmissionStore = (dataDirectory, { minFreeBytes = MIN_FREE_DISK_BYTES } = {}) => {
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

  const serialize = ({ stored_name: _storedName, attachment_stored: _attachmentStored, ...record }, { includeContact = false } = {}) => {
    if (includeContact) return record;
    const { qq: _qq, wechat: _wechat, email: _email, contact: _legacyContact, ...visible } = record;
    return visible;
  };

  return {
    // `attachment` is optional: the code-and-results zip, already on disk, moved into place here.
    async add({ cohort, fields, file, attachment = null, applicantId = '', lockDirection = false }) {
      const extension = validateSubmissionFile(file);
      await validateAttachment(attachment);
      return enqueue(async () => {
        const records = await readIndex();
        if (lockDirection) checkDirectionLock(records, cohort, fields);
        if (records.filter((record) => record.cohort === cohort).length >= MAX_SUBMISSIONS_PER_COHORT) {
          throw createError('本期提交数量已达上限，请联系实验室', 429);
        }
        const own = records.filter((record) => record.cohort === cohort && sameStudent(record.student_id, fields.student_id));
        if (own.length >= MAX_SUBMISSIONS_PER_STUDENT) {
          throw createError(`你在本期已经提交了 ${MAX_SUBMISSIONS_PER_STUDENT} 次，达到上限，如需继续提交请联系实验室`, 429);
        }
        // One more than the highest version so far, so deleting an old version never produces two files with the same name.
        const version = 1 + own
          .filter((record) => record.direction === fields.direction)
          .reduce((highest, record) => Math.max(highest, Number(record.version) || 0), 0);
        const id = crypto.randomUUID();
        const storedName = `${id}${extension}`;
        await mkdir(filesDirectory, { recursive: true });
        const disk = await statfs(filesDirectory).catch(() => null);
        if (disk && disk.bavail * disk.bsize < minFreeBytes) throw createError('服务器存储空间不足，暂时无法提交，请联系实验室', 507);
        await writeFile(path.join(filesDirectory, storedName), file.buffer, { flag: 'wx' });
        const attachmentStored = attachment ? `${id}-attachment.zip` : '';
        if (attachment) {
          try {
            await moveFile(attachment.path, path.join(filesDirectory, attachmentStored));
          } catch (error) {
            await rm(path.join(filesDirectory, storedName), { force: true });
            throw error;
          }
        }
        const finalName = buildSubmissionFileName(fields, version, extension);
        const record = {
          id,
          cohort,
          ...(applicantId ? { applicant_id: applicantId } : {}),
          ...fields,
          version,
          final_name: finalName,
          original_name: sanitizeOriginalName(file.originalname),
          extension,
          size: file.buffer.length,
          stored_name: storedName,
          ...(attachment ? {
            attachment_name: attachmentNameFor(finalName),
            attachment_original: sanitizeOriginalName(attachment.originalname),
            attachment_size: attachment.size,
            attachment_stored: attachmentStored,
          } : {}),
          created_at: new Date().toISOString(),
        };
        try {
          await writeIndex([...records, record]);
        } catch (error) {
          await rm(path.join(filesDirectory, storedName), { force: true });
          if (attachmentStored) await rm(path.join(filesDirectory, attachmentStored), { force: true });
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

    // One account's own submissions in a cohort, newest first, with their contact details for pre-filling the form.
    // Matched by account, not student id: an account registered again after an admin deleted the old one starts empty.
    async listOwn(cohort, applicantId) {
      const records = await readIndex();
      return records
        .filter((record) => record.cohort === cohort && applicantId && record.applicant_id === applicantId)
        .reverse() // records are stored oldest first; reversing makes same-millisecond ties come out newest first
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(({ id, direction, version, final_name: finalName, size, attachment_name: attachmentName = '', attachment_size: attachmentSize = 0, created_at: createdAt, qq = '', wechat = '', email = '' }) => ({
          id, direction, version, final_name: finalName, size, attachment_name: attachmentName, attachment_size: attachmentSize, created_at: createdAt, qq, wechat, email,
        }));
    },

    async lockedDirection(cohort, studentId) {
      return newestDirection(await readIndex(), cohort, studentId);
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

    async getAttachment(id) {
      const record = (await readIndex()).find((item) => item.id === id);
      if (!record?.attachment_stored) return null;
      return { filePath: path.join(filesDirectory, record.attachment_stored), downloadName: record.attachment_name };
    },

    remove(id) {
      return enqueue(async () => {
        const records = await readIndex();
        const record = records.find((item) => item.id === id);
        if (!record) return false;
        await writeIndex(records.filter((item) => item.id !== id));
        await rm(path.join(filesDirectory, record.stored_name), { force: true });
        if (record.attachment_stored) await rm(path.join(filesDirectory, record.attachment_stored), { force: true });
        return true;
      });
    },
  };
};
