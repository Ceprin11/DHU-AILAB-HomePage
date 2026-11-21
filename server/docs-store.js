import { Buffer } from 'node:buffer';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const COHORT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COHORT_STATUSES = new Set(['draft', 'current', 'archived', 'upcoming']);
const PAGE_SLUG_PATTERN = /^[\p{L}\p{N}_-]+$/u;
const RESERVED_SLUGS = new Set(['submit', 'submissions']);
export const SUBMISSION_GRADES = ['大一', '大二'];
const INLINE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.pdf', '.mp4', '.webm']);
const ATTACHMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.txt', '.csv', '.ipynb', '.py']);
const ASSET_EXTENSIONS = new Set([...INLINE_EXTENSIONS, ...ATTACHMENT_EXTENSIONS]);
const EXTERNAL_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const MARKDOWN_LINK = /(?<!!)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const FENCED_CODE = /^(```|~~~)[\s\S]*?^\1/gm;

export const ASSET_MAX_BYTES = 30 * 1024 * 1024;
const PAGE_BODY_MAX_CHARS = 400000;
const TEXT_ASSET_EXTENSIONS = new Set(['.txt', '.csv', '.ipynb', '.py']);
const ZIP_FAMILY = new Set(['.zip', '.docx', '.pptx', '.xlsx']);
const LEGACY_OFFICE = new Set(['.doc', '.ppt', '.xls']);
const ASSET_DIRECTORY_SEGMENT = /^[\p{L}\p{N}_-]{1,30}$/u;

export const isInlineAsset = (filePath) => INLINE_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const parseFrontmatter = (source) => {
  const text = String(source).replace(/^\uFEFF/, '');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    meta[key] = raw === 'true' ? true : raw === 'false' ? false : raw;
  }
  return { meta, body: text.slice(match[0].length) };
};

const parseDeadline = (value) => {
  const text = String(value || '').trim();
  if (!text) return { deadline: '', valid: true };
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);
  const time = match && Date.parse(`${match[1]}T${match[2] ? `${match[2]}:00` : '23:59:59'}+08:00`);
  return Number.isFinite(time) ? { deadline: new Date(time).toISOString(), valid: true } : { deadline: '', valid: false };
};

const parsePublishAt = (value) => {
  const match = String(value ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/);
  const time = match && Date.parse(`${match[1]}T${match[2]}:00+08:00`);
  return Number.isFinite(time) ? { time, text: `${match[1]} ${match[2]}` } : null;
};

export const getSubmissionState = (cohort, now = new Date()) => {
  const { deadline, valid } = parseDeadline(cohort?.submission_deadline);
  const directions = Array.isArray(cohort?.directions) ? cohort.directions : [];
  const groups = Array.isArray(cohort?.groups) ? cohort.groups : [];
  const closed = (reason) => ({ open: false, deadline, reason, directions, groups, grades: SUBMISSION_GRADES });
  if (!cohort || cohort.submissions === false) return closed('本期暂不接收提交');
  if (cohort.status === 'draft') return closed('本期招新尚未发布');
  if (cohort.status === 'upcoming') return closed('本期招新还没有开始');
  if (cohort.status !== 'current') return closed('本期招新已结束');
  if (!valid) return closed('截止时间配置有误，请联系管理员');
  if (deadline && now.getTime() > Date.parse(deadline)) return closed('已过提交截止时间');
  return { open: true, deadline, reason: '', directions, groups, grades: SUBMISSION_GRADES };
};

// Papers are grouped by field (CV / NLP / multimodal). Every direction belongs to at most one group.
const MAX_GROUPS = 8;

const cleanGroups = (input, directions, { strict }) => {
  const names = new Set();
  const claimed = new Set();
  const groups = [];
  for (const item of Array.isArray(input) ? input : []) {
    const name = String(item?.name ?? '').trim();
    if (!name) {
      if (strict) throw createError('分组名称不能为空');
      continue;
    }
    if (name.length > 20) throw createError('分组名称不能超过 20 个字');
    if (names.has(name)) {
      if (strict) throw createError(`分组“${name}”重复了`);
      continue;
    }
    names.add(name);
    const members = [];
    for (const raw of Array.isArray(item?.directions) ? item.directions : []) {
      const direction = String(raw).trim();
      if (!direction || members.includes(direction)) continue;
      if (!directions.includes(direction)) {
        if (strict) throw createError(`分组“${name}”里的“${direction}”不在选择方向中`);
        continue;
      }
      if (claimed.has(direction)) {
        if (strict) throw createError(`“${direction}”同时出现在多个分组里`);
        continue;
      }
      claimed.add(direction);
      members.push(direction);
    }
    groups.push({ name, directions: members });
  }
  if (groups.length > MAX_GROUPS) throw createError(`分组最多 ${MAX_GROUPS} 个`);
  return groups;
};

// Un-grouped pages first (the overview, notices), then one block per group in the configured order.
const sortPages = (pages, groups) => {
  const rank = new Map(groups.map((group, index) => [group.name, index + 1]));
  const blockOf = (page) => (page.slug === 'index' ? -1 : rank.get(page.group) ?? 0);
  const orderOf = (page) => (page.order === '' || page.order === undefined ? Infinity : page.order);
  return [...pages].sort((a, b) => blockOf(a) - blockOf(b) || orderOf(a) - orderOf(b) || a.slug.localeCompare(b.slug, 'zh-Hans-CN', { numeric: true }));
};

const firstHeading = (body) => body.match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]?.trim() || '';

const toOrder = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
};

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const startsWith = (buffer, bytes) => buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

const assetMatchesSignature = (extension, buffer) => {
  if (extension === '.png') return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47]);
  if (extension === '.jpg' || extension === '.jpeg') return startsWith(buffer, [0xff, 0xd8, 0xff]);
  if (extension === '.gif') return startsWith(buffer, [0x47, 0x49, 0x46, 0x38]);
  if (extension === '.webp') return startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString('latin1') === 'WEBP';
  if (extension === '.pdf') return startsWith(buffer, [0x25, 0x50, 0x44, 0x46]);
  if (ZIP_FAMILY.has(extension)) return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  if (LEGACY_OFFICE.has(extension)) return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (TEXT_ASSET_EXTENSIONS.has(extension)) return !buffer.subarray(0, 8192).includes(0);
  return true;
};

// eslint-disable-next-line no-control-regex
const ASSET_NAME_FORBIDDEN = /[\\/:*?"<>|\s\u0000-\u001f\u007f]+/g;

export const sanitizeAssetName = (value) => {
  const base = String(value || '').split(/[\\/]/).pop().replace(ASSET_NAME_FORBIDDEN, '_').replace(/^[._]+/, '');
  const extension = path.extname(base).toLowerCase();
  const stem = base.slice(0, base.length - extension.length).replace(/_+$/g, '').slice(0, 80);
  return stem ? `${stem}${extension}` : '';
};

const yamlText = (value) => {
  const text = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  return text.includes('"') && !text.includes("'") ? `'${text}'` : `"${text.replace(/"/g, '”')}"`;
};

