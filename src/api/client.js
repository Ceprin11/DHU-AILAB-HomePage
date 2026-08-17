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
    login(account, password) {
      return request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account, password }),
      });
    },
    me() {
      return request('/api/auth/me');
    },
    logout() {
      return request('/api/auth/logout', { method: 'POST' });
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
