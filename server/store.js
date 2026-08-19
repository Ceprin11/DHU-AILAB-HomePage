import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const ENTITY_RULES = {
  Activity: ['title'],
  Album: ['title'],
  Award: ['title'],
  ClubLife: ['title'],
  GuideCategory: ['title'],
  GuideCourse: ['title', 'category_id'],
  GuideStage: ['title'],
  HomeImage: ['title', 'image_url'],
  Member: ['name'],
  Notification: ['title'],
  QA: ['question', 'answer'],
  SiteSettings: [],
  StudyMaterial: ['title'],
  VideoLink: ['title', 'bilibili_url'],
};

const MEMBER_DESTINATIONS = new Set(['', '保研', '留学', '就业', '其他']);
const MEMBER_PROFILE_STATUSES = new Set(['draft', 'published', 'hidden']);
const MEMBER_EXPERIENCE_TYPES = new Set(['education', 'work', 'internship', 'other']);
const MEMBER_EXPERIENCE_LIMIT = 30;
const MEMBER_EXPERIENCE_FIELD_LIMITS = {
  id: 100,
  start_date: 7,
  end_date: 7,
  organization: 200,
  role: 200,
  field: 200,
  description: 1000,
};
const MEMBER_FIELD_LIMITS = {
  major: 100,
  hometown: 100,
  hobbies: 500,
  destination_organization: 200,
  destination_specialty: 200,
  destination_position: 200,
  destination_detail: 300,
  personal_homepage: 500,
  message_to_juniors: 2000,
};
const AWARD_LINK_FIELDS = ['arxiv_url', 'project_url', 'code_url'];
const ALBUM_IMAGE_LIMIT = 20;
const ALBUM_FIELD_LIMITS = {
  title: 200,
  date: 40,
  category: 20,
  location: 200,
  description: 10000,
};
const ALBUM_CATEGORIES = new Set(['activity', 'club_life']);

const normalizeMemberExperiences = (experiences) => experiences.map((experience) => {
  if (!experience || typeof experience !== 'object' || Array.isArray(experience)) return experience;
  const normalized = {
    id: experience.id || randomUUID(),
    type: experience.type || 'education',
    start_date: experience.start_date || '',
    end_date: experience.end_date || '',
    is_current: experience.is_current ?? false,
    organization: experience.organization || '',
    role: experience.role || '',
    field: experience.field || '',
    description: experience.description || '',
  };
  if (normalized.is_current === true) normalized.end_date = '';
  return normalized;
});

const normalizeMember = (member) => {
  const normalized = { ...member };

  if (Array.isArray(normalized.experiences)) {
    normalized.experiences = normalizeMemberExperiences(normalized.experiences);
  }

  if (normalized.destination_detail && !normalized.destination_organization) {
    const [organization = '', detail = ''] = normalized.destination_detail
      .split(/\s*[·，|]\s*/, 2)
      .map((value) => value.trim());
    normalized.destination_organization = organization;
    if (normalized.destination === '就业') normalized.destination_position = detail;
    if (normalized.destination === '保研' || normalized.destination === '留学') normalized.destination_specialty = detail;
  }

  delete normalized.destination_detail;

  if (!normalized.graduated) {
    normalized.destination = '';
    normalized.destination_organization = '';
    normalized.destination_specialty = '';
    normalized.destination_position = '';
  } else if (normalized.destination === '就业') {
    normalized.destination_specialty = '';
  } else if (normalized.destination === '保研' || normalized.destination === '留学') {
    normalized.destination_position = '';
  } else {
    normalized.destination_specialty = '';
    normalized.destination_position = '';
  }

  return normalized;
};

const normalizeAlbum = (album) => {
  const normalized = { ...album };
  if (Array.isArray(normalized.images)) {
    normalized.images = normalized.images.map((image) => ({
      id: image?.id || randomUUID(),
      url: image?.url || image?.image_url || '',
      is_home_featured: image?.is_home_featured === true,
    }));
    normalized.image_url = normalized.images[0]?.url || '';
  }
  return normalized;
};

const normalizeRecord = (entityName, record) => {
  if (entityName === 'Member') return normalizeMember(record);
  if (entityName === 'Album') return normalizeAlbum(record);
  return record;
};

const emptyData = Object.fromEntries(Object.keys(ENTITY_RULES).map((name) => [name, []]));

