import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMemberImportRows, planMemberImport } from '../server/member-import.js';
import { parseMemberCsv } from '../src/lib/memberCsv.js';

test('parses the exported one-column roster format', () => {
  assert.deepEqual(parseMemberCsv('姓名\n"230995228 - 张满"\n"220995117 - 唐志豪"'), [
    { account: '230995228', name: '张满', grade: '23' },
    { account: '220995117', name: '唐志豪', grade: '22' },
  ]);
});

test('parses regular account and name columns', () => {
  assert.deepEqual(parseMemberCsv('学号,姓名,年级\n24000001,测试成员,24'), [
    { account: '24000001', name: '测试成员', grade: '24' },
  ]);
});

test('derives grade from the first two account digits', () => {
  assert.deepEqual(normalizeMemberImportRows([{ account: '240995101', name: '高敏' }])[0], {
    row: 1,
    account: '240995101',
    name: '高敏',
    grade: '24',
    errors: [],
  });
});

test('plans idempotent member imports without overwriting profiles', () => {
  const members = [
    { id: 'existing', name: '已有成员', grade: '', bio: '保留简介' },
    { id: 'linked', name: '已绑定成员', grade: '23' },
  ];
  const accounts = [{ member_id: 'linked', account: '23000001' }];
  const plan = planMemberImport([
    { account: '22000001', name: '已有成员' },
    { account: '23000001', name: '已绑定成员' },
    { account: '24000001', name: '新成员' },
  ], members, accounts);

  assert.deepEqual(plan.counts, { create: 1, bind: 1, skip: 1, conflict: 0 });
  assert.equal(plan.items[0].member_id, 'existing');
  assert.equal(plan.items[0].action, 'bind');
  assert.equal(plan.items[1].action, 'skip');
  assert.equal(plan.items[2].action, 'create');
});

test('reports duplicate input and account ownership conflicts', () => {
  const plan = planMemberImport([
    { account: '24000001', name: '甲' },
    { account: '24000001', name: '乙' },
    { account: '23000001', name: '另一个人' },
  ], [{ id: 'linked', name: '已绑定成员' }], [{ member_id: 'linked', account: '23000001' }]);

  assert.equal(plan.counts.conflict, 3);
  assert.match(plan.items[0].message, /重复/);
  assert.match(plan.items[2].message, /已绑定/);
});
