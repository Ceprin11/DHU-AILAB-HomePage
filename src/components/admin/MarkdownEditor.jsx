import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { upload, uploadConfig } from '@milkdown/kit/plugin/upload';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { $prose, insert } from '@milkdown/kit/utils';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import { api } from '@/api/client';
import { resolveDocsAssetUrl } from '@/components/docs/MarkdownContent';
import { IMAGE_EXTENSIONS_BY_TYPE, altToCaption, nameUploadedFile } from '@/lib/recruit';

const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*:|\/)/i;
const REMOTE_IMAGE = /^https?:\/\//i;
const IMAGE_NODES = new Set(['image', 'image-block']);

// Copied web pages mark code languages as class="language-xxx"; Milkdown reads data-language.
const normalizePastedHtml = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('pre').forEach((pre) => {
    const match = `${pre.querySelector('code')?.className || ''} ${pre.className || ''}`.match(/language-([\w+#-]+)/);
    if (match && !pre.getAttribute('data-language')) pre.setAttribute('data-language', match[1]);
  });
  return doc.body.innerHTML;
};

const pasteCleanup = $prose(() => new Plugin({
  key: new PluginKey('recruit-paste-cleanup'),
  props: { transformPastedHTML: normalizePastedHtml },
}));

const fileNameFromUrl = (url) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return /\.\w{2,5}$/.test(name) ? name : `${name || 'image'}.png`;
  } catch {
    return 'image.png';
  }
};

const LABELS = {
  placeholder: '输入 / 选择标题、列表、代码块、表格、图片……也可以直接粘贴图片',
  text: {
    label: '基础',
    text: { label: '正文' }, h1: { label: '标题 1' }, h2: { label: '标题 2' }, h3: { label: '标题 3' }, h4: { label: '标题 4' },
    h5: null, h6: null, quote: { label: '引用' }, divider: { label: '分割线' },
  },
  list: { label: '列表', bulletList: { label: '无序列表' }, orderedList: { label: '有序列表' }, taskList: { label: '待办事项' } },
  advanced: { label: '插入', image: { label: '图片' }, codeBlock: { label: '代码块' }, table: { label: '表格' }, math: null },
};