export const serializePage = ({ title = '', order = '', summary = '', group = '', draft = false, body = '' }) => {
  const lines = [];
  if (String(title).trim()) lines.push(`title: ${yamlText(title)}`);
  if (String(group).trim()) lines.push(`group: ${yamlText(group)}`);
  if (order !== '' && order !== null && Number.isFinite(Number(order))) lines.push(`order: ${Number(order)}`);
  if (String(summary).trim()) lines.push(`summary: ${yamlText(summary)}`);
  if (draft) lines.push('draft: true');
  const content = `${String(body).replace(/\r\n/g, '\n').replace(/\s+$/, '')}\n`;
  return lines.length ? `---\n${lines.join('\n')}\n---\n${content}` : content;
};

// First start on a new server: copy the starter content shipped with the code into the data directory.
export const seedContentDirectory = async (sourceDirectory, targetDirectory) => {
  try {
    await stat(targetDirectory);
    return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await stat(sourceDirectory);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  await mkdir(path.dirname(targetDirectory), { recursive: true });
  await cp(sourceDirectory, targetDirectory, {
    recursive: true,
    filter: (source) => path.relative(sourceDirectory, source) !== 'README.md',
  });
  return true;
};

const readdirSafe = async (directory) => {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
};

const atomicWrite = async (filePath, data) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, data);
  await rename(temporaryPath, filePath);
};

