import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStore } from '../server/store.js';

const withStore = async (run) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ailab-album-'));
  try {
    await run(createStore(directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test('stores album photos and homepage selections', async () => {
  await withStore(async (store) => {
    const album = await store.create('Album', {
      title: '春季技术沙龙',
      date: '2026-04-12T14:30',
      category: 'activity',
      description: '实验室成员技术分享。',
      images: [
        { id: 'photo-1', url: '/uploads/one.webp', is_home_featured: true },
        { id: 'photo-2', url: '/uploads/two.webp', is_home_featured: false },
      ],
    });

    assert.equal(album.images.length, 2);
    assert.equal(album.images[0].is_home_featured, true);
    assert.equal(album.image_url, '/uploads/one.webp');

    const updated = await store.update('Album', album.id, {
      images: album.images.map((image) => ({ ...image, is_home_featured: true })),
    });
    assert.equal(updated.images.filter((image) => image.is_home_featured).length, 2);
  });
});

test('normalizes photo ids and rejects malformed album data', async () => {
  await withStore(async (store) => {
    const album = await store.create('Album', {
      title: '社团日常',
      category: 'club_life',
      images: [{ url: '/uploads/daily.webp' }],
    });
    assert.ok(album.images[0].id);
    assert.equal(album.images[0].is_home_featured, false);

    await assert.rejects(
      () => store.create('Album', { title: '错误分类', category: 'unknown' }),
      /category is invalid/,
    );
    await assert.rejects(
      () => store.update('Album', album.id, { images: [{ id: 'bad', url: '', is_home_featured: false }] }),
      /album image url is invalid/,
    );
  });
});
