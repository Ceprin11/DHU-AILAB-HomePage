import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicAlbumCategory, serializePublicAlbum } from '../server/public-albums.js';

test('only accepts album categories used by public content pages', () => {
  assert.equal(isPublicAlbumCategory('activity'), true);
  assert.equal(isPublicAlbumCategory('club_life'), true);
  assert.equal(isPublicAlbumCategory('all'), false);
});

test('publishes album display fields without management metadata', () => {
  const album = serializePublicAlbum({
    id: 'album-1',
    title: '技术沙龙',
    date: '2026-08-20T14:00',
    category: 'activity',
    location: '图文信息中心',
    description: '活动记录',
    created_by_user_id: 'private-member-id',
    created_by_name: '成员姓名',
    images: [{ id: 'photo-1', url: '/uploads/photo.webp', is_home_featured: true }],
  });

  assert.deepEqual(Object.keys(album), ['id', 'title', 'date', 'category', 'location', 'description', 'images']);
  assert.deepEqual(album.images, [{ id: 'photo-1', url: '/uploads/photo.webp' }]);
  assert.equal(Object.hasOwn(album, 'created_by_user_id'), false);
  assert.equal(Object.hasOwn(album.images[0], 'is_home_featured'), false);
});

test('does not publish empty or unsupported albums', () => {
  assert.equal(serializePublicAlbum({ category: 'private', images: [{ url: '/uploads/a.webp' }] }), null);
  assert.equal(serializePublicAlbum({ category: 'activity', images: [] }), null);
});
