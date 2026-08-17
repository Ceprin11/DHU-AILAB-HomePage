import React from 'react';

const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i;
const RELOAD_GUARD_KEY = 'ailab_chunk_reload';

export default class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application render failed', error, errorInfo);
    if (!CHUNK_ERROR_PATTERN.test(String(error?.message || error))) return;

    try {
      const previous = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
      if (Date.now() - previous > 30000) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // The visible recovery screen remains available if browser storage is disabled.
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-16 text-foreground">
        <section className="w-full max-w-lg border-y border-border/75 bg-card px-5 py-12 text-center sm:px-8">
          <p className="font-mono-date text-xs uppercase tracking-[0.22em] text-primary">AILAB</p>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">页面暂时无法显示</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">可能是网络中断或页面文件更新导致的，请重新加载页面。</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-7 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            重新加载
          </button>
        </section>
      </main>
    );
  }
}
