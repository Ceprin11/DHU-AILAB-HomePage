import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, FileQuestion, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { init as initPptxPreview } from 'pptx-preview';
import { submissionFileUrl } from '@/lib/recruit';

const SANDBOX_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";
const SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'link', 'meta', 'base'],
  ADD_TAGS: ['style'],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
};
const PPTX_WIDTH = 960;

const loadResponse = async (id) => {
  const response = await fetch(submissionFileUrl(id), { credentials: 'same-origin' });
  if (!response.ok) throw new Error(response.status === 401 ? '请先登录实验室账号' : '文件加载失败');
  return response;
};

// PowerPoint files are rendered in a detached host and serialized to HTML.
const renderPptxToHtml = async (buffer) => {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PPTX_WIDTH}px;visibility:hidden;pointer-events:none`;
  document.body.appendChild(host);
  try {
    const previewer = initPptxPreview(host, { width: PPTX_WIDTH, height: 540, mode: 'list' });
    await previewer.preview(buffer);
    host.querySelectorAll('canvas').forEach((canvas) => {
      const image = document.createElement('img');
      image.src = canvas.toDataURL();
      image.style.cssText = canvas.style.cssText;
      canvas.replaceWith(image);
    });
    return host.innerHTML;
  } finally {
    host.remove();
  }
};

// Everything untrusted is sanitized and then shown in an iframe with an empty sandbox and a
// network-blocking CSP: nothing in a submission can run scripts or reach the viewer's session.
const buildSandboxDocument = (html, zoom) => `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"><style>body{margin:0;padding:16px;background:#fff;zoom:${zoom}}a{pointer-events:none}</style></head><body>${DOMPurify.sanitize(html, SANITIZE_OPTIONS)}</body></html>`;

// The sandbox cannot run scripts, so the fit-to-width scale is computed here and baked into the document.
function SandboxedFrame({ html, title, contentWidth = 0 }) {
  const wrapper = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => setWidth(wrapper.current?.offsetWidth || 0), []);
  const srcDocument = useMemo(() => {
    if (!width) return '';
    const zoom = contentWidth ? Math.min(1, Math.max(0.3, (width - 32) / contentWidth)) : 1;
    return buildSandboxDocument(html, zoom.toFixed(3));
  }, [html, width, contentWidth]);
  return (
    <div ref={wrapper}>
      {srcDocument && <iframe title={title} sandbox="" srcDoc={srcDocument} className="h-[75vh] w-full rounded-lg border border-border/75 bg-card" />}
    </div>
  );
}

function DownloadLink({ id }) {
  return <a href={submissionFileUrl(id, { download: true })} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-foreground"><Download size={15} aria-hidden="true" /> 下载后查看</a>;
}

function Unsupported({ id }) {
  return (
    <div className="rounded-xl border border-border/75 bg-secondary/30 px-6 py-12 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-primary/10 bg-amber/20 text-primary"><FileQuestion size={19} strokeWidth={1.8} aria-hidden="true" /></span>
      <p className="mt-4 text-sm font-medium text-foreground">旧版 .ppt 文件不支持在线预览</p>
      <DownloadLink id={id} />
    </div>
  );
}

const previewKind = (extension) => (
  extension === '.pdf' ? 'pdf'
    : extension === '.pptx' ? 'pptx'
      : extension === '.html' || extension === '.htm' ? 'html' : 'unsupported'
);

export default function FilePreview({ submission }) {
  const { id, extension, final_name: title } = submission;
  const kind = previewKind(extension);
  const [state, setState] = useState({ id: null, value: '', error: '' });

  useEffect(() => {
    if (kind !== 'pptx' && kind !== 'html') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await loadResponse(id);
        const value = kind === 'pptx' ? await renderPptxToHtml(await response.arrayBuffer()) : await response.text();
        if (!cancelled) setState({ id, value, error: '' });
      } catch (error) {
        if (!cancelled) setState({ id, value: '', error: error.message || '预览失败，请下载后查看' });
      }
    })();
    return () => { cancelled = true; };
  }, [id, kind]);

  if (kind === 'unsupported') return <Unsupported id={id} />;
  if (kind === 'pdf') return <iframe title={title} src={submissionFileUrl(id)} className="h-[75vh] w-full rounded-lg border border-border/75 bg-card" />;
  if (state.id !== id) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> 正在加载预览</div>;
  }
  if (state.error) {
    return (
      <div className="rounded-xl border border-border/75 bg-secondary/30 px-6 py-10 text-center">
        <p className="text-sm text-foreground">{state.error}</p>
        <DownloadLink id={id} />
      </div>
    );
  }
  return (
    <>
      <SandboxedFrame html={state.value} title={title} contentWidth={kind === 'pptx' ? PPTX_WIDTH : 0} />
      <p className="mt-2 text-xs text-muted-foreground">
        {kind === 'html'
          ? 'HTML 在安全沙箱中以静态方式显示，脚本和外部资源不会加载；需要完整效果请下载后打开。'
          : '这是近似预览，复杂版式、动画和字体可能与 PowerPoint 中不同，请以下载的原文件为准。'}
      </p>
    </>
  );
}