export const createDocsStore = (contentDirectory, { now = () => new Date() } = {}) => {
  const root = path.resolve(contentDirectory);

  const insideRoot = (target) => target === root || target.startsWith(`${root}${path.sep}`);

  const cohortDirectory = (cohortId) => {
    if (!COHORT_ID_PATTERN.test(String(cohortId))) return null;
    const directory = path.join(root, cohortId);
    return insideRoot(directory) ? directory : null;
  };

  const readCohortManifest = async () => {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path.join(root, 'cohorts.json'), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    return (Array.isArray(parsed) ? parsed : []).filter((cohort) => (
      COHORT_ID_PATTERN.test(String(cohort?.id)) && String(cohort?.label || '').trim()
    )).map((cohort) => {
      const directions = (Array.isArray(cohort.directions) ? cohort.directions : [])
        .map((direction) => String(direction).trim()).filter(Boolean).slice(0, 20);
      let groups = [];
      try {
        groups = cleanGroups(cohort.groups, directions, { strict: false });
      } catch {
        groups = [];
      }
      return {
        id: cohort.id,
        label: String(cohort.label).trim(),
        status: COHORT_STATUSES.has(cohort.status) ? cohort.status : 'archived',
        description: String(cohort.description || '').trim(),
        submissions: cohort.submissions,
        submission_deadline: cohort.submission_deadline,
        publish_at: cohort.publish_at,
        publish_drafts: cohort.publish_drafts,
        directions,
        groups,
      };
    });
  };

  const publicCohort = ({ submissions, submission_deadline: deadline, directions, groups, publish_at: _publishAt, publish_drafts: _publishDrafts, ...cohort }, { preview = false } = {}) => ({
    ...cohort,
    groups,
    // A preview shows an unpublished cohort the way it will look once it is the current one.
    submission: getSubmissionState({ ...cohort, status: preview && cohort.status === 'draft' ? 'current' : cohort.status, submissions, submission_deadline: deadline, directions, groups }),
    ...(preview ? { preview: true } : {}),
  });

  const resolveAsset = (cohortId, relativePath) => {
    const directory = cohortDirectory(cohortId);
    if (!directory) return null;
    const filePath = path.resolve(directory, String(relativePath || ''));
    if (!filePath.startsWith(`${directory}${path.sep}`)) return null;
    if (!ASSET_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return null;
    return filePath;
  };

  const listAttachments = async (cohortId, body) => {
    const attachments = new Map();
    for (const match of body.replace(FENCED_CODE, '').matchAll(MARKDOWN_LINK)) {
      const target = match[2].replace(/[?#].*$/, '');
      if (!target || EXTERNAL_URL.test(target) || target.startsWith('/')) continue;
      const relativePath = safeDecode(target).replace(/^\.\//, '');
      if (attachments.has(relativePath) || !ATTACHMENT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) continue;
      const filePath = resolveAsset(cohortId, relativePath);
      if (!filePath) continue;
      let info;
      try {
        info = await stat(filePath);
      } catch {
        continue;
      }
      if (!info.isFile()) continue;
      attachments.set(relativePath, {
        path: relativePath,
        name: path.basename(filePath),
        label: match[1].trim(),
        size: info.size,
      });
    }
    return [...attachments.values()];
  };

  const readPageFile = async (cohortId, slug, { drafts = false } = {}) => {
    const directory = cohortDirectory(cohortId);
    if (!directory || !PAGE_SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug)) return null;
    const filePath = path.join(directory, `${slug}.md`);
    if (!insideRoot(filePath)) return null;
    let source;
    try {
      source = await readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
      throw error;
    }
    const { meta, body } = parseFrontmatter(source);
    if (meta.draft === true && !drafts) return null;
    return {
      slug,
      title: String(meta.title || firstHeading(body) || slug),
      summary: String(meta.summary || ''),
      group: slug === 'index' ? '' : String(meta.group || ''),
      order: slug === 'index' ? -1 : toOrder(meta.order),
      draft: meta.draft === true,
      body,
    };
  };

  let queue = Promise.resolve();
  const enqueue = (task) => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  const requireCohortDirectory = async (cohortId) => {
    const directory = cohortDirectory(cohortId);
    if (!directory || !(await readCohortManifest()).some((cohort) => cohort.id === cohortId)) throw createError('没有找到这一期招新', 404);
    return directory;
  };

  const groupsOf = async (cohortId) => (await readCohortManifest()).find((cohort) => cohort.id === cohortId)?.groups || [];
  const knownGroup = (groups, name) => (groups.some((group) => group.name === name) ? name : '');

  const requireSlug = (slug) => {
    if (!PAGE_SLUG_PATTERN.test(String(slug)) || String(slug).length > 60) throw createError('文档名只能包含字母、数字、中文、下划线和短横线，且不超过 60 个字');
    if (RESERVED_SLUGS.has(slug)) throw createError(`“${slug}”是系统保留名称，请换一个`);
  };

  const readRawPage = async (cohortId, slug) => {
    const directory = cohortDirectory(cohortId);
    if (!directory || !PAGE_SLUG_PATTERN.test(slug)) return null;
    let source;
    try {
      source = await readFile(path.join(directory, `${slug}.md`), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
      throw error;
    }
    const { meta, body } = parseFrontmatter(source);
    const order = Number(meta.order);
    return {
      slug,
      title: String(meta.title ?? ''),
      heading: firstHeading(body),
      order: meta.order !== undefined && meta.order !== '' && Number.isFinite(order) ? order : '',
      summary: String(meta.summary ?? ''),
      group: slug === 'index' ? '' : String(meta.group ?? ''),
      draft: meta.draft === true,
      body,
    };
  };

  const normalizeCohortInput = (input) => {
    const id = String(input?.id ?? '').trim();
    if (!COHORT_ID_PATTERN.test(id) || id.length > 40) throw createError('批次编号只能用小写字母、数字和连字符，例如 2026-autumn');
    const label = String(input?.label ?? '').trim();
    if (!label || label.length > 40) throw createError('请填写批次名称（不超过 40 个字）');
    if (!COHORT_STATUSES.has(input?.status)) throw createError('批次状态不正确');
    const description = String(input?.description ?? '').trim();
    if (description.length > 100) throw createError('批次说明不能超过 100 个字');
    const deadline = String(input?.submission_deadline ?? '').trim();
    if (deadline && !parseDeadline(deadline).valid) throw createError('截止时间格式应为 2026-12-06 或 2026-12-06 18:00（北京时间）');
    const directions = [...new Set((Array.isArray(input?.directions) ? input.directions : []).map((item) => String(item).trim()).filter(Boolean))];
    if (directions.length > 20) throw createError('方向最多 20 个');
    if (directions.some((item) => item.length > 30)) throw createError('每个方向不超过 30 个字');
    const groups = cleanGroups(input?.groups, directions, { strict: true });
    const publishAt = input.status === 'draft' && String(input.publish_at ?? '').trim() ? parsePublishAt(input.publish_at) : null;
    if (input.status === 'draft' && String(input.publish_at ?? '').trim() && !publishAt) throw createError('定时发布时间格式应为 2026-12-06 09:00（北京时间）');
    return {
      id,
      label,
      status: input.status,
      ...(description ? { description } : {}),
      ...(directions.length ? { directions } : {}),
      ...(groups.length ? { groups } : {}),
      ...(input.submissions === false ? { submissions: false } : {}),
      ...(deadline ? { submission_deadline: deadline } : {}),
      ...(publishAt ? { publish_at: publishAt.text, ...(input.publish_drafts === false ? { publish_drafts: false } : {}) } : {}),
    };
  };

  const writeManifest = (cohorts) => atomicWrite(path.join(root, 'cohorts.json'), `${JSON.stringify(cohorts, null, 2)}\n`);

  const isDue = (cohort) => {
    const at = cohort.status === 'draft' ? parsePublishAt(cohort.publish_at) : null;
    return Boolean(at) && at.time <= now().getTime();
  };

  // Makes an unpublished cohort the current one; the previous current cohort becomes archived.
  const publishInternal = async (cohortId, { drafts }) => {
    const manifest = await readCohortManifest();
    const target = manifest.find((cohort) => cohort.id === cohortId);
    if (!target) throw createError('没有找到这一期招新', 404);
    if (target.status !== 'draft') throw createError('这一期招新已经发布过了');
    await writeManifest(manifest.map((cohort) => normalizeCohortInput(
      cohort.id === cohortId ? { ...cohort, status: 'current', publish_at: '' } : cohort.status === 'current' ? { ...cohort, status: 'archived' } : cohort,
    )));
    let published = 0;
    if (drafts) {
      for (const slug of (await readdirSafe(cohortDirectory(cohortId))).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3))) {
        const page = await readRawPage(cohortId, slug);
        if (page?.draft) {
          await savePageInternal(cohortId, slug, { ...page, group: knownGroup(target.groups, page.group), draft: false });
          published += 1;
        }
      }
    }
    return { published };
  };

  // Scheduled publishing is evaluated when the content is read, so it also catches up after a restart.
  const applyDuePublishes = async () => {
    if (!(await readCohortManifest()).some(isDue)) return;
    await enqueue(async () => {
      const due = (await readCohortManifest()).filter(isDue).sort((a, b) => parsePublishAt(a.publish_at).time - parsePublishAt(b.publish_at).time);
      for (const cohort of due) await publishInternal(cohort.id, { drafts: cohort.publish_drafts !== false });
    }).catch((error) => console.error('Scheduled recruitment publish failed:', error));
  };

  const isPublicCohort = async (cohortId) => (await readCohortManifest()).some((cohort) => cohort.id === cohortId && cohort.status !== 'draft');

  const walkAssets = async (directory, base, depth = 0) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const found = [];
    for (const entry of entries) {
      const relative = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory() && depth < 3 && !entry.name.startsWith('.')) {
        found.push(...await walkAssets(path.join(directory, entry.name), relative, depth + 1));
      } else if (entry.isFile() && ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const info = await stat(path.join(directory, entry.name));
        found.push({ path: relative, name: entry.name, size: info.size, extension: path.extname(entry.name).toLowerCase(), inline: isInlineAsset(entry.name) });
      }
    }
    return found;
  };

  const savePageInternal = async (cohortId, slug, input) => {
    const directory = await requireCohortDirectory(cohortId);
    requireSlug(slug);
    const title = String(input?.title ?? '').trim();
    const summary = String(input?.summary ?? '').trim();
    const body = String(input?.body ?? '');
    if (title.length > 100) throw createError('标题不能超过 100 个字');
    if (summary.length > 300) throw createError('简介不能超过 300 个字');
    if (body.length > PAGE_BODY_MAX_CHARS) throw createError('正文太长，请拆分成多篇文档');
    // An editor that does not send a sort number (the list arrows own it) keeps the one the page already has.
    const kept = input?.order === undefined ? (await readRawPage(cohortId, slug))?.order ?? '' : input.order;
    const order = kept === '' || kept === null ? '' : Number(kept);
    if (order !== '' && !Number.isFinite(order)) throw createError('排序必须是数字');
    const group = slug === 'index' ? '' : String(input?.group ?? '').trim();
    if (group && !(await readCohortManifest()).find((cohort) => cohort.id === cohortId)?.groups.some((item) => item.name === group)) throw createError(`没有“${group}”这个分组，请先在批次设置里添加`);
    await atomicWrite(path.join(directory, `${slug}.md`), serializePage({ title, order, summary, group, draft: input?.draft === true, body }));
    return slug;
  };

  return {
    async readCohortsForAdmin() {
      await applyDuePublishes();
      return (await readCohortManifest()).map((cohort) => ({
        id: cohort.id,
        label: cohort.label,
        status: cohort.status,
        description: cohort.description,
        directions: cohort.directions,
        groups: cohort.groups,
        submissions: cohort.submissions !== false,
        submission_deadline: String(cohort.submission_deadline ?? ''),
        publish_at: String(cohort.publish_at ?? ''),
        publish_drafts: cohort.publish_drafts !== false,
      }));
    },

    saveCohorts(list) {
      return enqueue(async () => {
        if (!Array.isArray(list) || list.length > 30) throw createError('批次列表不正确');
        const cohorts = list.map(normalizeCohortInput);
        if (new Set(cohorts.map((cohort) => cohort.id)).size !== cohorts.length) throw createError('批次编号不能重复');
        if (cohorts.filter((cohort) => cohort.status === 'current').length > 1) throw createError('同一时间只能有一个“本次招新”');
        await writeManifest(cohorts);
        return cohorts;
      });
    },

    async listPagesForAdmin(cohortId) {
      const directory = await requireCohortDirectory(cohortId);
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
      const slugs = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => entry.name.slice(0, -3));
      const pages = (await Promise.all(slugs.map((slug) => readRawPage(cohortId, slug)))).filter(Boolean);
      const groups = await groupsOf(cohortId);
      return sortPages(
        pages.map(({ body, heading, ...page }) => ({ ...page, group: knownGroup(groups, page.group), title: page.title || heading || page.slug, size: body.length })),
        groups,
      );
    },

    async getPageForAdmin(cohortId, slug) {
      await requireCohortDirectory(cohortId);
      const page = await readRawPage(cohortId, slug);
      return page && { ...page, group: knownGroup(await groupsOf(cohortId), page.group) };
    },

    // Applies a new order (and group) to the pages in one go. `items` is the desired order, top to bottom.
    reorderPages(cohortId, items) {
      return enqueue(async () => {
        await requireCohortDirectory(cohortId);
        if (!Array.isArray(items) || items.length > 500) throw createError('排序数据不正确');
        const groups = await groupsOf(cohortId);
        const seen = new Set();
        const updates = [];
        for (const item of items) {
          const slug = String(item?.slug ?? '');
          requireSlug(slug);
          if (seen.has(slug)) throw createError('排序数据里有重复的文档');
          seen.add(slug);
          if (slug === 'index') continue;
          const page = await readRawPage(cohortId, slug);
          if (!page) throw createError(`没有找到文档“${slug}”`, 404);
          const group = String(item?.group ?? '').trim();
          if (group && !groups.some((entry) => entry.name === group)) throw createError(`没有“${group}”这个分组`);
          updates.push({ ...page, group, order: (updates.length + 1) * 10 });
        }
        for (const page of updates) await savePageInternal(cohortId, page.slug, page);
        return updates.length;
      });
    },

    savePage(cohortId, slug, input) {
      return enqueue(() => savePageInternal(cohortId, slug, input));
    },

    importPage(cohortId, { filename, text, overwrite = false }) {
      return enqueue(async () => {
        const directory = await requireCohortDirectory(cohortId);
        const stem = path.basename(String(filename || ''), path.extname(String(filename || '')));
        let slug = stem.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
        if (!slug) throw createError('无法从文件名得到文档名，请先重命名文件');
        if (RESERVED_SLUGS.has(slug)) slug = `${slug}-doc`;
        if (!overwrite && await readRawPage(cohortId, slug)) throw createError(`已存在同名文档“${slug}”，请换文件名或选择覆盖`, 409);
        const { meta, body } = parseFrontmatter(text);
        await savePageInternal(cohortId, slug, {
          title: String(meta.title ?? ''), order: meta.order ?? '', summary: String(meta.summary ?? ''), group: '', draft: meta.draft === true, body,
        });
        return { slug, directory: path.basename(directory) };
      });
    },

    deletePage(cohortId, slug) {
      return enqueue(async () => {
        const directory = await requireCohortDirectory(cohortId);
        requireSlug(slug);
        const filePath = path.join(directory, `${slug}.md`);
        try {
          await stat(filePath);
        } catch {
          return false;
        }
        await rm(filePath);
        return true;
      });
    },

    async listAssets(cohortId) {
      const directory = await requireCohortDirectory(cohortId);
      return (await walkAssets(directory, '')).sort((a, b) => a.path.localeCompare(b.path, 'zh-Hans-CN', { numeric: true }));
    },

    saveAsset(cohortId, { directory: subdirectory = 'assets', filename, buffer }) {
      return enqueue(async () => {
        const directory = await requireCohortDirectory(cohortId);
        const segments = String(subdirectory || '').split('/').filter(Boolean);
        if (segments.length > 2 || segments.some((segment) => !ASSET_DIRECTORY_SEGMENT.test(segment))) throw createError('文件夹名只能包含字母、数字、中文、下划线和短横线，最多两级');
        const name = sanitizeAssetName(filename);
        const extension = path.extname(name).toLowerCase();
        if (!name || !ASSET_EXTENSIONS.has(extension)) throw createError(`不支持的文件类型：${path.extname(String(filename || '')) || '无扩展名'}`);
        if (!buffer?.length) throw createError('文件是空的');
        if (buffer.length > ASSET_MAX_BYTES) throw createError(`文件不能超过 ${ASSET_MAX_BYTES / 1024 / 1024}MB`, 413);
        if (!assetMatchesSignature(extension, Buffer.from(buffer))) throw createError(`文件内容与扩展名 ${extension} 不符，请确认文件没有损坏`);
        const targetDirectory = path.join(directory, ...segments);
        await mkdir(targetDirectory, { recursive: true });
        const stem = name.slice(0, name.length - extension.length);
        for (let attempt = 1; attempt < 1000; attempt += 1) {
          const candidate = attempt === 1 ? name : `${stem}-${attempt}${extension}`;
          try {
            await writeFile(path.join(targetDirectory, candidate), buffer, { flag: 'wx' });
            return { path: [...segments, candidate].join('/'), name: candidate, size: buffer.length, extension, inline: isInlineAsset(candidate) };
          } catch (error) {
            if (error.code !== 'EEXIST') throw error;
          }
        }
        throw createError('同名文件过多，请重命名后再上传');
      });
    },

    deleteAsset(cohortId, relativePath) {
      return enqueue(async () => {
        await requireCohortDirectory(cohortId);
        const filePath = resolveAsset(cohortId, relativePath);
        if (!filePath) throw createError('文件路径不正确');
        try {
          await stat(filePath);
        } catch {
          return false;
        }
        await rm(filePath);
        return true;
      });
    },

    // `preview` is for administrators: unpublished cohorts and draft pages are included, as they will look once published.
    async listCohorts({ preview = false } = {}) {
      await applyDuePublishes();
      return (await readCohortManifest()).filter((cohort) => preview || cohort.status !== 'draft').map((cohort) => publicCohort(cohort, { preview }));
    },

    async getCohort(cohortId, { preview = false } = {}) {
      await applyDuePublishes();
      const cohort = (await readCohortManifest()).find((item) => item.id === cohortId && (preview || item.status !== 'draft'));
      return cohort ? publicCohort(cohort, { preview }) : null;
    },

    async listPages(cohortId, { preview = false } = {}) {
      await applyDuePublishes();
      const directory = cohortDirectory(cohortId);
      if (!directory || !(preview ? (await readCohortManifest()).some((cohort) => cohort.id === cohortId) : await isPublicCohort(cohortId))) return [];
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
      const slugs = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => entry.name.slice(0, -3))
        .filter((slug) => !RESERVED_SLUGS.has(slug));
      const groups = await groupsOf(cohortId);
      const pages = (await Promise.all(slugs.map((slug) => readPageFile(cohortId, slug, { drafts: preview })))).filter(Boolean);
      return sortPages(
        pages.map(({ body: _body, ...page }) => ({ ...page, group: knownGroup(groups, page.group) })),
        groups,
      );
    },

    async getPage(cohortId, slug, { preview = false } = {}) {
      await applyDuePublishes();
      if (!(preview ? (await readCohortManifest()).some((cohort) => cohort.id === cohortId) : await isPublicCohort(cohortId))) return null;
      const page = await readPageFile(cohortId, slug, { drafts: preview });
      if (!page) return null;
      return { ...page, attachments: await listAttachments(cohortId, page.body) };
    },

    resolveAsset,

    // Files of an unpublished cohort are only served to administrators (see the asset route).
    async resolvePublicAsset(cohortId, relativePath) {
      await applyDuePublishes();
      return (await isPublicCohort(cohortId)) ? resolveAsset(cohortId, relativePath) : null;
    },

    publishCohort(cohortId, { drafts = true } = {}) {
      return enqueue(() => publishInternal(cohortId, { drafts: drafts !== false }));
    },

    scheduleCohort(cohortId, { publishAt, drafts = true }) {
      return enqueue(async () => {
        const manifest = await readCohortManifest();
        const target = manifest.find((cohort) => cohort.id === cohortId);
        if (!target) throw createError('没有找到这一期招新', 404);
        if (target.status !== 'draft') throw createError('这一期招新已经发布，不能再定时发布');
        const at = parsePublishAt(publishAt);
        if (!at) throw createError('定时发布时间格式应为 2026-12-06 09:00（北京时间）');
        if (at.time <= now().getTime()) throw createError('定时发布的时间必须晚于现在');
        await writeManifest(manifest.map((cohort) => normalizeCohortInput(cohort.id === cohortId ? { ...cohort, publish_at: at.text, publish_drafts: drafts !== false } : cohort)));
        return { publish_at: at.text, publish_drafts: drafts !== false };
      });
    },

    cancelSchedule(cohortId) {
      return enqueue(async () => {
        const manifest = await readCohortManifest();
        if (!manifest.some((cohort) => cohort.id === cohortId)) throw createError('没有找到这一期招新', 404);
        await writeManifest(manifest.map((cohort) => normalizeCohortInput(cohort.id === cohortId ? { ...cohort, publish_at: '' } : cohort)));
      });
    },

    unpublishCohort(cohortId) {
      return enqueue(async () => {
        const manifest = await readCohortManifest();
        const target = manifest.find((cohort) => cohort.id === cohortId);
        if (!target) throw createError('没有找到这一期招新', 404);
        if (target.status === 'draft') throw createError('这一期招新还没有发布');
        await writeManifest(manifest.map((cohort) => normalizeCohortInput(cohort.id === cohortId ? { ...cohort, status: 'draft', publish_at: '' } : cohort)));
      });
    },
  };
};
