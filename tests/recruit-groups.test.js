import assert from 'node:assert/strict';
import test from 'node:test';
import { groupSubmissions } from '../src/lib/recruit.js';

const row = (overrides) => ({
  id: 'x', name: '张三', student_id: '2250001', grade: '大二', major: '人工智能', direction: 'CLIP', version: 1, created_at: '2026-11-21T00:00:00Z', ...overrides,
});

test('groups applicants under the paper they chose, in the configured order', () => {
  const { groups } = groupSubmissions([
    row({ id: 'a', direction: 'T5', name: '王五', student_id: '2250003' }),
    row({ id: 'b', direction: 'CLIP', name: '李四', student_id: '2250002' }),
    row({ id: 'c', direction: 'ViT', name: '赵六', student_id: '2250004' }),
    row({ id: 'd', direction: 'Other', name: '孙七', student_id: '2250005' }),
  ], ['ViT', 'CLIP', 'BERT', 'T5']);
  assert.deepEqual(groups.map((group) => group.direction), ['ViT', 'CLIP', 'T5', 'Other']);
  assert.deepEqual(groups.map((group) => group.people.length), [1, 1, 1, 1]);
});

test('turns re-submissions into versions of one person, newest first', () => {
  const { people, groups } = groupSubmissions([
    row({ id: 'v1', version: 1 }),
    row({ id: 'v3', version: 3, major: '软件工程' }),
    row({ id: 'v2', version: 2 }),
    row({ id: 'other-paper', direction: 'ViT', version: 1 }),
    row({ id: 'other-person', student_id: '2250002', name: '李四' }),
  ], ['ViT', 'CLIP']);
  assert.equal(people.length, 3);
  const zhang = people.find((person) => person.student_id === '2250001' && person.direction === 'CLIP');
  assert.deepEqual(zhang.versions.map((version) => version.id), ['v3', 'v2', 'v1']);
  assert.equal(zhang.latest.id, 'v3');
  assert.equal(zhang.major, '软件工程');
  assert.deepEqual(groups.map((group) => group.direction), ['ViT', 'CLIP']);
});

test('treats student ids case-insensitively and sorts people by name inside a group', () => {
  const { people, groups } = groupSubmissions([
    row({ id: 'a', student_id: 'ab12345', name: '周八' }),
    row({ id: 'b', student_id: 'AB12345', name: '周八', version: 2 }),
    row({ id: 'c', student_id: '2250009', name: '安九' }),
  ]);
  assert.equal(people.length, 2);
  assert.deepEqual(groups[0].people.map((person) => person.name), ['安九', '周八']);
});

test('handles an empty list', () => {
  assert.deepEqual(groupSubmissions([]), { people: [], groups: [] });
});
