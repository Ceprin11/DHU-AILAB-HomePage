import assert from 'node:assert/strict';
import test from 'node:test';
import { DOC_CONFIG, imageList, normalizeDoc, outline, textSkeleton, toChinese } from '../tools/doc-format.js';

const run = (body, config = {}) => normalizeDoc(body, config);
const same = (before, after) => assert.equal(textSkeleton(after), textSkeleton(before), 'the text must not change');

test('numbers in Chinese', () => {
  assert.deepEqual([1, 9, 10, 11, 13, 20].map(toChinese), ['一', '九', '十', '十一', '十三', '二十']);
});

test('code fences get one spelling per language and their content is never touched', () => {
  const before = '# 标题\n\n```Plain Text\n中文abc,  keep(this)\n\n\n\nx\n```\n\n```Python\nprint("你好world")\n```\n\n```\nno language\n```\n';
  const { body } = run(before);
  assert.match(body, /```text\n中文abc, {2}keep\(this\)\n\n\n\nx\n```/);
  assert.match(body, /```python\nprint\("你好world"\)\n```/);
  assert.match(body, /```\nno language\n```/);
  assert.equal(run('```Markdown\n# x\n```\n').body, '```markdown\n# x\n```\n');
  assert.equal(run('```mermaid\nflowchart LR\n```\n').body, '```mermaid\nflowchart LR\n```\n');
});

test('adds a space between Chinese and Latin text and uses full-width punctuation after Chinese', () => {
  const { body, report } = run('# T\n\n中文English混排，共有3个。背景(background)的说明,另一个例子:好。\n');
  assert.match(body, /中文 English 混排，共有 3 个。/);
  assert.match(body, /背景（background）的说明，另一个例子：好。/);
  assert.ok(report.rules.spacing >= 1);
});

test('leaves code, addresses, link targets, formulas and image paths alone', () => {
  const before = '# T\n\n用`pip install 包abc`安装，见[文档abc](assets/中文abc.png)和<https://a.com/中文>以及$x_{中a}$。\n';
  const { body } = run(before);
  assert.match(body, /用 `pip install 包abc` 安装/);
  assert.match(body, /\[文档 abc\]\(assets\/中文abc\.png\)/);
  assert.match(body, /<https:\/\/a\.com\/中文>/);
  assert.match(body, /\$x_\{中a\}\$/);
});

test('turns bare addresses into <address> links without touching existing links', () => {
  const { body } = run('# T\n\n网址 https://a.com/x?y=1，另见 <https://b.com> 和 [说明](https://c.com) 以及 [https://d.com](https://d.com)。官网：https://e.com.\n');
  assert.match(body, /网址 <https:\/\/a\.com\/x\?y=1>，/);
  assert.match(body, /<https:\/\/b\.com>/);
  assert.match(body, /\[说明\]\(https:\/\/c\.com\)/);
  assert.match(body, /以及 <https:\/\/d\.com>。/);
  assert.match(body, /官网：<https:\/\/e\.com>\.\n/);
});

test('chapters at the top level move down, sections follow their numbering, no level is skipped', () => {
  const before = [
    '# 实验室招新——X', '', '## 写在前面', '', '一、第一章', '', '', '# 一、要解决什么问题？', '', '## 1.1 小节', '', '### 1.1.1 细节', '',
    '# 二：架构', '', '## 2.1 小节', '', '### 2.2 小节（原来是三级）', '', '## 2.3 小节', '', '### 问题一：无编号', '', '# 三、招新题目：', '', '### 题目一：分类', '',
  ].join('\n');
  const { body } = run(before);
  assert.deepEqual(outline(body), [
    '1|实验室招新——X', '2|写在前面', '2|一、要解决什么问题？', '3|1.1 小节', '4|1.1.1 细节', '2|二、架构', '3|2.1 小节', '3|2.2 小节（原来是三级）', '3|2.3 小节',
    '4|问题一：无编号', '2|三、招新题目', '3|题目一：分类',
  ]);
  same(before, body);
});

