const FIELDS = {
  StudyMaterial: ['title', 'category', 'file_type', 'file_url', 'thumbnail_url', 'date', 'description'],
  QA: ['question', 'answer', 'category'],
  Award: ['title', 'type', 'recipient', 'date', 'level', 'ccf_level', 'doi_url', 'arxiv_url', 'project_url', 'code_url', 'description', 'notes', 'image_url'],
};

const LIMITS = {
  title: 300,
  category: 100,
  file_type: 30,
  file_url: 1000,
  thumbnail_url: 1000,
  date: 40,
  description: 10000,
  question: 1000,
  answer: 10000,
  type: 30,
  recipient: 500,
  level: 30,
  ccf_level: 100,
  doi_url: 1000,
  arxiv_url: 1000,
  project_url: 1000,
  code_url: 1000,
  notes: 3000,
  image_url: 1000,
};

const FILE_TYPES = new Set(['pdf', 'code', 'data', 'doc', 'video', 'other']);
const AWARD_TYPES = new Set(['competition', 'research']);
const AWARD_LEVELS = new Set(['', 'national', 'provincial', 'university', 'other']);
const URL_FIELDS = ['file_url', 'thumbnail_url', 'arxiv_url', 'project_url', 'code_url', 'image_url'];

const createError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const isAllowedUrl = (value) => {
  if (!value) return true;
  if (value.startsWith('/uploads/')) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export function normalizeContentContribution(entityName, input = {}) {
  const fields = FIELDS[entityName];
  if (!fields) throw createError('不支持该投稿类型');
  const payload = Object.fromEntries(fields
    .filter((field) => input[field] !== undefined)
    .map((field) => [field, typeof input[field] === 'string' ? input[field].trim() : input[field]]));

  for (const [field, value] of Object.entries(payload)) {
    if (typeof value !== 'string') throw createError(`${field} 格式不正确`);
    if (value.length > LIMITS[field]) throw createError(`${field} 内容过长`);
  }

  if (entityName === 'StudyMaterial') {
    if (!payload.title) throw createError('请填写资料名称');
    if (!payload.file_url) throw createError('请上传文件或填写资料链接');
    payload.file_type = payload.file_type || 'other';
    if (!FILE_TYPES.has(payload.file_type)) throw createError('资料类型不正确');
  }

  if (entityName === 'QA') {
    if (!payload.question) throw createError('请填写问题');
    if (!payload.answer) throw createError('请填写参考答案');
  }

  if (entityName === 'Award') {
    if (!payload.title) throw createError('请填写成果名称');
    payload.type = payload.type || 'competition';
    if (!AWARD_TYPES.has(payload.type)) throw createError('成果类型不正确');
    if (!AWARD_LEVELS.has(payload.level || '')) throw createError('竞赛级别不正确');
  }

  if (payload.date && Number.isNaN(Date.parse(payload.date))) throw createError('日期格式不正确');
  for (const field of URL_FIELDS) {
    if (!isAllowedUrl(payload[field])) throw createError(`${field} 必须是有效的链接`);
  }
  if (payload.doi_url) {
    const doi = payload.doi_url.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
    if (!/^10\.\d{4,9}\/\S+$/i.test(doi)) throw createError('DOI 格式不正确');
  }

  return payload;
}

export const CONTRIBUTION_ENTITY_NAMES = new Set(Object.keys(FIELDS));