export function createStore(dataDirectory) {
  const dataFile = path.join(dataDirectory, 'site-data.json');
  let ensurePromise = null;
  let mutationQueue = Promise.resolve();
  let cachedData = null;

  const ensureData = () => {
    if (!ensurePromise) {
      ensurePromise = (async () => {
        await mkdir(dataDirectory, { recursive: true });
        try {
          await readFile(dataFile, 'utf8');
        } catch {
          await writeFile(dataFile, JSON.stringify(emptyData, null, 2), 'utf8');
        }
      })();
    }
    return ensurePromise;
  };

  const readData = async () => {
    await ensureData();
    if (!cachedData) {
      const parsed = JSON.parse(await readFile(dataFile, 'utf8'));
      cachedData = { ...emptyData, ...parsed };
    }
    return cachedData;
  };

  const saveData = async (data) => {
    await writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
    cachedData = data;
  };

  const enqueueMutation = (operation) => {
    const result = mutationQueue.then(operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const assertEntity = (entityName) => {
    if (!Object.hasOwn(ENTITY_RULES, entityName)) {
      const error = new Error('Unknown entity');
      error.status = 404;
      throw error;
    }
  };

  const validate = (entityName, record) => {
    const missing = ENTITY_RULES[entityName].find((field) => !record[field]);
    if (missing) {
      const error = new Error(`${missing} is required`);
      error.status = 400;
      throw error;
    }

    if (entityName === 'Member') {
      if (record.graduated !== undefined && typeof record.graduated !== 'boolean') {
        const error = new Error('graduated must be a boolean');
        error.status = 400;
        throw error;
      }

      if (record.destination !== undefined && !MEMBER_DESTINATIONS.has(record.destination)) {
        const error = new Error('destination is invalid');
        error.status = 400;
        throw error;
      }

      if (record.profile_status !== undefined && !MEMBER_PROFILE_STATUSES.has(record.profile_status)) {
        const error = new Error('profile_status is invalid');
        error.status = 400;
        throw error;
      }

      for (const [field, maxLength] of Object.entries(MEMBER_FIELD_LIMITS)) {
        const value = record[field];
        if (value !== undefined && value !== null && typeof value !== 'string') {
          const error = new Error(`${field} must be a string`);
          error.status = 400;
          throw error;
        }
        if (typeof value === 'string' && value.length > maxLength) {
          const error = new Error(`${field} is too long`);
          error.status = 400;
          throw error;
        }
      }

      if (record.experiences !== undefined) {
        if (!Array.isArray(record.experiences) || record.experiences.length > MEMBER_EXPERIENCE_LIMIT) {
          const error = new Error(`experiences must be an array with at most ${MEMBER_EXPERIENCE_LIMIT} items`);
          error.status = 400;
          throw error;
        }

        for (const experience of record.experiences) {
          if (!experience || typeof experience !== 'object' || Array.isArray(experience)) {
            const error = new Error('experience must be an object');
            error.status = 400;
            throw error;
          }
          if (!MEMBER_EXPERIENCE_TYPES.has(experience.type)) {
            const error = new Error('experience type is invalid');
            error.status = 400;
            throw error;
          }
          if (typeof experience.is_current !== 'boolean') {
            const error = new Error('experience is_current must be a boolean');
            error.status = 400;
            throw error;
          }
          for (const [field, maxLength] of Object.entries(MEMBER_EXPERIENCE_FIELD_LIMITS)) {
            if (typeof experience[field] !== 'string' || experience[field].length > maxLength) {
              const error = new Error(`experience ${field} is invalid`);
              error.status = 400;
              throw error;
            }
          }
          for (const field of ['start_date', 'end_date']) {
            if (experience[field] && !/^\d{4}-(0[1-9]|1[0-2])$/.test(experience[field])) {
              const error = new Error(`experience ${field} must use YYYY-MM format`);
              error.status = 400;
              throw error;
            }
          }
        }
      }

      if (record.personal_homepage) {
        try {
          const homepage = new URL(record.personal_homepage);
          if (!['http:', 'https:'].includes(homepage.protocol)) throw new Error('unsupported protocol');
        } catch {
          const error = new Error('personal_homepage must be a valid http/https URL');
          error.status = 400;
          throw error;
        }
      }
    }

    if (entityName === 'Album') {
      for (const [field, maxLength] of Object.entries(ALBUM_FIELD_LIMITS)) {
        const value = record[field];
        if (value !== undefined && value !== null && typeof value !== 'string') {
          const error = new Error(`${field} must be a string`);
          error.status = 400;
          throw error;
        }
        if (typeof value === 'string' && value.length > maxLength) {
          const error = new Error(`${field} is too long`);
          error.status = 400;
          throw error;
        }
      }

      if (record.date && Number.isNaN(Date.parse(record.date))) {
        const error = new Error('date is invalid');
        error.status = 400;
        throw error;
      }

      if (record.category !== undefined && !ALBUM_CATEGORIES.has(record.category)) {
        const error = new Error('category is invalid');
        error.status = 400;
        throw error;
      }

      if (record.images !== undefined) {
        if (!Array.isArray(record.images) || record.images.length > ALBUM_IMAGE_LIMIT) {
          const error = new Error(`images must be an array with at most ${ALBUM_IMAGE_LIMIT} items`);
          error.status = 400;
          throw error;
        }

        const imageIds = new Set();
        for (const image of record.images) {
          if (!image || typeof image !== 'object' || Array.isArray(image)) {
            const error = new Error('album image must be an object');
            error.status = 400;
            throw error;
          }
          if (typeof image.id !== 'string' || !image.id || image.id.length > 100 || imageIds.has(image.id)) {
            const error = new Error('album image id is invalid');
            error.status = 400;
            throw error;
          }
          imageIds.add(image.id);
          if (typeof image.url !== 'string' || !image.url || image.url.length > 1000) {
            const error = new Error('album image url is invalid');
            error.status = 400;
            throw error;
          }
          if (typeof image.is_home_featured !== 'boolean') {
            const error = new Error('album image is_home_featured must be a boolean');
            error.status = 400;
            throw error;
          }
        }
      }
    }

    if (entityName === 'Award') {
      for (const field of AWARD_LINK_FIELDS) {
        if (!record[field]) continue;
        try {
          const link = new URL(record[field]);
          if (!['http:', 'https:'].includes(link.protocol)) throw new Error('unsupported protocol');
        } catch {
          const error = new Error(`${field} must be a valid http/https URL`);
          error.status = 400;
          throw error;
        }
      }

    }

    if (entityName === 'HomeImage' && record.is_visible !== undefined && typeof record.is_visible !== 'boolean') {
      const error = new Error('is_visible must be a boolean');
      error.status = 400;
      throw error;
    }

    if (entityName === 'SiteSettings' && record.page_texts !== undefined) {
      if (!record.page_texts || typeof record.page_texts !== 'object' || Array.isArray(record.page_texts)) {
        const error = new Error('page_texts must be an object');
        error.status = 400;
        throw error;
      }
      const entries = Object.entries(record.page_texts);
      if (entries.length > 300 || entries.some(([key, value]) => key.length > 100 || typeof value !== 'string' || value.length > 5000)) {
        const error = new Error('页面文案格式或长度不符合要求');
        error.status = 400;
        throw error;
      }
    }
  };

  const validateRelations = (entityName, record, data) => {
    if (entityName === 'GuideCourse' && !data.GuideCategory.some((category) => category.id === record.category_id)) {
      const error = new Error('所选资源板块不存在');
      error.status = 400;
      throw error;
    }
  };

  return {
    async get(entityName, id) {
      assertEntity(entityName);
      await mutationQueue;
      const data = await readData();
      return data[entityName].find((item) => item.id === id) || null;
    },

    async list(entityName, sort, limit = 200) {
      assertEntity(entityName);
      await mutationQueue;
      const data = await readData();
      const records = [...data[entityName]];
      if (sort) {
        const descending = sort.startsWith('-');
        const field = sort.replace(/^[+-]/, '');
        records.sort((a, b) => {
          const left = a[field] ?? '';
          const right = b[field] ?? '';
          const result = typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right), 'zh-CN');
          return descending ? -result : result;
        });
      }
      return records.slice(0, Math.min(Number(limit) || 200, 5000));
    },

    async create(entityName, payload) {
      assertEntity(entityName);
      const normalizedPayload = normalizeRecord(entityName, payload);
      validate(entityName, normalizedPayload);
      return enqueueMutation(async () => {
        const data = structuredClone(await readData());
        validateRelations(entityName, normalizedPayload, data);
        const now = new Date().toISOString();
        const record = {
          ...normalizedPayload,
          id: randomUUID(),
          created_date: now,
          updated_date: now,
        };
        data[entityName].push(record);
        await saveData(data);
        return record;
      });
    },

    async update(entityName, id, payload) {
      assertEntity(entityName);
      return enqueueMutation(async () => {
        const data = structuredClone(await readData());
        const index = data[entityName].findIndex((item) => item.id === id);
        if (index === -1) {
          const error = new Error('Record not found');
          error.status = 404;
          throw error;
        }
        const record = normalizeRecord(entityName, {
          ...data[entityName][index],
          ...payload,
          id,
          updated_date: new Date().toISOString(),
        });
        validate(entityName, record);
        validateRelations(entityName, record, data);
        data[entityName][index] = record;
        await saveData(data);
        return record;
      });
    },

    async remove(entityName, id) {
      assertEntity(entityName);
      return enqueueMutation(async () => {
        const data = structuredClone(await readData());
        const index = data[entityName].findIndex((item) => item.id === id);
        if (index === -1) {
          const error = new Error('Record not found');
          error.status = 404;
          throw error;
        }
        if (entityName === 'GuideCategory' && data.GuideCourse.some((course) => course.category_id === id)) {
          const error = new Error('请先删除该板块下的课程');
          error.status = 409;
          throw error;
        }
        data[entityName].splice(index, 1);
        await saveData(data);
        return { success: true };
      });
    },
  };
}
