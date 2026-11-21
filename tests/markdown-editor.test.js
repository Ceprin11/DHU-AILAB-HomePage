import assert from 'node:assert/strict';
import test from 'node:test';
import { altToCaption } from '../src/lib/recruit.js';

test('moves the description of a lone image into its caption', () => {
  assert.equal(altToCaption('![GPT-2 整体结构](图片和附件/总图.png)'), '![1.00](图片和附件/总图.png "GPT-2 整体结构")');
  assert.equal(altToCaption('前文\n\n![预训练 vs 微调](a/b.png)\n\n后文'), '前文\n\n![1.00](a/b.png "预训练 vs 微调")\n\n后文');
  assert.equal(altToCaption('  ![说明](x.png)  '), '  ![1.00](x.png "说明")  ');
  assert.equal(altToCaption('![他说"好"](x.png)'), '![1.00](x.png "他说\\"好\\"")');
});

test('leaves images alone when there is nothing to preserve or they are not on their own line', () => {
  for (const text of [
    '![1.00](x.png)',
    '![0.5](x.png "已有图注")',
    '![](x.png)',
    '![有图注](x.png "图注")',
    '一句话里的 ![小图](x.png) 内联图片',
    '[链接](x.png)',
  ]) assert.equal(altToCaption(text), text);
});

test('never rewrites images inside fenced code', () => {
  const text = '```md\n![示例](a.png)\n```\n\n~~~\n![另一个](b.png)\n~~~\n\n![真图](c.png)';
  assert.equal(altToCaption(text), '```md\n![示例](a.png)\n```\n\n~~~\n![另一个](b.png)\n~~~\n\n![1.00](c.png "真图")');
});

test('is idempotent', () => {
  const once = altToCaption('![说明](x.png)');
  assert.equal(altToCaption(once), once);
});

import { cleanEditorMarkdown } from '../src/lib/recruit.js';

test('removes lone <br /> paragraphs left by empty lines', () => {
  assert.equal(cleanEditorMarkdown('# 标题\n\n<br />\n\n正文\n\n<br />\n'), '# 标题\n\n正文\n');
  assert.equal(cleanEditorMarkdown('第一段\n\n<br>\n\n第二段'), '第一段\n\n第二段');
  assert.equal(cleanEditorMarkdown('表格 | a<br />b | 单元格内换行'), '表格 | a<br />b | 单元格内换行');
});

test('turns escaped bare URLs back into autolinks without swallowing the text around them', () => {
  assert.equal(
    cleanEditorMarkdown('* 原文：https\\://cdn.openai.com/better-language-models/language\\_models\\_are.pdf'),
    '* 原文：<https://cdn.openai.com/better-language-models/language_models_are.pdf>',
  );
  assert.equal(cleanEditorMarkdown('见 https\\://a.com/x\\_y，更多'), '见 <https://a.com/x_y>，更多');
});

test('leaves ordinary links and plain text alone', () => {
  for (const text of [
    '[链接](https://a.com/x_y)',
    '<https://a.com/x_y>',
    '普通文字 a_b 和 https://a.com/x',
    '```\nprint("https://a.com")\n```',
    '![图](https://cdn.example.com/a_b.png "图注")',
  ]) assert.equal(cleanEditorMarkdown(text), text);
});
