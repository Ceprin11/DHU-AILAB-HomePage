import assert from 'node:assert/strict';
import test from 'node:test';
import { applyHomeSelectionPolicy } from '../server/album-permissions.js';

test('only lets administrators choose homepage album photos', () => {
  const requested = [
    { id: 'existing', url: '/uploads/existing.webp', is_home_featured: false },
    { id: 'new', url: '/uploads/new.webp', is_home_featured: true },
  ];
  const previous = [{ id: 'existing', url: '/uploads/existing.webp', is_home_featured: true }];

  const memberResult = applyHomeSelectionPolicy('member', requested, previous);
  assert.equal(memberResult[0].is_home_featured, true);
  assert.equal(memberResult[1].is_home_featured, false);

  const adminResult = applyHomeSelectionPolicy('admin', requested, previous);
  assert.equal(adminResult[0].is_home_featured, false);
  assert.equal(adminResult[1].is_home_featured, true);
});
