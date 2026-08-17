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

function entityClient(entityName) {
  const basePath = `/api/entities/${encodeURIComponent(entityName)}`;
  return {
    list(sort = '-created_date', limit = 200) {
      const query = new URLSearchParams({ sort: sort || '', limit: String(limit || 200) });
      return request(`${basePath}?${query}`);
    },
    create(payload) {
      return request(basePath, { method: 'POST', body: JSON.stringify(payload) });
    },
    update(id, payload) {
      return request(`${basePath}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    delete(id) {
      return request(`${basePath}/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
