import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMembersByRoleAndName, getMemberRoleRank } from '../src/lib/memberSort.js';

test('sorts each member role in the requested order', () => {
  const members = [
    { name: '普通成员', category: 'member' },
    { name: '核心成员', category: 'core' },
    { name: '副社长', category: 'vice_president' },
    { name: '社长', category: 'president' },
  ];
  assert.deepEqual(members.sort(compareMembersByRoleAndName).map((member) => member.category), [
    'president', 'vice_president', 'core', 'member',
  ]);
});

test('uses legacy titles and pinyin name order within the same role', () => {
  assert.equal(getMemberRoleRank({ category: 'core', title: '副社长' }), 1);
  const members = [
    { id: '3', name: '张三', category: 'member' },
    { id: '1', name: '陈晨', category: 'member' },
    { id: '2', name: '李四', category: 'member' },
  ];
  assert.deepEqual(members.sort(compareMembersByRoleAndName).map((member) => member.name), ['陈晨', '李四', '张三']);
});
