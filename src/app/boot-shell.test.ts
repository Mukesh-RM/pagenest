import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const main = readFileSync('src/main.tsx', 'utf8');

describe('boot screen in index.html', () => {
  it('sits inside #root, hidden from assistive technology, so the first paint does not wait for the app code', () => {
    expect(html).toMatch(/<div id="root"><div id="pn-boot" aria-hidden="true">InkQuiet<\/div><\/div>/);
  });

  it('is styled inline, with no inline script (the CSP allows inline styles only) and no extra download', () => {
    expect(html).toMatch(/<style>[\s\S]*#pn-boot[\s\S]*<\/style>/);
    expect(html.replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/, '')).not.toMatch(/<script/);
    expect(html).not.toMatch(/<img|url\(/);
  });

  it('is replaced by React (createRoot clears the container), never hydrated into', () => {
    expect(main).toContain('createRoot(root).render(');
    expect(main).not.toContain('hydrateRoot');
  });
});