test('headings that cannot be derived from numbering use the configured level', () => {
  const before = '# T\n\n## 二、模型讲解\n\n#### 模型架构图\n\n#### Vit的前向流程\n\n### Vit与CNN的不同\n\n#### Vit的训练方法\n\n## 三、招新题目\n\n#### 题目一：图像分类\n\n#### 示例\n';
  const { body } = run(before, DOC_CONFIG['实验室招新-Vit']);
  assert.deepEqual(outline(body), ['1|T', '2|二、模型讲解', '3|模型架构图', '3|Vit 的前向流程', '3|Vit 与 CNN 的不同', '3|Vit 的训练方法', '2|三、招新题目', '3|题目一：图像分类', '4|示例']);
});

test('articles numbered 0, 1, 2 ... are renumbered with Chinese chapters and their references follow', () => {
  const before = '# T\n\n这篇文档分两部分。第 0 节说明观点；第 3 节讲主干，详见第 5 部分。\n\n## 0. 论文讲了什么\n\n## 1. 整体结构\n\n## 3. 主干\n\n### 3.1 Embedding\n\n### 3.2 Block\n\n## 12. 招新要求\n';
  const { body, report } = run(before, DOC_CONFIG['GPT-2']);
  assert.deepEqual(outline(body), ['1|T', '2|一、论文讲了什么', '2|二、整体结构', '2|四、主干', '3|4.1 Embedding', '3|4.2 Block', '2|十三、招新题目']);
  assert.match(body, /第一节说明观点；第四节讲主干，详见第六部分。/);
  assert.deepEqual(report.refs, ['第0节 → 第一节', '第3节 → 第四节', '第5部分 → 第六部分']);
  same(before, body);
});

test('the closing chapter is called 招新题目 unless the article keeps its own title', () => {
  const before = '# T\n\n## 十、招新要求：\n\n## 八、招新任务与验收要求\n\n## 十、招新要求与考核题目\n';
  assert.deepEqual(outline(run(before).body), ['1|T', '2|十、招新题目', '2|八、招新题目', '2|十、招新题目']);
  const kept = run('# T\n\n## 十一、招新题目：VOC-20 图像分类\n\n## 十三、招新要求\n', DOC_CONFIG['实验室招新-DINOv2']);
  assert.deepEqual(outline(kept.body), ['1|T', '2|十一、招新题目：VOC-20 图像分类', '2|十三、招新要求']);
});

