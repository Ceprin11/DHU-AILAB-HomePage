import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApplicantStore, normalizeApplicantProfile, validatePassword } from '../server/applicant-store.js';

const profile = (overrides = {}) => ({ name: ' 张三 ', student_id: '2250001', grade: '大二', major: '人工智能', ...overrides });
const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ailab-applicants-'));
  return { root, store: createApplicantStore(root), cleanup: () => rm(root, { recursive: true, force: true }) };
};
const rejects = (promise, pattern, status) => assert.rejects(promise, (error) => {
  assert.match(error.message, pattern);
  if (status) assert.equal(error.status, status);
  return true;
});

test('checks every field of the profile and trims it', () => {
  assert.deepEqual(normalizeApplicantProfile(profile()), { name: '张三', student_id: '2250001', grade: '大二', major: '人工智能' });
  assert.throws(() => normalizeApplicantProfile(profile({ name: '' })), /请填写姓名/);
  assert.throws(() => normalizeApplicantProfile(profile({ name: 'a'.repeat(31) })), /姓名不能超过/);
  assert.throws(() => normalizeApplicantProfile(profile({ student_id: '12' })), /学号应为/);
  assert.throws(() => normalizeApplicantProfile(profile({ student_id: '22 50001' })), /学号应为/);
  assert.throws(() => normalizeApplicantProfile(profile({ grade: '大三' })), /请选择年级/);
  assert.throws(() => normalizeApplicantProfile(profile({ major: ' ' })), /请填写专业/);
});

test('passwords need 8 to 64 characters', () => {
  assert.equal(validatePassword('abcd1234'), 'abcd1234');
  assert.throws(() => validatePassword('short'), /至少 8 位/);
  assert.throws(() => validatePassword('x'.repeat(65)), /不能超过 64 位/);
  assert.throws(() => validatePassword(undefined), /至少 8 位/);
});

test('registers an applicant, never stores the password and never returns its hash', async () => {
  const { root, store, cleanup } = await fixture();
  try {
    const applicant = await store.register(profile(), 'correct horse');
    assert.deepEqual(Object.keys(applicant).sort(), ['created_at', 'grade', 'id', 'last_login_at', 'major', 'name', 'session_version', 'student_id']);
    const raw = await readFile(path.join(root, 'recruit-applicants.json'), 'utf8');
    assert.equal(raw.includes('correct horse'), false);
    assert.match(raw, /password_hash/);
    assert.equal(JSON.stringify(await store.list()).includes('password'), false);
    assert.equal((await store.getById(applicant.id)).name, '张三');
  } finally {
    await cleanup();
  }
});

test('one account per student id, whatever the letter case', async () => {
  const { store, cleanup } = await fixture();
  try {
    await store.register(profile({ student_id: 'ab12345' }), 'password-1');
    await rejects(store.register(profile({ student_id: 'AB12345', name: '李四' }), 'password-2'), /已经注册过/, 409);
    assert.equal((await store.list()).length, 1);
  } finally {
    await cleanup();
  }
});

test('signs in with the right password only', async () => {
  const { store, cleanup } = await fixture();
  try {
    await store.register(profile({ student_id: 'ab12345' }), 'password-1');
    assert.equal((await store.authenticate('AB12345', 'password-1')).student_id, 'ab12345');
    assert.equal(await store.authenticate('ab12345', 'password-2'), null);
    assert.equal(await store.authenticate('nobody1', 'password-1'), null);
    assert.equal(await store.authenticate('ab12345', ''), null);
  } finally {
    await cleanup();
  }
});

test('changing the password needs the current one and ends the old sessions', async () => {
  const { store, cleanup } = await fixture();
  try {
    const applicant = await store.register(profile(), 'password-1');
    await rejects(store.changePassword(applicant.id, 'wrong-pass', 'password-2'), /当前密码不正确/, 403);
    await rejects(store.changePassword(applicant.id, 'password-1', 'short'), /至少 8 位/);
    const changed = await store.changePassword(applicant.id, 'password-1', 'password-2');
    assert.equal(changed.session_version, applicant.session_version + 1);
    assert.equal(await store.authenticate('2250001', 'password-1'), null);
    assert.ok(await store.authenticate('2250001', 'password-2'));
  } finally {
    await cleanup();
  }
});

test('an administrator reset gives a temporary password and invalidates the old one', async () => {
  const { store, cleanup } = await fixture();
  try {
    const applicant = await store.register(profile(), 'password-1');
    const { password, applicant: updated } = await store.resetPassword(applicant.id);
    assert.match(password, /^[a-zA-Z2-9]{10}$/);
    assert.equal(/[01OIl]/.test(password), false);
    assert.equal(updated.session_version, applicant.session_version + 1);
    assert.equal(await store.authenticate('2250001', 'password-1'), null);
    assert.ok(await store.authenticate('2250001', password));
    await rejects(store.resetPassword('missing'), /账号不存在/, 404);
  } finally {
    await cleanup();
  }
});

test('removing an account lets the student register again', async () => {
  const { store, cleanup } = await fixture();
  try {
    const applicant = await store.register(profile(), 'password-1');
    assert.equal(await store.remove(applicant.id), true);
    assert.equal(await store.remove(applicant.id), false);
    assert.equal(await store.getById(applicant.id), null);
    assert.ok(await store.register(profile(), 'password-3'));
  } finally {
    await cleanup();
  }
});

test('concurrent registrations of the same student id leave exactly one account', async () => {
  const { store, cleanup } = await fixture();
  try {
    const results = await Promise.allSettled([1, 2, 3, 4].map((n) => store.register(profile(), `password-${n}`)));
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await store.list()).length, 1);
  } finally {
    await cleanup();
  }
});
