// Markdown bodies are untrusted input: raw HTML is escaped, never rendered; external links get rel="noopener".
import { marked, type Tokens } from 'marked';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

marked.use({
  gfm: true,
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag) { return escapeHtml(token.raw); },
    link(token: Tokens.Link) {
      const href = /^https?:\/\//.test(token.href) ? token.href : /^[./#]/.test(token.href) ? token.href : '#';
      const external = /^https?:\/\//.test(href);
      const text = this.parser.parseInline(token.tokens);
      return `<a href="${escapeHtml(href)}"${external ? ' rel="noopener" target="_blank"' : ''}${token.title ? ` title="${escapeHtml(token.title)}"` : ''}>${text}</a>`;
    },
    image(token: Tokens.Image) { return `<code>${escapeHtml(token.raw)}</code>`; },
  },
});

export const renderMarkdown = (md: string): string => marked.parse(md, { async: false }) as string;
