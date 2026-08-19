import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeContentContribution } from '../server/content-contribution.js';

test('normalizes allowed member content contributions', () => {
  const material = normalizeContentContribution('StudyMaterial', {
    title: ' 视觉学习教程 ',
    file_type: 'pdf',
    file_url: '/uploads/tutorial.pdf',
    ignored_admin_field: 'not stored',
  });
  assert.equal(material.title, '视觉学习教程');
  assert.equal(material.file_url, '/uploads/tutorial.pdf');
  assert.equal(Object.hasOwn(material, 'ignored_admin_field'), false);

  const qa = normalizeContentContribution('QA', { question: '如何加入？', answer: '关注招新通知。' });
  assert.equal(qa.question, '如何加入？');

  const award = normalizeContentContribution('Award', { title: '论文成果', type: 'research', doi_url: '10.1000/example' });
  assert.equal(award.type, 'research');
});

test('rejects malformed or unsupported contributions', () => {
  assert.throws(() => normalizeContentContribution('Member', { name: '越权数据' }), /不支持该投稿类型/);
  assert.throws(() => normalizeContentContribution('StudyMaterial', { title: '缺少链接' }), /上传文件或填写资料链接/);
  assert.throws(() => normalizeContentContribution('QA', { question: '没有答案' }), /参考答案/);
  assert.throws(() => normalizeContentContribution('Award', { title: '错误类型', type: 'unknown' }), /成果类型不正确/);
  assert.throws(() => normalizeContentContribution('Award', { title: '错误链接', type: 'research', project_url: 'javascript:alert(1)' }), /有效的链接/);
});
