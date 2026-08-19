import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMembersByRoleAndName, getMemberRoleRank, isGraduatedMember } from '../src/lib/memberSort.js';

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

test('treats current and former leadership as the same ordering level', () => {
  assert.equal(getMemberRoleRank({ category: 'current_president' }), getMemberRoleRank({ category: 'president' }));
  assert.equal(getMemberRoleRank({ category: 'current_vice_president' }), getMemberRoleRank({ category: 'vice_president' }));
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

test('treats grade 22 and earlier as graduated members', () => {
  assert.equal(isGraduatedMember({ grade: '22', graduated: false }), true);
  assert.equal(isGraduatedMember({ grade: '2022', graduated: false }), true);
  assert.equal(isGraduatedMember({ grade: '23', graduated: false }), false);
  assert.equal(isGraduatedMember({ grade: '24', graduated: true }), true);
});
