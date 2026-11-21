import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Download, FileArchive, FileCode, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import { api } from '@/api/client';
import MarkdownContent, { resolveDocsAssetUrl } from '@/components/docs/MarkdownContent';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { SidebarLayout, SidebarLink } from '@/components/recruit/SidebarLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useDocumentTitle from '@/hooks/use-document-title';
import { formatFileSize } from '@/lib/recruit';

const hasTopLevelHeading = (body) => /^#\s+\S/m.test(body.replace(/^(```|~~~)[\s\S]*?^\1/gm, ''));

export const recruitPath = (cohort, slug) => `/recruit/${encodeURIComponent(cohort)}${slug && slug !== 'index' ? `/${encodeURIComponent(slug)}` : ''}`;

const ATTACHMENT_ICONS = {
  '.doc': FileText, '.docx': FileText, '.pdf': FileText, '.txt': FileText,
  '.ppt': Presentation, '.pptx': Presentation,
  '.xls': FileSpreadsheet, '.xlsx': FileSpreadsheet, '.csv': FileSpreadsheet,
  '.zip': FileArchive,
  '.ipynb': FileCode, '.py': FileCode,
};

function AttachmentList({ cohort, attachments }) {
  return (
    <section aria-label="附件下载" className="mt-12 border-t border-border/75 pt-8">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foreground">附件下载</h2>
      <ul className="mt-4 divide-y divide-border/75 overflow-hidden rounded-xl border border-border/75 bg-card">
        {attachments.map((item) => {
          const extension = item.name.slice(item.name.lastIndexOf('.')).toLowerCase();
          const Icon = ATTACHMENT_ICONS[extension] || FileText;
          const title = item.label && item.label !== item.name ? item.label : item.name;
          return (
            <li key={item.path}>
              <a
                href={`${resolveDocsAssetUrl(cohort, item.path)}?download=1`}
                download={item.name}
                className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-secondary/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-accent text-primary"><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.name} · {formatFileSize(item.size)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary"><Download size={15} strokeWidth={1.8} aria-hidden="true" /><span className="hidden sm:inline">下载</span></span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function useDocPages(cohortId, slug) {
  const [pagesState, setPagesState] = useState({ cohortId: null, pages: null, error: false });
  const [pageState, setPageState] = useState({ key: null, page: null, error: false });

  useEffect(() => {
    let cancelled = false;
    api.docs.pages(cohortId)
      .then((result) => { if (!cancelled) setPagesState({ cohortId, pages: result.pages || [], error: false }); })
      .catch(() => { if (!cancelled) setPagesState({ cohortId, pages: null, error: true }); });
    return () => { cancelled = true; };
  }, [cohortId]);

  const pages = pagesState.cohortId === cohortId ? pagesState.pages : null;
  const activeSlug = slug || (pages?.some((page) => page.slug === 'index') ? 'index' : pages?.[0]?.slug);

  useEffect(() => {
    if (!activeSlug) return undefined;
    const key = `${cohortId}/${activeSlug}`;
    let cancelled = false;
    api.docs.page(cohortId, activeSlug)
      .then((page) => { if (!cancelled) setPageState({ key, page, error: false }); })
      .catch(() => { if (!cancelled) setPageState({ key, page: null, error: true }); });
    return () => { cancelled = true; };
  }, [cohortId, activeSlug]);

  const pageKey = `${cohortId}/${activeSlug}`;
  return {
    pages,
    pagesError: pagesState.cohortId === cohortId && pagesState.error,
    activeSlug,
    page: pageState.key === pageKey ? pageState.page : null,
    pageError: pageState.key === pageKey && pageState.error,
  };
}

function useHeadings(contentKey) {
  const containerRef = useRef(null);
  const [headings, setHeadings] = useState([]);

  useEffect(() => {
    const nodes = containerRef.current?.querySelectorAll('h2[id], h3[id]') || [];
    setHeadings(Array.from(nodes).map((node) => ({ id: node.id, text: node.textContent, level: node.tagName === 'H2' ? 2 : 3 })));
  }, [contentKey]);

  return { containerRef, headings };
}

export default function RecruitDocs({ cohort, slug }) {
  const navigate = useNavigate();
  const { pages, pagesError, activeSlug, page, pageError } = useDocPages(cohort.id, slug);
  const { containerRef, headings } = useHeadings(page ? `${cohort.id}/${page.slug}` : null);
  const showTitle = useMemo(() => (page ? !hasTopLevelHeading(page.body) : false), [page]);
  useDocumentTitle(page ? `${page.title} · ${cohort.label} · AILAB` : '');

  useEffect(() => {
    if (page) window.scrollTo({ top: 0 });
  }, [page?.slug, cohort.id]);

  if (pagesError) return <EmptyState title="文档暂时无法加载" description="请稍后刷新页面重试。" icon={BookOpen} />;
  if (!pages) return <ContentLoading />;
  if (pages.length === 0) {
    return (
      <EmptyState
        title={cohort.status === 'upcoming' ? '这一期招新还没有开始' : '这一期的文档还在准备中'}
        description="文档发布后会出现在这里。"
        icon={BookOpen}
      />
    );
  }

  const pageIndex = page ? pages.findIndex((item) => item.slug === page.slug) : -1;
  const previousPage = pageIndex > 0 ? pages[pageIndex - 1] : null;
  const nextPage = pageIndex >= 0 && pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null;

  const sidebar = (
    <nav aria-label="文档目录">
      <ul className="space-y-0.5 border-l border-border/75">
        {pages.map((item) => (
          <li key={item.slug}><SidebarLink to={recruitPath(cohort.id, item.slug)} active={item.slug === activeSlug}>{item.title}</SidebarLink></li>
        ))}
      </ul>
    </nav>
  );

  const mobile = (
    <Select value={activeSlug} onValueChange={(value) => navigate(recruitPath(cohort.id, value))}>
      <SelectTrigger className="h-10 w-full bg-card" aria-label="选择文档"><SelectValue /></SelectTrigger>
      <SelectContent>{pages.map((item) => <SelectItem key={item.slug} value={item.slug}>{item.title}</SelectItem>)}</SelectContent>
    </Select>
  );

  const toc = headings.length > 1 && (
    <aside className="hidden xl:sticky xl:top-24 xl:block xl:max-h-[calc(100dvh-8rem)] xl:self-start xl:overflow-y-auto">
      <p className="font-mono-date text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">本页目录</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? 'pl-3' : undefined}>
            <a href={`#${heading.id}`} className="block leading-5 text-muted-foreground transition-colors hover:text-primary">{heading.text}</a>
          </li>
        ))}
      </ul>
    </aside>
  );

  return (
    <SidebarLayout sidebar={sidebar} mobile={mobile} aside={toc || null}>
      <article className="min-w-0">
        {pageError ? (
          <EmptyState title="没有找到这篇文档" icon={BookOpen} className="mt-0" />
        ) : !page ? (
          <ContentLoading className="mt-0" />
        ) : (
          <>
            {showTitle && <h1 className="mb-6 font-display text-3xl font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-4xl">{page.title}</h1>}
            <div ref={containerRef}>
              <MarkdownContent cohort={cohort.id}>{page.body}</MarkdownContent>
            </div>
            {page.attachments?.length > 0 && <AttachmentList cohort={cohort.id} attachments={page.attachments} />}
            {(previousPage || nextPage) && (
              <nav aria-label="上一篇和下一篇" className="mt-14 grid gap-3 border-t border-border/75 pt-8 sm:grid-cols-2">
                {previousPage ? (
                  <Link to={recruitPath(cohort.id, previousPage.slug)} className="group rounded-xl border border-border/75 bg-card p-4 transition-colors hover:border-primary/40">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowLeft size={13} /> 上一篇</span>
                    <span className="mt-1 block font-display text-base font-semibold text-foreground group-hover:text-primary">{previousPage.title}</span>
                  </Link>
                ) : <span />}
                {nextPage && (
                  <Link to={recruitPath(cohort.id, nextPage.slug)} className="group rounded-xl border border-border/75 bg-card p-4 text-right transition-colors hover:border-primary/40 sm:col-start-2">
                    <span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">下一篇 <ArrowRight size={13} /></span>
                    <span className="mt-1 block font-display text-base font-semibold text-foreground group-hover:text-primary">{nextPage.title}</span>
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </article>
    </SidebarLayout>
  );
}
