import type { Plugin } from 'vite';

const FOLIATE_SANDBOX =
  /\.setAttribute\(\s*['"]sandbox['"]\s*,\s*['"]allow-same-origin allow-scripts['"]\s*\)/g;

/**
 * foliate-js sandboxes EPUB iframes; on WebKit that breaks blob: book frames (WebKit 218086).
 * Runtime patch lives in foliate-webkit.ts; this keeps the lazy engine chunk from re-applying sandbox if the patch runs late.
 */
export function foliateWebKitSandboxPlugin(): Plugin {
  return {
    name: 'foliate-webkit-sandbox',
    transform(code, id) {
      if (!id.includes('node_modules/foliate-js/')) return;
      if (!id.endsWith('paginator.js') && !id.endsWith('fixed-layout.js')) return;
      if (!FOLIATE_SANDBOX.test(code)) return;
      FOLIATE_SANDBOX.lastIndex = 0;
      const next = code.replace(FOLIATE_SANDBOX, '/* pn: omit iframe sandbox on WebKit */');
      return next === code ? undefined : { code: next, map: null };
    },
  };
}
