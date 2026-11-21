import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';

const EXTERNAL_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const PAGE_LINK = /^(?:\.\/)?([^/?#:]+)\.md(#.*)?$/;

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const resolveDocsAssetUrl = (cohort, source) => {
  if (!source || EXTERNAL_URL.test(source) || source.startsWith('/') || source.startsWith('#')) return source;
  const relativePath = safeDecode(source).replace(/^\.\//, '');
  return `/docs-assets/${encodeURIComponent(cohort)}/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
};

export const resolveDocsPageLink = (cohort, href) => {
  const match = PAGE_LINK.exec(href || '');
  if (!match) return null;
  const slug = safeDecode(match[1]);
  return `/recruit/${encodeURIComponent(cohort)}${slug === 'index' ? '' : `/${encodeURIComponent(slug)}`}${match[2] || ''}`;
};

const buildComponents = (cohort) => ({
  a({ href, children }) {
    const pagePath = resolveDocsPageLink(cohort, href);
    if (pagePath) return <Link to={pagePath}>{children}</Link>;
    if (!href) return <a>{children}</a>;
    if (href.startsWith('#')) return <a href={href}>{children}</a>;
    if (EXTERNAL_URL.test(href)) return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
    return <a href={resolveDocsAssetUrl(cohort, href)} target="_blank" rel="noreferrer">{children}</a>;
  },
  // The visual editor stores a resize ratio ("1.00") in the alt slot and the caption in the title.
  img({ src, alt, title }) {
    const description = /^\d+(\.\d+)?$/.test(alt || '') ? '' : alt || '';
    const image = <img src={resolveDocsAssetUrl(cohort, src)} alt={description || title || ''} loading="lazy" decoding="async" />;
    return title ? <span className="doc-figure">{image}<span className="doc-figcaption">{title}</span></span> : image;
  },
  table({ children }) {
    return <div className="doc-table-scroll"><table>{children}</table></div>;
  },
});

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSlug, [rehypeHighlight, { detect: false, ignoreMissing: true }]];

export default function MarkdownContent({ cohort, children }) {
  const components = React.useMemo(() => buildComponents(cohort), [cohort]);
  return (
    <div className="doc-prose">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
