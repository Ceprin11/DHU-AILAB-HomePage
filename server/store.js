import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export const ENTITY_RULES = {
  Activity: ['title'],
  Award: ['title'],
  ClubLife: ['title'],
  HomeImage: ['title', 'image_url'],
  Member: ['name'],
  Notification: ['title'],
  QA: ['question', 'answer'],
  SiteSettings: [],
  StudyMaterial: ['title'],
  VideoLink: ['title', 'bilibili_url'],
};

const emptyData = Object.fromEntries(Object.keys(ENTITY_RULES).map((name) => [name, []]));
let writeQueue = Promise.resolve();

export function createStore(dataDirectory) {
  const dataFile = path.join(dataDirectory, 'site-data.json');

  const ensureData = async () => {
    await mkdir(dataDirectory, { recursive: true });
    try {
      await readFile(dataFile, 'utf8');
    } catch {
      await writeFile(dataFile, JSON.stringify(emptyData, null, 2), 'utf8');
    }
  };

  const readData = async () => {
    await ensureData();
    const parsed = JSON.parse(await readFile(dataFile, 'utf8'));
    return { ...emptyData, ...parsed };
  };

  const saveData = (data) => {
    writeQueue = writeQueue.then(() => writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8'));
    return writeQueue;
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
  };

  return {
    async list(entityName, sort, limit = 200) {
      assertEntity(entityName);
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
      validate(entityName, payload);
      const data = await readData();
      const now = new Date().toISOString();
      const record = {
        ...payload,
        id: randomUUID(),
        created_date: now,
        updated_date: now,
      };
      data[entityName].push(record);
      await saveData(data);
      return record;
    },

    async update(entityName, id, payload) {
      assertEntity(entityName);
      const data = await readData();
      const index = data[entityName].findIndex((item) => item.id === id);
      if (index === -1) {
        const error = new Error('Record not found');
        error.status = 404;
        throw error;
      }
      const record = {
        ...data[entityName][index],
        ...payload,
        id,
        updated_date: new Date().toISOString(),
      };
      validate(entityName, record);
      data[entityName][index] = record;
      await saveData(data);
      return record;
    },

    async remove(entityName, id) {
      assertEntity(entityName);
      const data = await readData();
      const index = data[entityName].findIndex((item) => item.id === id);
      if (index === -1) {
        const error = new Error('Record not found');
        error.status = 404;
        throw error;
      }
      data[entityName].splice(index, 1);
      await saveData(data);
      return { success: true };
    },
  };
}
