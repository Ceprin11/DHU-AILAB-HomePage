// Brings the recruitment articles to one house style without touching what they say.
// Pure functions only (no Node APIs), so the same file runs in the tests and in the admin page.
//
//   normalizeDoc(body, config)  -> { body, report }
//   textSkeleton(body)          -> the text with all formatting, punctuation and numbering removed
//
// A document is only written back when textSkeleton() is identical before and after.

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export const toChinese = (value) => {
  if (value <= 10) return CN_DIGITS[value];
  if (value < 20) return `十${CN_DIGITS[value - 10]}`;
  if (value < 100) return `${CN_DIGITS[Math.floor(value / 10)]}十${value % 10 ? CN_DIGITS[value % 10] : ''}`;
  return String(value);
};

export const fromChinese = (text) => {
  if (text === '十') return 10;
  if (text.startsWith('十')) return 10 + CN_DIGITS.indexOf(text[1]);
  if (text.includes('十')) return CN_DIGITS.indexOf(text[0]) * 10 + (text.length > 2 ? CN_DIGITS.indexOf(text[2]) : 0);
  return CN_DIGITS.indexOf(text);
};

// Per-article settings. `renumber`: these articles number their chapters 0, 1, 2 ... and are moved to 一、二、三 ...;
// `levels`: headings whose level cannot be derived from their numbering; `keepClosingTitle`: leave the title as written.
export const DOC_CONFIG = {
  'GPT-2': { renumber: 1 },
  // "第 4 节讲 LLaVA" in the reading list is a section of someone else's lecture notes
  LLaVA: { renumber: 1, keepRefsIn: [/入门讲义/] },
  '实验室招新-Vit': {
    levels: { 模型架构图: 3, Vit的前向流程: 3, Vit与CNN的不同: 3, Vit的训练方法: 3, '题目一：图像分类': 3, '题目二：开放题': 3, 示例: 4, 最后: 4 },
  },
  '实验室招新-DINOv2': { keepClosingTitle: true },
};

const FENCE_LANGUAGES = {
  '': '', plain: 'text', 'plain text': 'text', plaintext: 'text', text: 'text', txt: 'text',
  python: 'python', py: 'python', markdown: 'markdown', md: 'markdown',
  bash: 'bash', sh: 'bash', shell: 'bash', zsh: 'bash', mermaid: 'mermaid',
};

const CLOSING_TITLE = /^招新(?:要求|任务与验收要求|要求与考核题目)$/;
const INTRO_LABEL = /^(?:写在前面|前言|引言|ps|PS)[：:]\s*/;
const CJK = '\\u4e00-\\u9fff';

const splitLines = (body) => {
  let fence = null;
  return String(body).replace(/\r\n/g, '\n').split('\n').map((text) => {
    const match = /^(\s*)(```|~~~)(.*)$/.exec(text);
    if (fence) {
      if (match && match[2] === fence && !match[3].trim()) { fence = null; return { text, code: true, fence: true }; }
      return { text, code: true };
    }
    if (match) { fence = match[2]; return { text, code: true, fence: true, open: true, indent: match[1], mark: match[2], lang: match[3].trim() }; }
    return { text, code: false };
  });
};

const count = (report, rule, amount = 1) => { report.rules[rule] = (report.rules[rule] || 0) + amount; };

// --- protected spans: text that must never be re-spaced or re-punctuated ---
const PROTECTED = [
  { re: /`[^`\n]*`/g, kind: 'code' },
  { re: /\$\$[^\n]*?\$\$|\$[^$\n]+\$/g, kind: 'code' },
  { re: /\]\([^)\n]*\)/g, kind: 'plain' },
  { re: /<[^>\n]+>/g, kind: 'plain' },
  { re: /https?:\/\/[^\s<>)\]，。；：、）】」》-]+/g, kind: 'plain', bare: true },
  { re: /&#?\w+;/g, kind: 'plain' },
];

