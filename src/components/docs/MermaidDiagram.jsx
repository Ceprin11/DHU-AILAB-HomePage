import React, { useEffect, useId, useState } from 'react';

// Renders a ```mermaid code block as a diagram. The library is large, so it is only fetched when a document has one.
export default function MermaidDiagram({ source }) {
  const reactId = useId();
  const [state, setState] = useState({ svg: '', failed: false });

  useEffect(() => {
    let cancelled = false;
    import('mermaid')
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'inherit' });
        const { svg } = await mermaid.render(`mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`, source);
        if (!cancelled) setState({ svg, failed: false });
      })
      .catch(() => { if (!cancelled) setState({ svg: '', failed: true }); });
    return () => { cancelled = true; };
  }, [source, reactId]);

  if (state.failed) {
    return <pre className="doc-mermaid-source"><code>{source}</code></pre>;
  }
  if (!state.svg) return <div className="doc-mermaid doc-mermaid-loading" aria-busy="true">正在生成图表…</div>;
  return <div className="doc-mermaid" role="img" aria-label="流程图" dangerouslySetInnerHTML={{ __html: state.svg }} />;
}
