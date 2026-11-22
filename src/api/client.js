// Large uploads (a report plus a code zip of up to 100MB) on slow dorm or phone networks can take many minutes,
// so this uses XMLHttpRequest for upload progress and only gives up when the connection stalls.
function uploadWithProgress(url, formData, { onProgress, stallMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stallTimer = null;
    const armStall = () => {
      window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => xhr.abort(), stallMs);
    };
    xhr.open('POST', url);
    xhr.responseType = 'text';
    xhr.upload.onprogress = (event) => {
      armStall();
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.upload.onload = () => { window.clearTimeout(stallTimer); stallTimer = window.setTimeout(() => xhr.abort(), 10 * 60 * 1000); };
    xhr.onload = () => {
      window.clearTimeout(stallTimer);
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { data = {}; }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      const fallback = xhr.status === 413 ? '文件太大，请压缩后重试' : xhr.status === 429 ? '现在访问的人比较多，提交没有完成，请稍等几秒再提交' : '提交失败，请稍后重试';
      const error = new Error(data.message || fallback);
      error.status = xhr.status;
      reject(error);
    };
    xhr.onerror = () => { window.clearTimeout(stallTimer); reject(new Error('网络中断，提交没有完成，请检查网络后重新提交')); };
    xhr.onabort = () => { window.clearTimeout(stallTimer); reject(new Error('上传长时间没有进展，已停止。请换一个更稳定的网络后重新提交')); };
    armStall();
    xhr.send(formData);
  });
}

// The reverse proxy in front of the site answers 429 (with no JSON body) when one network sends many requests at
// once, for example a whole dorm opening the recruitment page together. Those requests never reached the site, so
// they are safe to send again after a short wait. A 429 from the site itself (too many logins, registrations or
// submissions) carries a JSON message and is not retried.
const PROXY_RETRY_DELAYS_MS = [700, 1500, 3000, 5000];
const sleep = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });
export const isProxyThrottle = (response) => response.status === 429 && !(response.headers.get('content-type') || '').includes('application/json');
export const proxyRetryDelay = (response, attempt) => {
  const retryAfter = Number(response.headers.get('retry-after'));
  const base = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : PROXY_RETRY_DELAYS_MS[attempt];
  return base + Math.round(Math.random() * 400);
};

async function request(url, options = {}) {
  const { timeoutMs = 10000, ...fetchOptions } = options;
  let response;

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(url, {
        credentials: 'same-origin',
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...fetchOptions.headers,
        },
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('请求超时，请检查网络后重试');
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    if (!isProxyThrottle(response) || attempt >= PROXY_RETRY_DELAYS_MS.length) break;
    await sleep(proxyRetryDelay(response, attempt));
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || (response.status === 429 ? '现在访问的人比较多，请稍等几秒再试' : '请求失败'));
    error.status = response.status;
    throw error;
  }
  return data;
}

// Public recruitment pages are read by several components at once (and again after /recruit redirects to a cohort).
// Identical reads within a few seconds share one request. The administrator's preview always reads fresh.
const sharedReads = new Map();
const SHARED_READ_TTL_MS = 15 * 1000;
function sharedRead(url) {
  const cached = sharedReads.get(url);
  if (cached && Date.now() - cached.at < SHARED_READ_TTL_MS) return cached.promise;
  const promise = request(url);
  sharedReads.set(url, { at: Date.now(), promise });
  promise.catch(() => { if (sharedReads.get(url)?.promise === promise) sharedReads.delete(url); });
  return promise;
}

const entityListCache = new Map();
const entityListCacheTtlMs = 30 * 1000;

function invalidateEntityLists(entityName) {
  const prefix = `${entityName}:`;
  for (const key of entityListCache.keys()) {
    if (key.startsWith(prefix)) entityListCache.delete(key);
  }
}

function notifyEntityChange(entityName) {
  window.dispatchEvent(new CustomEvent('ailab:entity-change', { detail: { entityName } }));
}

