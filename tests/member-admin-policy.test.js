import assert from 'node:assert/strict';
import test from 'node:test';
import { checkMemberAccountChange, checkMemberDeletion, isEffectiveAdmin } from '../server/member-admin-policy.js';

const superAdmin = { role: 'admin', super: true };
const memberAdmin = { role: 'admin', super: false };
const adminAccount = { account: '20240001', active: true, is_admin: true, must_change_password: false };
const plainAccount = { account: '20240002', active: true, is_admin: false, must_change_password: false };

test('admin rights only apply after the initial password was replaced', () => {
  assert.equal(isEffectiveAdmin(adminAccount), true);
  assert.equal(isEffectiveAdmin({ ...adminAccount, must_change_password: true }), false, 'password is still the student id');
  assert.equal(isEffectiveAdmin({ ...adminAccount, active: false }), false);
  assert.equal(isEffectiveAdmin({ ...plainAccount }), false);
  assert.equal(isEffectiveAdmin(null), false);
  assert.equal(isEffectiveAdmin({ is_admin: true }), false, 'an unknown password state is never trusted');
});

test('only the super administrator can grant or revoke admin rights', () => {
  assert.equal(checkMemberAccountChange({ auth: superAdmin, target: plainAccount, config: { admin: true } }), '');
  assert.equal(checkMemberAccountChange({ auth: superAdmin, target: adminAccount, config: { admin: false } }), '');
  assert.equal(checkMemberAccountChange({ auth: superAdmin, target: null, config: { admin: true } }), '');
  for (const config of [{ admin: true }, { admin: false }]) {
    const target = config.admin ? plainAccount : adminAccount;
    assert.match(checkMemberAccountChange({ auth: memberAdmin, target, config }), /只有超级管理员/);
  }
  assert.match(checkMemberAccountChange({ auth: memberAdmin, target: null, config: { admin: true } }), /只有超级管理员/);
  assert.match(checkMemberAccountChange({ auth: null, target: plainAccount, config: { admin: true } }), /只有超级管理员/);
});

test('a member administrator can still save a form that does not change admin rights', () => {
  assert.equal(checkMemberAccountChange({ auth: memberAdmin, target: plainAccount, config: { account: '20240002', active: true, admin: false } }), '');
  assert.equal(checkMemberAccountChange({ auth: memberAdmin, target: plainAccount, config: { admin: undefined } }), '');
  assert.equal(checkMemberAccountChange({ auth: memberAdmin, target: adminAccount, config: { account: '20240001', active: true, admin: true } }), '');
  assert.equal(checkMemberAccountChange({ auth: memberAdmin, target: null, config: { admin: false } }), '');
});

test('login settings of other administrators are protected from member administrators', () => {
  for (const config of [{ account: '99999999' }, { active: false }, { resetPassword: true }]) {
    assert.match(checkMemberAccountChange({ auth: memberAdmin, target: adminAccount, config }), /只能由超级管理员修改/);
    assert.equal(checkMemberAccountChange({ auth: superAdmin, target: adminAccount, config }), '');
    assert.equal(checkMemberAccountChange({ auth: memberAdmin, target: plainAccount, config }), '', 'ordinary members stay manageable');
  }
  assert.equal(checkMemberAccountChange({ auth: memberAdmin, target: adminAccount, config: { account: ' 20240001 ' } }), '', 'same account, different spacing');
});

test('administrator members can only be deleted by the super administrator', () => {
  assert.match(checkMemberDeletion({ auth: memberAdmin, target: adminAccount }), /只能由超级管理员删除/);
  assert.equal(checkMemberDeletion({ auth: superAdmin, target: adminAccount }), '');
  assert.equal(checkMemberDeletion({ auth: memberAdmin, target: plainAccount }), '');
  assert.equal(checkMemberDeletion({ auth: memberAdmin, target: null }), '');
});
