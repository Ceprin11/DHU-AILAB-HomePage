import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicMember } from '../server/member-visibility.js';

test('only publishes members who have uploaded a photo', () => {
  assert.equal(isPublicMember({ name: '未登录成员' }), false);
  assert.equal(isPublicMember({ name: '草稿成员', profile_status: 'draft' }), false);
  assert.equal(isPublicMember({ name: '仅文字资料', bio: '已填写', profile_status: 'published' }), false);
  assert.equal(isPublicMember({ name: '已完成成员', photo_url: '/uploads/member.webp', profile_status: 'published' }), true);
});

test('keeps legacy members with photos public but respects hidden state', () => {
  assert.equal(isPublicMember({ name: '旧成员', photo_url: '/uploads/legacy.webp' }), true);
  assert.equal(isPublicMember({ name: '隐藏成员', photo_url: '/uploads/member.webp', profile_status: 'hidden' }), false);
});
