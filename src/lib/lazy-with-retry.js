import { lazy } from 'react';

// Pages are loaded on demand. When the reverse proxy turns a request away (429) or the network drops for a moment,
// the import fails and the page would stay blank, so try again a few times. As a last resort reload the page once.
const RETRY_DELAYS_MS = [800, 2000, 4000];
const RELOAD_KEY = 'ailab:chunk-reload-at';

const sleep = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });

export async function importWithRetry(load, { delays = RETRY_DELAYS_MS, wait = sleep } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      if (attempt >= delays.length) throw error;
      await wait(delays[attempt]);
    }
  }
}

const reloadOnce = () => {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60 * 1000) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};

export default function lazyWithRetry(load) {
  return lazy(() => importWithRetry(load).catch((error) => {
    if (reloadOnce()) return new Promise(() => {});
    throw error;
  }));
}
