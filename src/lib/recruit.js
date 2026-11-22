const previewQuery = (preview) => (preview ? '?preview=1' : '');

export const recruitSectionPath = (cohort, section, { preview = false } = {}) => `/recruit/${encodeURIComponent(cohort)}/${section}${previewQuery(preview)}`;

// [{ name: '', pages }, { name: 'CV', pages }, ...] — the pages arrive already ordered, so this only cuts them into blocks.
export const sectionPages = (pages) => {
  const sections = [];
  for (const page of pages) {
    const last = sections[sections.length - 1];
    if (last && last.name === (page.group || '')) last.pages.push(page);
    else sections.push({ name: page.group || '', pages: [page] });
  }
  return sections;
};

export const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const formatBeijingTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// Mirrors server/recruit-submissions.js so applicants can see the name their file will get.
// eslint-disable-next-line no-control-regex
const FILE_NAME_FORBIDDEN = /[\\/:*?"<>|\s\u0000-\u001f\u007f.]+/g;
const fileNamePart = (value) => String(value || '').replace(FILE_NAME_FORBIDDEN, '').slice(0, 20);

export const previewFileName = ({ direction, name, student_id: studentId, grade, major }, extension) => (
  `${[direction, name, studentId, grade, major].map(fileNamePart).filter(Boolean).join('_')}_v?${extension}`
);

export const submissionFileUrl = (id, { download = false } = {}) => (
  `/api/recruit/submissions/${encodeURIComponent(id)}/file${download ? '?download=1' : ''}`
);

export const submissionAttachmentUrl = (id) => `/api/recruit/submissions/${encodeURIComponent(id)}/attachment`;

// Splits a cohort's directions into its field groups (CV / NLP / ...). Directions that belong to no group come last.
export const groupDirections = (directions = [], groups = []) => {
  const claimed = new Set(groups.flatMap((group) => group.directions));
  const sections = groups
    .map((group) => ({ name: group.name, directions: group.directions.filter((direction) => directions.includes(direction)) }))
    .filter((section) => section.directions.length > 0);
  const rest = directions.filter((direction) => !claimed.has(direction));
  return rest.length ? [...sections, { name: '', directions: rest }] : sections;
};

export const fieldOfDirection = (groups = [], direction) => groups.find((group) => group.directions.includes(direction))?.name || '';

// Puts the paper groups of the submissions list under their field: [{ name: 'CV', groups: [paper, ...] }, ...].
export const sectionSubmissionGroups = (paperGroups, groups = []) => {
  const fieldOf = (direction) => fieldOfDirection(groups, direction);
  const sections = [];
  for (const name of [...groups.map((group) => group.name), '']) {
    const members = paperGroups.filter((paper) => fieldOf(paper.direction) === name);
    if (members.length) sections.push({ name, groups: members });
  }
  return sections;
};

// One entry per applicant. Until the paper choice is locked a student may switch papers, so the newest submission decides
// which paper they are listed under; their earlier submissions (also of other papers) stay available as versions.
export const groupSubmissions = (rows, directionOrder = []) => {
  const people = new Map();
  for (const row of rows) {
    const key = String(row.student_id).toLowerCase();
    const person = people.get(key) || { key, versions: [] };
    person.versions.push(row);
    people.set(key, person);
  }
  for (const person of people.values()) {
    person.versions.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.version - a.version);
    person.latest = person.versions[0];
    Object.assign(person, { direction: person.latest.direction, name: person.latest.name, student_id: person.latest.student_id, grade: person.latest.grade, major: person.latest.major });
    person.switchedPaper = new Set(person.versions.map((version) => version.direction)).size > 1;
  }
  const byDirection = new Map();
  for (const person of people.values()) byDirection.set(person.direction, [...(byDirection.get(person.direction) || []), person]);
  const known = directionOrder.filter((direction) => byDirection.has(direction));
  const others = [...byDirection.keys()].filter((direction) => !directionOrder.includes(direction)).sort();
  return {
    people: [...people.values()],
    groups: [...known, ...others].map((direction) => ({
      direction,
      people: byDirection.get(direction).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN') || a.student_id.localeCompare(b.student_id)),
    })),
  };
};

export const IMAGE_EXTENSIONS_BY_TYPE = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/avif': '.avif' };

const beijingStamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(/[-: ]/g, '');

// Clipboard screenshots are all called "image.png"; give them a unique readable name.
export const nameUploadedFile = (file, index = 0, total = 1) => {
  if (file.name && !/^image\.\w+$/i.test(file.name)) return file;
  const suffix = total > 1 ? `-${index + 1}` : '';
  return new File([file], `粘贴图片-${beijingStamp()}${suffix}${IMAGE_EXTENSIONS_BY_TYPE[file.type] || ''}`, { type: file.type });
};

// The visual editor keeps a resize ratio in the alt slot and a caption in the title. Moving a lone image's
// description into the caption keeps it from being thrown away the first time a document is edited.
export const altToCaption = (markdown) => {
  let inFence = false;
  return String(markdown).split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    return line.replace(/^(\s*)!\[([^\]\n]+)\]\(([^)\s]+)\)(\s*)$/, (match, lead, alt, url, trail) => (
      /^\d+(\.\d+)?$/.test(alt) ? match : `${lead}![1.00](${url} "${alt.replace(/"/g, '\\"')}")${trail}`
    ));
  }).join('\n');
};

// Tidies what the visual editor serializes before it is stored.
export const cleanEditorMarkdown = (markdown) => String(markdown)
  // Empty paragraphs come out as a lone <br />; they only add noise.
  .replace(/^[ \t]*<br\s*\/?>[ \t]*\n+/gm, '')
  .replace(/\n+[ \t]*<br\s*\/?>[ \t]*$/g, '\n')
  // A pasted bare URL is stored escaped (https\://…\_…), which stops it from being a link: make it an explicit autolink.
  .replace(/https?\\?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%\\]+/g, (url) => (url.includes('\\') ? `<${url.replace(/\\([_:*~])/g, '$1')}>` : url))
  .replace(/\n{2,}$/, '\n');
