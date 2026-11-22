import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

// Loaded on demand, only for documents that contain formulas ($...$ or $$...$$).
export default {
  remark: [remarkMath],
  rehype: [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]],
};