// A WYSIWYG Markdown editor (Milkdown Crepe). The document stays plain Markdown, so the public pages keep rendering it as before.
const MarkdownEditor = forwardRef(function MarkdownEditor({ initialValue, cohortId, onChange, onUploading, onError, onNotice }, ref) {
  const host = useRef(null);
  const crepeRef = useRef(null);
  const latest = useRef({});
  latest.current = { onChange, onUploading, onError, onNotice, cohortId };

  // Downloads pictures that point at other websites and stores them with the document, so the page no longer depends on them.
  const localizeImages = async () => {
    const crepe = crepeRef.current;
    if (!crepe) return { done: 0, failed: 0 };
    const view = crepe.editor.action((ctx) => ctx.get(editorViewCtx));
    const sources = new Set();
    view.state.doc.descendants((node) => {
      if (IMAGE_NODES.has(node.type.name) && REMOTE_IMAGE.test(node.attrs.src || '') && new URL(node.attrs.src).host !== window.location.host) sources.add(node.attrs.src);
    });
    let done = 0;
    const failedHosts = new Set();
    await Promise.all([...sources].map(async (src) => {
      latest.current.onUploading?.(1);
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) throw new Error('not an image');
        const file = new File([blob], fileNameFromUrl(src), { type: blob.type });
        const asset = (await api.recruitAdmin.uploadAssets(latest.current.cohortId, [file], 'assets')).uploaded?.[0];
        if (!asset) throw new Error('upload failed');
        const current = crepeRef.current?.editor.action((ctx) => ctx.get(editorViewCtx));
        if (!current) return;
        const { tr } = current.state;
        current.state.doc.descendants((node, pos) => {
          if (IMAGE_NODES.has(node.type.name) && node.attrs.src === src) tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: asset.path });
        });
        current.dispatch(tr);
        done += 1;
      } catch {
        failedHosts.add(new URL(src).host);
      } finally {
        latest.current.onUploading?.(-1);
      }
    }));
    const failed = sources.size - done;
    if (done) latest.current.onNotice?.(`已把 ${done} 张外链图片转存到本站，不再依赖原网站。`);
    if (failed) latest.current.onError?.(`有 ${failed} 张外链图片无法转存（${[...failedHosts].join('、')} 不允许下载或无法访问），仍使用原链接。`);
    return { done, failed };
  };

  useImperativeHandle(ref, () => ({
    insertMarkdown: (markdown) => crepeRef.current?.editor.action(insert(markdown)),
    localizeImages,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    let cancelled = false;
    const uploadOne = async (file, index = 0, total = 1) => {
      latest.current.onUploading?.(1);
      try {
        const result = await api.recruitAdmin.uploadAssets(latest.current.cohortId, [nameUploadedFile(file, index, total)], 'assets');
        const asset = result.uploaded?.[0];
        if (!asset) throw new Error(result.failed?.[0]?.message || '上传失败');
        return asset;
      } catch (error) {
        latest.current.onError?.(`${file.name}：${error.message || '上传失败'}`);
        throw error;
      } finally {
        latest.current.onUploading?.(-1);
      }
    };

    // Pasted or dropped files: pictures become image blocks, everything else becomes a download link.
    const uploader = async (files, schema) => {
      const list = Array.from(files);
      const results = await Promise.all(list.map(async (file, index) => {
        try {
          const asset = await uploadOne(file, index, list.length);
          if (file.type in IMAGE_EXTENSIONS_BY_TYPE) {
            const block = schema.nodes['image-block']?.createAndFill({ src: asset.path, caption: '', ratio: 1 });
            return block || schema.nodes.paragraph.create(null, schema.nodes.image.create({ src: asset.path, alt: '图片' }));
          }
          const label = asset.name.slice(0, asset.name.length - asset.extension.length);
          return schema.nodes.paragraph.create(null, schema.text(label, [schema.marks.link.create({ href: asset.path })]));
        } catch {
          return null;
        }
      }));
      return results.filter(Boolean);
    };

    const crepe = new Crepe({
      root: host.current,
      defaultValue: altToCaption(initialValue),
      features: { [Crepe.Feature.Latex]: false, [Crepe.Feature.AI]: false },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: LABELS.placeholder, mode: 'block' },
        [Crepe.Feature.BlockEdit]: { textGroup: LABELS.text, listGroup: LABELS.list, advancedGroup: LABELS.advanced },
        [Crepe.Feature.Toolbar]: { boldLabel: '加粗', italicLabel: '斜体', strikethroughLabel: '删除线', codeLabel: '行内代码', linkLabel: '链接' },
        [Crepe.Feature.LinkTooltip]: { inputPlaceholder: '粘贴或输入链接，如 bert.md 或 https://…', editButton: '编辑', removeButton: '移除', confirmButton: '确定' },
        [Crepe.Feature.CodeMirror]: { searchPlaceholder: '搜索语言', noResultText: '没有匹配的语言', copyText: '复制', previewLabel: '预览' },
        [Crepe.Feature.ImageBlock]: {
          proxyDomURL: (url) => (ABSOLUTE_URL.test(url) ? url : resolveDocsAssetUrl(latest.current.cohortId, url)),
          onUpload: async (file) => (await uploadOne(file)).path,
          blockOnUpload: async (file) => (await uploadOne(file)).path,
          inlineOnUpload: async (file) => (await uploadOne(file)).path,
          blockUploadButton: '上传图片',
          blockConfirmButton: '确定',
          blockUploadPlaceholderText: '或粘贴图片链接',
          blockCaptionPlaceholderText: '图片说明（可选）',
          inlineUploadButton: '上传',
          inlineConfirmButton: '确定',
          inlineUploadPlaceholderText: '或粘贴图片链接',
        },
      },
    });
    crepe.editor
      .config((ctx) => ctx.update(uploadConfig.key, (previous) => ({ ...previous, enableHtmlFileUploader: false, uploader })))
      .use(upload)
      .use(pasteCleanup);
    // Loading a document makes the editor rewrite it in its own Markdown style (and emit an update). That is not an
    // edit: only report changes once the content differs from what the editor produced on load.
    let baseline = null;
    let touched = false;
    crepe.on((listener) => listener.markdownUpdated((_ctx, markdown) => {
      if (baseline === null || (!touched && markdown === baseline)) return;
      touched = true;
      latest.current.onChange?.(markdown);
    }));

    // After pasting copied web content, bring its pictures to this site.
    const onPaste = (event) => {
      if (event.clipboardData?.types?.includes('text/html')) window.setTimeout(() => localizeImages(), 500);
    };
    host.current.addEventListener('paste', onPaste);

    crepe.create().then(() => {
      if (cancelled) {
        crepe.destroy();
        return;
      }
      crepeRef.current = crepe;
      baseline = crepe.getMarkdown();
    });
    const element = host.current;
    return () => {
      element.removeEventListener('paste', onPaste);
      cancelled = true;
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }
    };
    // The editor is created once per document; the parent remounts it (via key) to load another one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="crepe-host" />;
});

export default MarkdownEditor;