test('the introduction becomes one 写在前面 heading, however it was written', () => {
  const leadInput = '# T\n\n* paper title：x\n\n写在前面：这篇文章讲 bert。\n\n## 一、问题\n';
  const lead = run(leadInput);
  assert.deepEqual(outline(lead.body), ['1|T', '2|写在前面', '2|一、问题']);
  assert.match(lead.body, /## 写在前面\n\n这篇文章讲 bert。\n\n## 一、问题/);
  assert.match(run('# T\n\nps：ConvNeXt 是 22 年发表的。\n\n## 一、问题\n').body, /## 写在前面\n\nConvNeXt 是 22 年发表的。/);
  assert.deepEqual(outline(run('# T\n\n**前言：**\n\n正文。\n\n## 一、问题\n').body), ['1|T', '2|写在前面', '2|一、问题']);
  assert.deepEqual(outline(run('# T\n\n## 前言\n\n正文\n\n## 一、问题\n').body), ['1|T', '2|写在前面', '2|一、问题']);
  assert.deepEqual(outline(run('# T\n\n## 写在前面\n\n写在前面：不应再变一次。\n\n## 一、问题\n').body), ['1|T', '2|写在前面', '2|一、问题']);
  same(leadInput, lead.body);
});

test('whole-line bold sentences become quotes, bold labels stay', () => {
  const { body, report } = run('# T\n\n**CLIP 的优势是能够高效地进行图文对齐和检索。**\n\n**（1）MED：Multimodal Mixture of Encoder-Decoder**\n\n**问题：**\n\n**为什么不能共享一个模型？**\n');
  assert.match(body, /> CLIP 的优势是能够高效地进行图文对齐和检索。/);
  assert.match(body, /\*\*（1）MED：Multimodal Mixture of Encoder-Decoder\*\*/);
  assert.match(body, /\*\*问题：\*\*/);
  assert.match(body, /> 为什么不能共享一个模型？/);
  assert.equal(report.rules.callouts, 2);
});

test('removes line breaks, empty items, rules and entities left over from the export', () => {
  const before = '# T\n\n* 要点一\n  * <br />\n* 要点二\n*\n\n***\n\n> 引用\n> <br />\n> 继续\n\n---\n\n行首&#x20;空格\n';
  const { body, report } = run(before);
  assert.equal(/<br/.test(body), false);
  assert.equal(/^\*{3}$|^-{3}$/m.test(body), false);
  assert.match(body, /\* 要点一\n\* 要点二\n/);
  assert.match(body, /> 引用\n>\n> 继续/);
  assert.match(body, /行首 空格/);
  assert.ok(report.rules['line-breaks'] >= 2 && report.rules.rules === 2);
  same(before, body);
});

test('a line of dashes under a paragraph is a heading underline, not a rule', () => {
  assert.match(run('# T\n\n标题\n---\n').body, /标题\n---/);
});

test('formulas: $$ inside a sentence becomes inline, escapes and unbalanced braces are repaired, blocks stay', () => {
  const before = [
    '# T', '', '| 版本 | Hidden Size ($$d\\_{model$$) |', '| --- | --- |', '', '注意力分数（$$\\text{Score} = QK^T / \\sqrt{d\\_k$$）时。', '',
    '$$\\mathrm{mIoU}=\\frac{1}{C}\\sum\\_{c=1}^{C}\\mathrm{IoU}\\_c$$', '', '$$', 'a\\_b = \\frac{1}{2}', '$$', '', '行内 $\\mathrm{IoU}=\\frac{TP}{TP+FP}$ 不变。', '',
  ].join('\n');
  const { body, report } = run(before);
  assert.match(body, /Hidden Size \(\$d_\{model\}\$\)/);
  assert.match(body, /注意力分数（\$\\text\{Score\} = QK\^T \/ \\sqrt\{d_k\}\$）时/);
  assert.match(body, /^\$\$\\mathrm\{mIoU\}=\\frac\{1\}\{C\}\\sum_\{c=1\}\^\{C\}\\mathrm\{IoU\}_c\$\$$/m);
  assert.match(body, /\$\$\na\\_b = \\frac\{1\}\{2\}\n\$\$/);
  assert.match(body, /行内 \$\\mathrm\{IoU\}=\\frac\{TP\}\{TP\+FP\}\$ 不变/);
  assert.ok(report.rules.formulas >= 3);
});

test('a heading that was cut in two is put back together', () => {
  const before = '# T\n\n## 一、问题\n\n### 1.2 小节\n\n#### 1.2.1 CLIP：学习图像和文本之间的对应关\n\n#### 系\n\n正文。\n\n#### 示例\n\n正文\n';
  const { body, report } = run(before);
  assert.deepEqual(outline(body), ['1|T', '2|一、问题', '3|1.2 小节', '4|1.2.1 CLIP：学习图像和文本之间的对应关系', '4|示例']);
  assert.equal(report.joined.length, 1);
  same(before, body);
});

test('normalizing twice changes nothing more', () => {
  const before = '# T\n\n写在前面：中文English混排(见下)。\n\n# 一、章节\n\n## 1.1 小节\n\n正文 https://a.com 结束\n\n**这是一个要点句子。**\n\n```Python\nx = 1\n```\n';
  const once = run(before).body;
  assert.equal(run(once).body, once);
});

test('the text skeleton ignores form but not words', () => {
  assert.equal(textSkeleton('## 一、BERT 要解决什么？\n\n中文 English，很好。'), textSkeleton('# 1.1 BERT要解决什么\n\n中文English,很好'));
  assert.notEqual(textSkeleton('这篇文章讲 BERT'), textSkeleton('这篇文章讲 GPT'));
  assert.notEqual(textSkeleton('共 12 层'), textSkeleton('共 24 层'));
});

test('a link whose text is an address and whose target has parameters stays intact', () => {
  const line = '可以看一下CLIP那篇论文[https://arxiv.org/abs/2103.00020](https://arxiv.org/abs/2103.00020?utm_source=chatgpt.com)';
  const { body } = run(`# T\n\n${line}\n`);
  assert.match(body, /看一下 CLIP 那篇论文\[https:\/\/arxiv\.org\/abs\/2103\.00020\]\(https:\/\/arxiv\.org\/abs\/2103\.00020\?utm_source=chatgpt\.com\)/);
  assert.equal(/[\uE000-\uE005]/.test(body), false);
});

test('an empty numbered item left by the export is removed and does not count as text', () => {
  const before = '# T\n\n3. 第三点。\n   1. <br />\n\n***\n\n## 一、章节\n';
  const { body } = run(before);
  assert.equal(/<br/.test(body), false);
  same(before, body);
});

test('a heading cut in two by a picture is joined and the picture stays below it', () => {
  const before = '# T\n\n## 一、问题\n\n### 1.1 小节\n\n#### 1.1.1 CLIP：学习图像和文本之间的对应关\n\n![1.00](assets/a.png)\n\n#### 系\n\n正文。\n';
  const { body } = run(before);
  assert.deepEqual(outline(body), ['1|T', '2|一、问题', '3|1.1 小节', '4|1.1.1 CLIP：学习图像和文本之间的对应关系']);
  assert.match(body, /对应关系\n\n!\[1\.00\]\(assets\/a\.png\)\n\n正文。/);
  same(before, body);
});

test('section references ("4.2 节") follow the renumbering, references to other material do not', () => {
  const before = '# T\n\n## 2. 分词器\n\n### 4.2 任务头\n\n设置 pad token（见第 2 节和 4.2 节）。\n\n入门讲义，第 4 节讲它。\n';
  const { body, report } = run(before, { renumber: 1, keepRefsIn: [/入门讲义/] });
  assert.match(body, /（见第三节和 5\.2 节）。\n\n入门讲义，第 4 节讲它。/);
  assert.deepEqual(report.refs, ['第2节 → 第三节', '4.2节 → 5.2节']);
  const kept = run('# T\n\n入门讲义，第 4 节讲它。\n', { renumber: 1, keepRefsIn: [/入门讲义/] });
  assert.match(kept.body, /第 4 节讲它/);
});

test('a formula that ends in a cut-off \\dots is completed', () => {
  assert.match(run('# T\n\n相距 $$-2, -1, 0, +1, +2 \\dot$$ 的词。\n').body, /\$-2, -1, 0, \+1, \+2 \\dots\$/);
});

test('pictures are compared separately from the text, so none can be lost or added', () => {
  const before = '# T\n\n![1.00](assets/a.png "图注")\n\n正文\n\n![1.00](assets/b.png)\n';
  assert.deepEqual(imageList(before), ['assets/a.png', 'assets/b.png']);
  assert.deepEqual(imageList(run(before).body), imageList(before));
  assert.equal(textSkeleton(before), textSkeleton('# T\n\n正文\n'));
});

test('the text skeleton treats a renamed closing chapter and a completed \\dots as the same text', () => {
  const before = '## 十、招新要求与考核题目\n\n相距 $$+2 \\dot$$ 的词。\n';
  const after = run(before).body;
  assert.match(after, /## 十、招新题目/);
  assert.equal(textSkeleton(after), textSkeleton(before));
});