const withProtected = (line, transform, patterns = PROTECTED) => {
  const saved = [];
  let masked = line;
  for (const { re, kind } of patterns) {
    masked = masked.replace(re, (span) => {
      saved.push(span);
      return kind === 'code' ? `\uE002${saved.length - 1}\uE003` : `\uE000${saved.length - 1}\uE001`;
    });
  }
  let restored = transform(masked);
  // a span can contain another one (a link text that holds an address), so restore until nothing is left
  for (let pass = 0; pass < 4 && /[\uE000\uE002]\d+[\uE001\uE003]/.test(restored); pass += 1) {
    restored = restored.replace(/[\uE000\uE002](\d+)[\uE001\uE003]/g, (_, index) => saved[Number(index)]);
  }
  return restored;
};

const FULL_WIDTH = { ',': '，', ';': '；', ':': '：', '!': '！', '?': '？' };

const respace = (line) => withProtected(line, (masked) => masked
  // a space between Chinese and Latin letters, digits, code or formulas
  .replace(new RegExp(`([${CJK}])([A-Za-z0-9\\uE002])`, 'g'), '$1 $2')
  .replace(new RegExp(`([A-Za-z0-9\\uE003])([${CJK}])`, 'g'), '$1 $2')
  // half-width punctuation that follows a Chinese character
  .replace(new RegExp(`([${CJK}）」』》])([,;:!?])`, 'g'), (_, before, mark) => `${before}${FULL_WIDTH[mark]}`)
  .replace(new RegExp(`([${CJK}])\\(([^()\\n]*)\\)`, 'g'), '$1（$2）'));

