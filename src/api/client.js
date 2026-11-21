async function request(url, options = {}) {
  const { timeoutMs = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  let response;

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

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || '请求失败');
    error.status = response.status;
    throw error;
  }
  return data;
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
    albums(category) {
      return request(`/api/public/albums?${new URLSearchParams({ category })}`);
    },
  },
  docs: {
    // `preview` asks for the administrator's view: unpublished cohorts and draft pages, as they will look once published.
    cohorts({ preview = false } = {}) {
      return request(`/api/docs/cohorts${preview ? '?preview=1' : ''}`);
    },
    pages(cohort, { preview = false } = {}) {
      return request(`/api/docs/${encodeURIComponent(cohort)}/pages${preview ? '?preview=1' : ''}`);
    },
    page(cohort, slug, { preview = false } = {}) {
      return request(`/api/docs/${encodeURIComponent(cohort)}/pages/${encodeURIComponent(slug)}${preview ? '?preview=1' : ''}`);
    },
  },
  recruit: {
    submit(cohort, formData) {
      return request(`/api/recruit/${encodeURIComponent(cohort)}/submissions`, { method: 'POST', body: formData, timeoutMs: 120000 });
    },
    submissions(cohort) {
      return request(`/api/recruit/${encodeURIComponent(cohort)}/submissions`);
    },
    removeSubmission(id) {
      return request(`/api/recruit/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },
  recruitAdmin: {
    cohorts() {
      return request('/api/admin/recruit/cohorts');
    },
    publish(cohort, drafts = true) {
      return request(`/api/admin/recruit/${encodeURIComponent(cohort)}/publish`, { method: 'POST', body: JSON.stringify({ drafts }) });
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
