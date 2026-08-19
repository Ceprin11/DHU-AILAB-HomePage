const HEADER_ALIASES = {
  account: ['学号', '工号', '学号或工号', '账号', 'account', 'studentid', 'student_id'],
  name: ['姓名', '名字', 'name'],
  grade: ['年级', 'grade'],
};

const normalizeHeader = (value = '') => String(value).trim().toLowerCase().replace(/[\s_-]/g, '');

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if ((character === ',' || character === '\t') && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  cells.push(value.trim());
  return cells;
}

function splitCombinedMember(value) {
  const match = String(value || '').trim().match(/^([A-Za-z0-9_-]{4,64})\s*[-—–：:]\s*(.+)$/);
  return match ? { account: match[1].trim(), name: match[2].trim() } : null;
}

function findHeaderIndex(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

export function parseMemberCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error('CSV 文件中没有可导入的内容');
  const table = lines.map(parseCsvLine);
  const headers = table[0];
  const accountIndex = findHeaderIndex(headers, HEADER_ALIASES.account);
  const nameIndex = findHeaderIndex(headers, HEADER_ALIASES.name);
  const gradeIndex = findHeaderIndex(headers, HEADER_ALIASES.grade);
  const hasHeader = accountIndex >= 0 || nameIndex >= 0 || gradeIndex >= 0;
  const rows = hasHeader ? table.slice(1) : table;

  return rows.map((cells) => {
    const combined = splitCombinedMember(cells.length === 1 ? cells[0] : '');
    if (combined) return { ...combined, grade: combined.account.slice(0, 2) };
    const account = cells[accountIndex >= 0 ? accountIndex : 0] || '';
    const name = cells[nameIndex >= 0 ? nameIndex : 1] || '';
    const grade = cells[gradeIndex >= 0 ? gradeIndex : -1] || account.slice(0, 2);
    return { account: account.trim(), name: name.trim(), grade: grade.trim() };
  }).filter((row) => row.account || row.name);
}