// A bare address becomes <address>; [address](address) too. Code, existing links and tags are left alone.
const URL_AFTER_TEXT = /(^|[^<(["'=\w/])(https?:\/\/[^\s<>)\]，。；：、）】」》\uE000-\uE005]+)/g;

const wrapBareUrls = (line) => withProtected(
  line.replace(/\[(https?:\/\/[^\]\s]+)\]\(\1\)/g, '<$1>'),
  (masked) => masked.replace(URL_AFTER_TEXT, (_, lead, url) => {
    const tail = url.match(/[.,;:!?'"]+$/)?.[0] || '';
    return `${lead}\uE004${tail ? url.slice(0, -tail.length) : url}\uE005${tail}`;
  }),
  PROTECTED.filter((pattern) => !pattern.bare),
).replace(/\uE004/g, '<').replace(/\uE005/g, '>');

// Formulas: $$x$$ inside a sentence is an inline formula; \_ is only an escape outside formulas; unbalanced braces are closed.
const balanceBraces = (expression) => {
  const plain = expression.replace(/\\[{}]/g, '');
  const open = (plain.match(/{/g) || []).length;
  const close = (plain.match(/}/g) || []).length;
  return open > close ? `${expression}${'}'.repeat(open - close)}` : expression;
};

const fixFormulas = (line, report) => {
  // "\dot" with nothing to put a dot on is a cut-off "\dots"
  const fix = (expression) => balanceBraces(expression.replace(/\\_/g, '_').replace(/\\\*/g, '*').replace(/\\dot\s*$/, '\\dots'));
  const saved = [];
  let text = line.replace(/`[^`\n]*`/g, (span) => { saved.push(span); return `\uE000${saved.length - 1}\uE001`; });
  const standalone = /^\s*\$\$[^$]+\$\$\s*$/.test(text);
  text = text.replace(/\$\$([^$\n]+?)\$\$/g, (_, expression) => (standalone ? `$$${fix(expression)}$$` : `$${fix(expression)}$`));
  text = text.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_, expression) => `$${fix(expression)}$`);
  text = text.replace(/\uE000(\d+)\uE001/g, (_, index) => saved[Number(index)]);
  if (text !== line) count(report, 'formulas');
  return text;
};

const parseHeading = (text) => {
  const match = /^(#{1,6})\s*(.*?)\s*#*\s*$/.exec(text);
  if (!match) return null;
  let title = match[2].replace(/^\*\*(.+)\*\*$/, '$1').trim();
  title = title.replace(/[：:]\s*$/, '').trim();
  const sub = /^(\d+)\.(\d+)(?:\.(\d+))?\s*[、.:：]?\s*(.*)$/.exec(title);
  if (sub) return { origLevel: match[1].length, kind: 'sub', numbers: [Number(sub[1]), Number(sub[2]), sub[3] === undefined ? null : Number(sub[3])], rest: sub[4], title };
  const arabic = /^(\d+)\s*[.、]\s*(.*)$/.exec(title);
  if (arabic) return { origLevel: match[1].length, kind: 'chapter', number: Number(arabic[1]), rest: arabic[2], title };
  const chinese = /^([一二三四五六七八九十]+)\s*[、：:．.]\s*(.*)$/.exec(title);
  if (chinese) return { origLevel: match[1].length, kind: 'chapter', number: fromChinese(chinese[1]), rest: chinese[2], title };
  return { origLevel: match[1].length, kind: 'plain', rest: title, title };
};

export const outline = (body) => splitLines(body)
  .filter((line) => !line.code && /^#{1,6}\s/.test(line.text))
  .map((line) => `${line.text.match(/^#+/)[0].length}|${line.text.replace(/^#+\s*/, '')}`);

export const normalizeDoc = (input, config = {}) => {
  const report = { rules: {}, refs: [], joined: [], warnings: [] };
  const offset = config.renumber || 0;
  let lines = splitLines(input);

  // 1. code fences: one spelling per language
  lines = lines.map((line) => {
    if (!line.open) return line;
    const language = FENCE_LANGUAGES[line.lang.toLowerCase()] ?? line.lang.toLowerCase();
    if (language === line.lang) return line;
    count(report, 'fence-language');
    return { ...line, text: `${line.indent}${line.mark}${language}`, lang: language };
  });

  // 2. leftovers of the export: entities, line breaks, empty list items, rules between sections
  let inMath = false;
  lines = lines.flatMap((line, index) => {
    if (line.code) return [line];
    let text = line.text;
    if (/^\s*\$\$\s*$/.test(text)) inMath = !inMath;
    if (inMath) return [line];
    if (/&#x20;|&nbsp;/.test(text)) { text = text.replace(/&#x20;|&nbsp;/g, ' ').replace(/^\s+(?=\S)/, (lead) => (line.text.startsWith('&') ? '' : lead)); count(report, 'entities'); }
    if (/^\s*(?:[*+-]|\d+\.)?\s*>?\s*<br\s*\/?>\s*$/.test(text)) {
      count(report, 'line-breaks');
      return /^\s*>/.test(text) ? [{ text: '>', code: false, quoteGap: true }] : [];
    }
    if (/^\s*(?:[*+-]|\d+\.)\s*$/.test(text)) { count(report, 'empty-items'); return []; }
    const rule = /^\s*([*_-])(?:\s*\1){2,}\s*$/.exec(text);
    if (rule && (rule[1] !== '-' || index === 0 || !lines[index - 1].text.trim())) { count(report, 'rules'); return []; }
    return [{ ...line, text }];
  });

  // a quote made only of line breaks leaves lone ">" lines: keep one between paragraphs, drop the others
  lines = lines.filter((line, index, all) => {
    if (!line.quoteGap) return true;
    const before = all[index - 1]?.text.trim() ?? '';
    const after = all[index + 1]?.text.trim() ?? '';
    return before.startsWith('>') && before !== '>' && after.startsWith('>') && after !== '>';
  });

  // 3. formulas, links, references
  lines = lines.map((line) => {
    if (line.code || line.fence) return line;
    let text = line.text;
    if (text.includes('$')) text = fixFormulas(text, report);
    const wrapped = wrapBareUrls(text);
    if (wrapped !== text) { count(report, 'links'); text = wrapped; }
    // references to chapters ("第 3 节") and sections ("4.2 节") follow the renumbering, except those that point outside the article
    if (!config.keepRefsIn?.some((pattern) => pattern.test(text))) {
      text = text.replace(/第\s*(\d+)\s*(节|章|部分)/g, (whole, digits, unit) => {
        const next = `第${toChinese(Number(digits) + offset)}${unit}`;
        report.refs.push(`${whole.replace(/\s+/g, '')} → ${next}`);
        return next;
      });
      if (offset) {
        text = text.replace(/(?<![\d.])(\d+)\.(\d+)(\s*节)/g, (whole, major, minor, unit) => {
          const next = `${Number(major) + offset}.${minor}${unit}`;
          report.refs.push(`${whole.replace(/\s+/g, '')} → ${next.replace(/\s+/g, '')}`);
          return next;
        });
      }
    }
    return { ...line, text };
  });

  // 4. the introduction: one heading "写在前面", whatever it was called or however it started
  const firstChapter = lines.findIndex((line) => {
    if (line.code) return false;
    const heading = /^#{1,6}\s/.test(line.text) ? parseHeading(line.text) : null;
    return heading?.kind === 'chapter';
  });
  const introEnd = firstChapter < 0 ? lines.length : firstChapter;
  let hasIntro = false;
  const intro = [{ text: '## 写在前面', code: false }];
  lines = lines.flatMap((line, index) => {
    if (line.code || index >= introEnd) return [line];
    const heading = /^#{1,6}\s/.test(line.text) ? parseHeading(line.text) : null;
    if (heading?.kind === 'plain' && /^(?:写在前面|前言)$/.test(heading.rest)) { hasIntro = true; return intro; }
    if (!hasIntro && /^\*\*(?:写在前面|前言)[：:]?\*\*\s*$/.test(line.text)) { hasIntro = true; count(report, 'intro'); return intro; }
    const lead = INTRO_LABEL.exec(line.text);
    if (lead && !hasIntro && !/^\s*[*>-]/.test(line.text)) {
      hasIntro = true;
      count(report, 'intro');
      const rest = line.text.slice(lead[0].length).trim();
      return rest ? [...intro, { text: '', code: false }, { text: rest, code: false }] : intro;
    }
    return [line];
  });

  // 5. headings: one title, chapters 一、, sections 1.1, no skipped levels
  let anchor = null;
  let previousLevel = 1;
  let titleSeen = false;
  const headings = [];
  lines = lines.map((line, index) => {
    if (line.code || !/^#{1,6}\s/.test(line.text)) return line;
    const parsed = parseHeading(line.text);
    if (!titleSeen && parsed.origLevel === 1) { titleSeen = true; headings.push(index); return line; }
    let level;
    let text = parsed.rest;
    if (config.levels?.[parsed.title]) level = config.levels[parsed.title];
    else if (parsed.kind === 'chapter') level = 2;
    else if (parsed.kind === 'sub') level = parsed.numbers[2] === null ? 3 : 4;
    else level = anchor ? parsed.origLevel + (anchor.next - anchor.orig) : 2;
    level = Math.max(2, Math.min(level, previousLevel + 1, 4));
    if (parsed.kind === 'chapter') {
      if (!config.keepClosingTitle && CLOSING_TITLE.test(text)) { text = '招新题目'; count(report, 'closing-title'); }
      text = `${toChinese(parsed.number + offset)}、${text}`;
    } else if (parsed.kind === 'sub') {
      const [major, minor, patch] = parsed.numbers;
      text = `${major + offset}.${minor}${patch === null ? '' : `.${patch}`} ${text}`;
    }
    if (parsed.kind === 'chapter' || parsed.kind === 'sub') anchor = { orig: parsed.origLevel, next: level };
    previousLevel = level;
    const next = `${'#'.repeat(level)} ${text}`;
    if (next !== line.text) count(report, 'headings');
    return { ...line, text: next };
  });

  // a heading that was cut in two ("…对应关" / "系"): put it back together
  for (let index = lines.length - 1; index > 0; index -= 1) {
    const line = lines[index];
    // only a lone character can be the cut-off end of a heading ("…对应关" + "系"); "示例" or "最后" are real headings
    if (line.code || !/^#{2,6}\s+[一-鿿]$/.test(line.text)) continue;
    // a picture pasted into the middle of the heading may sit between the two halves; it stays below the joined heading
    let previous = index - 1;
    while (previous >= 0 && (!lines[previous].text.trim() || (!lines[previous].code && /^!\[/.test(lines[previous].text.trim())))) previous -= 1;
    if (previous < 0 || lines[previous].code || !/^#{2,6}\s/.test(lines[previous].text) || /[。？！：:）)]\s*$/.test(lines[previous].text)) continue;
    report.joined.push(`${lines[previous].text} + ${line.text.replace(/^#+\s*/, '')}`);
    lines[previous] = { ...lines[previous], text: `${lines[previous].text}${line.text.replace(/^#+\s*/, '')}` };
    lines.splice(index, 1);
  }

  // 6. whole-line bold sentences become quotes (the style the other articles already use for key points)
  lines = lines.map((line) => {
    if (line.code) return line;
    const match = /^\*\*([^*\n]+)\*\*\s*$/.exec(line.text);
    if (!match || !/[。？！.?!]$/.test(match[1])) return line;
    count(report, 'callouts');
    return { ...line, text: `> ${match[1]}` };
  });

  // 7. spacing between Chinese and Latin text, and full-width punctuation after Chinese
  inMath = false;
  lines = lines.map((line) => {
    if (line.code) return line;
    if (/^\s*\$\$\s*$/.test(line.text)) { inMath = !inMath; return line; }
    if (inMath || /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line.text)) return line;
    const text = respace(line.text);
    if (text !== line.text) count(report, 'spacing');
    return { ...line, text };
  });

  // 8. tidy: a blank line around every heading and no runs of blank lines outside code
  const out = [];
  const push = (text, code) => {
    if (!code && !text.trim() && out.length && !out[out.length - 1].text.trim() && !out[out.length - 1].code) return;
    out.push({ text, code });
  };
  lines.forEach((line, index) => {
    const isHeading = !line.code && /^#{1,6}\s/.test(line.text);
    if (isHeading && out.length && out[out.length - 1].text.trim()) push('', false);
    push(line.text, line.code);
    if (isHeading && lines[index + 1] && lines[index + 1].text.trim()) push('', false);
  });
  const body = `${out.map((line) => line.text).join('\n').replace(/\s+$/, '')}\n`;
  return { body, report };
};

// The pictures of an article, in order of appearance (compared separately: a picture is not prose).
export const imageList = (body) => [...String(body).replace(/^(```|~~~)[\s\S]*?^\1/gm, '').matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)].map((match) => match[1]).sort();

// What the article says, with everything that is only form removed. Equal skeletons mean equal content.
export const textSkeleton = (body) => String(body)
  .replace(/\r\n/g, '\n')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .split('\n')
  .filter((line) => !/^\s*(```|~~~)/.test(line))
  .map((line) => (/^#{1,6}\s/.test(line)
    ? line.replace(/^#+\s*/, '').replace(/^(?:[一二三四五六七八九十]+\s*[、：:．.]|\d+(?:\.\d+)*\s*[、.:：]?)\s*/, '')
    : line))
  .join('\n')
  .replace(/^\s*(?:[*+-]|\d+\.)\s*(?:<br\s*\/?>)?\s*$/gm, '')
  .replace(/第\s*[0-9一二三四五六七八九十]+\s*(?:节|章|部分)/g, '')
  .replace(/(?<![\d.])\d+\.\d+\s*节/g, '')
  .replace(/\\dots/g, '\\dot')
  .replace(/招新(?:要求与考核题目|任务与验收要求|要求|题目)/g, '')
  .replace(/写在前面|前言|引言|\bps[：:]/gi, '')
  .replace(/&#x20;|&nbsp;|<br\s*\/?>/g, '')
  .replace(/[\p{P}\p{S}\s]/gu, '')
  .toLowerCase();
