const FILE_EXTENSIONS = /\.(?:pdf|zip|gz|rar|7z|docx?|pptx?|xlsx?|txt|md|csv|json|py|ipynb)(?:$|[?#])/i;

export const getYouTubeVideoId = (value = '') => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return '';
    if (url.pathname === '/watch') return url.searchParams.get('v') || '';
    return url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] || '';
  } catch { return ''; }
};

export const getResourceKind = (value = '', fileType = '') => {
  const input = String(value).trim();
  if (/BV[0-9A-Za-z]{10}/i.test(input) || getYouTubeVideoId(input)) return 'video';
  try {
    const url = new URL(input, window.location.origin);
    const host = url.hostname.toLowerCase();
    if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
    if (url.origin !== window.location.origin && !FILE_EXTENSIONS.test(url.pathname)) return 'external';
  } catch { /* Relative uploaded files are handled below. */ }
  return fileType === 'video' ? 'video' : 'file';
};

export const getResourceAction = (value = '', fileType = '') => getResourceKind(value, fileType) === 'file' ? 'download' : 'visit';

export const getAutomaticResourceThumbnail = (value = '') => {
  const youtubeId = getYouTubeVideoId(value);
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== 'github.com') return '';
    const [owner, repository] = url.pathname.split('/').filter(Boolean);
    if (!owner || !repository) return '';
    return `https://opengraph.githubassets.com/1/${encodeURIComponent(owner)}/${encodeURIComponent(repository.replace(/\.git$/i, ''))}`;
  } catch { return ''; }
};

export const getResourceThumbnailSource = (value = '') => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === 'opengraph.githubassets.com' || host === 'i.ytimg.com' || host === 'img.youtube.com' || host.endsWith('.hdslb.com') || host.endsWith('.biliimg.com')) {
      return `/api/resource/cover?${new URLSearchParams({ url: url.href })}`;
    }
  } catch { /* Local upload paths are intentionally returned unchanged. */ }
  return value;
};

export const getFileLabel = (value = '', fileType = '') => {
  const match = String(value).split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i);
  return (match?.[1] || fileType || 'FILE').toUpperCase();
};