function entityClient(entityName) {
  const basePath = `/api/entities/${encodeURIComponent(entityName)}`;
  return {
    list(sort = '-created_date', limit = 200) {
      const query = new URLSearchParams({ sort: sort || '', limit: String(limit || 200) });
      const cacheKey = `${entityName}:${query}`;
      const cached = entityListCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.promise;

      const promise = request(`${basePath}?${query}`).catch((error) => {
        entityListCache.delete(cacheKey);
        throw error;
      });
      entityListCache.set(cacheKey, { promise, expiresAt: Date.now() + entityListCacheTtlMs });
      return promise;
    },
    async create(payload) {
      const result = await request(basePath, { method: 'POST', body: JSON.stringify(payload) });
      invalidateEntityLists(entityName);
      notifyEntityChange(entityName);
      return result;
    },
    async update(id, payload) {
      const result = await request(`${basePath}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      invalidateEntityLists(entityName);
      notifyEntityChange(entityName);
      return result;
    },
    async delete(id) {
      const result = await request(`${basePath}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      invalidateEntityLists(entityName);
      notifyEntityChange(entityName);
      return result;
    },
  };
}

export const api = {
  entities: new Proxy({}, {
    get(_target, entityName) {
      return entityClient(String(entityName));
    },
  }),
  auth: {
    async login(account, password) {
      const result = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account, password }),
      });
      entityListCache.clear();
      return result;
    },
    me() {
      return request('/api/auth/me');
    },
    changeAdminPassword(currentPassword, newPassword) {
      return request('/api/auth/admin-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
    },
    changePassword(currentPassword, newPassword) {
      return request('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
    },
    async logout() {
      const result = await request('/api/auth/logout', { method: 'POST' });
      entityListCache.clear();
      return result;
    },
  },
  member: {
    profile() {
      return request('/api/member/profile');
    },
    async updateProfile(payload) {
      const result = await request('/api/member/profile', { method: 'PUT', body: JSON.stringify(payload) });
      invalidateEntityLists('Member');
      notifyEntityChange('Member');
      return result;
    },
    async uploadPhoto(file) {
      const body = new FormData();
      body.append('file', file);
      const result = await request('/api/member/photo', { method: 'POST', body, timeoutMs: 30000 });
      invalidateEntityLists('Member');
      notifyEntityChange('Member');
      return result;
    },
  },
  albums: {
    async create(payload) {
      const result = await request('/api/albums', { method: 'POST', body: JSON.stringify(payload) });
      invalidateEntityLists('Album');
      notifyEntityChange('Album');
      return result;
    },
    async update(id, payload) {
      const result = await request(`/api/albums/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      invalidateEntityLists('Album');
      notifyEntityChange('Album');
      return result;
    },
    async delete(id) {
      const result = await request(`/api/albums/${encodeURIComponent(id)}`, { method: 'DELETE' });
      invalidateEntityLists('Album');
      notifyEntityChange('Album');
      return result;
    },
    async uploadPhotos(files) {
      const body = new FormData();
      Array.from(files || []).forEach((file) => body.append('files', file));
      return request('/api/album-photos', { method: 'POST', body, timeoutMs: 120000 });
    },
    async setHomeFeatured(albumId, photoId, isHomeFeatured) {
      const result = await request(`/api/albums/${encodeURIComponent(albumId)}/photos/${encodeURIComponent(photoId)}/home-featured`, {
        method: 'PATCH',
        body: JSON.stringify({ is_home_featured: isHomeFeatured }),
      });
      invalidateEntityLists('Album');
      notifyEntityChange('Album');
      return result;
    },
  },
  contributions: {
    async create(entityName, payload) {
      const result = await request(`/api/contributions/${encodeURIComponent(entityName)}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      invalidateEntityLists(entityName);
      notifyEntityChange(entityName);
      return result;
    },
    async upload(file) {
      const body = new FormData();
      body.append('file', file);
      return request('/api/contributor-upload', { method: 'POST', body, timeoutMs: 120000 });
    },
  },
  public: {
    members(sort = '', limit = 500) {
      const query = new URLSearchParams({ sort, limit: String(limit) });
      return request(`/api/public/members?${query}`);
    },
    homePhotos() {
      return request('/api/public/home-photos');
    },
    stats() {
      return request('/api/public/stats');
    },
    albums(category) {
      return request(`/api/public/albums?${new URLSearchParams({ category })}`);
    },
  },
  docs: {
    // `preview` asks for the administrator's view: unpublished cohorts and draft pages, as they will look once published.
    cohorts({ preview = false } = {}) {
      return preview ? request('/api/docs/cohorts?preview=1') : sharedRead('/api/docs/cohorts');
    },
    pages(cohort, { preview = false } = {}) {
      const url = `/api/docs/${encodeURIComponent(cohort)}/pages`;
      return preview ? request(`${url}?preview=1`) : sharedRead(url);
    },
    page(cohort, slug, { preview = false } = {}) {
      const url = `/api/docs/${encodeURIComponent(cohort)}/pages/${encodeURIComponent(slug)}`;
      return preview ? request(`${url}?preview=1`) : sharedRead(url);
    },
  },
  recruit: {
    submit(cohort, formData, { onProgress } = {}) {
      return uploadWithProgress(`/api/recruit/${encodeURIComponent(cohort)}/submissions`, formData, { onProgress });
    },
    submissions(cohort) {
      return request(`/api/recruit/${encodeURIComponent(cohort)}/submissions`);
    },
    removeSubmission(id) {
      return request(`/api/recruit/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },
  // Accounts for applicants: separate from member accounts, only good for filling in the application.
  applicant: {
    mySubmissions(cohort) {
      return request(`/api/recruit/${encodeURIComponent(cohort)}/my-submissions`);
    },
    me() {
      return request('/api/recruit/me');
    },
    register(payload) {
      return request('/api/recruit/register', { method: 'POST', body: JSON.stringify(payload) });
    },
    login(studentId, password) {
      return request('/api/recruit/login', { method: 'POST', body: JSON.stringify({ student_id: studentId, password }) });
    },
    logout() {
      return request('/api/recruit/logout', { method: 'POST' });
    },
    changePassword(currentPassword, newPassword) {
      return request('/api/recruit/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
    },
  },
  recruitAdmin: {
    applicants() {
      return request('/api/admin/recruit/applicants');
    },
    resetApplicantPassword(id) {
      return request(`/api/admin/recruit/applicants/${encodeURIComponent(id)}/reset-password`, { method: 'POST' });
    },
    removeApplicant(id) {
      return request(`/api/admin/recruit/applicants/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    cohorts() {
      return request('/api/admin/recruit/cohorts');
    },
    publish(cohort, drafts = true) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/publish`, { method: 'POST', body: JSON.stringify({ drafts }) });
    },
    renameCohort(cohort, id) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/rename`, { method: 'PUT', body: JSON.stringify({ id }) });
    },
    setSubmissionsOpen(cohort, open) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/submissions-open`, { method: 'PUT', body: JSON.stringify({ open }) });
    },
    schedule(cohort, publishAt, drafts = true) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/schedule`, { method: 'POST', body: JSON.stringify({ publish_at: publishAt, drafts }) });
    },
    cancelSchedule(cohort) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/schedule`, { method: 'DELETE' });
    },
    unpublish(cohort) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/unpublish`, { method: 'POST' });
    },
    saveCohorts(cohorts) {
      return request('/api/admin/recruit/cohorts', { method: 'PUT', body: JSON.stringify({ cohorts }) });
    },
    pages(cohort) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/pages`);
    },
    page(cohort, slug) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/pages/${encodeURIComponent(slug)}`);
    },
    reorderPages(cohort, pages) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/pages-order`, { method: 'PUT', body: JSON.stringify({ pages }) });
    },
    savePage(cohort, slug, payload) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/pages/${encodeURIComponent(slug)}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    deletePage(cohort, slug) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/pages/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    },
    importPage(cohort, file, overwrite = false) {
      const body = new FormData();
      body.append('overwrite', String(overwrite));
      body.append('file', file);
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/import`, { method: 'POST', body, timeoutMs: 30000 });
    },
    assets(cohort) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/assets`);
    },
    uploadAssets(cohort, files, directory) {
      const body = new FormData();
      body.append('directory', directory);
      files.forEach((file) => body.append('files', file));
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/assets`, { method: 'POST', body, timeoutMs: 300000 });
    },
    deleteAsset(cohort, assetPath) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/assets?${new URLSearchParams({ path: assetPath })}`, { method: 'DELETE' });
    },
  },
  admin: {
    previewMemberImport(rows) {
      return request('/api/admin/member-import', {
        method: 'POST',
        body: JSON.stringify({ rows, dry_run: true }),
        timeoutMs: 30000,
      });
    },
    async importMembers(rows) {
      const result = await request('/api/admin/member-import', {
        method: 'POST',
        body: JSON.stringify({ rows, dry_run: false }),
        timeoutMs: 120000,
      });
      invalidateEntityLists('Member');
      notifyEntityChange('Member');
      return result;
    },
  },
  bilibili: {
    preview(url) {
      return request(`/api/bilibili/preview?${new URLSearchParams({ url })}`, { timeoutMs: 8000 });
    },
  },
  async upload(file) {
    const body = new FormData();
    body.append('file', file);
    return request('/api/upload', { method: 'POST', body });
  },
};
