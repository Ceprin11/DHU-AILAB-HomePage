import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStore } from '../server/store.js';

const withStore = async (run) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ailab-member-profile-'));
  try {
    await run(createStore(directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test('stores draft and published member profile states', async () => {
  await withStore(async (store) => {
    const draft = await store.create('Member', { name: '测试成员', profile_status: 'draft' });
    assert.equal(draft.profile_status, 'draft');

    const published = await store.update('Member', draft.id, {
      photo_url: '/uploads/member.webp',
      profile_status: 'published',
    });
    assert.equal(published.profile_status, 'published');
    assert.equal(published.photo_url, '/uploads/member.webp');
  });
});

test('keeps legacy members valid and rejects unknown profile states', async () => {
  await withStore(async (store) => {
    const legacy = await store.create('Member', { name: '现有成员' });
    assert.equal(legacy.profile_status, undefined);
    await assert.rejects(
      () => store.update('Member', legacy.id, { profile_status: 'unexpected' }),
      /profile_status is invalid/,
    );
  });
});

test('stores a member major', async () => {
  await withStore(async (store) => {
    const member = await store.create('Member', { name: '测试成员', major: '计算机科学与技术' });
    assert.equal(member.major, '计算机科学与技术');
  });
});

test('stores structured education and career experiences in display order', async () => {
  await withStore(async (store) => {
    const member = await store.create('Member', {
      name: '毕业成员',
      experiences: [
        {
          id: 'career-1',
          type: 'work',
          start_date: '2026-07',
          end_date: '',
          is_current: true,
          organization: '腾讯',
          role: '算法工程师',
          field: '',
          description: '',
        },
        {
          id: 'education-1',
          type: 'education',
          start_date: '2022-09',
          end_date: '2026-06',
          is_current: false,
          organization: '东华大学',
          role: '工学学士',
          field: '人工智能',
          description: '',
        },
      ],
    });

    assert.equal(member.experiences.length, 2);
    assert.equal(member.experiences[0].organization, '腾讯');
    assert.equal(member.experiences[1].field, '人工智能');
  });
});

test('rejects malformed member experiences', async () => {
  await withStore(async (store) => {
    await assert.rejects(
      () => store.create('Member', {
        name: '测试成员',
        experiences: [{ id: 'bad', type: 'education', start_date: '2026-13' }],
      }),
      /experience start_date must use YYYY-MM format/,
    );
  });
});
