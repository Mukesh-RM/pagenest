/**
 * Deliberately sane and deliberately broken pages for the 200% text-size gate (see e2e/text-scale-harness.spec.ts).
 * They prove the gate has teeth: it must pass on the sane page and fail, for the right reason, on each broken one,
 * whichever unit the page uses for its text ('px' tokens like InkQuiet today, or 'rem' tokens).
 * Not product code.
 */
export type Unit = 'px' | 'rem' | 'mixed';
export type Defect = 'none' | 'fixed-width-overflow' | 'clipped-height' | 'clipped-width' | 'ignores-text-size';

const tokens: Record<Unit, string> = {
  // InkQuiet style: root size and text sizes are px custom properties
  px: ':root{--app-font-size:16px;--app-text-sm:14px;--app-text-md:16px;--app-text-lg:24px} html{font-size:var(--app-font-size)}',
  // rem style: tokens are relative to the root, root is left at the browser default
  rem: ':root{--app-text-sm:0.875rem;--app-text-md:1rem;--app-text-lg:1.5rem} html{font-size:100%}',
  // mixed: px root token, rem body text, px small text
  mixed: ':root{--app-font-size:16px;--app-text-sm:13px;--app-text-md:1rem;--app-text-lg:1.5rem} html{font-size:var(--app-font-size)}',
};

const base = `
  *{box-sizing:border-box} body{margin:0;font-size:var(--app-text-md);line-height:1.4;font-family:sans-serif}
  h1{font-size:var(--app-text-lg);margin:12px} p,.note{margin:12px;font-size:var(--app-text-sm)}
  nav{display:flex;flex-wrap:wrap;gap:8px;margin:12px}
  button{font-size:var(--app-text-md);min-height:44px;min-width:44px;padding:8px 12px}
  .badge{margin:12px;display:inline-block;font-size:var(--app-text-sm)}
`;

const defects: Record<Defect, string> = {
  none: '',
  // a nowrap toolbar: wider than the phone once the text doubles
  'fixed-width-overflow': 'nav{flex-wrap:nowrap;width:max-content;gap:4px} nav button{white-space:nowrap;padding:8px 6px} nav button:nth-child(n+5){display:none}',
  // a note in a fixed pixel height: three or four lines at 200% do not fit
  'clipped-height': '.note{height:48px;overflow:hidden}',
  // a badge in a fixed pixel width: the label is cut off at 200%
  'clipped-width': '.badge{width:120px;overflow:hidden;white-space:nowrap}',
  // all text pinned in px, so the user's text size is ignored: the gate must notice instead of passing on an unscaled page
  'ignores-text-size': 'body,body *{font-size:16px !important}',
};

export function textScalePage(unit: Unit, defect: Defect): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Text scale fixture</title>
<style>${tokens[unit]}${base}${defects[defect]}</style></head><body>
<main><h1>Library</h1>
<nav aria-label="Primary"><button>Library</button><button>Collections</button><button>Stats</button><button>Settings</button><button>Install</button><button>About</button></nav>
<p class="note">Your books stay on this device and open without a connection, so reading never waits for a network.</p>
<span class="badge">Offline ready</span>
<p>Choose a theme and a text size in Settings. Everything reflows to fit your phone.</p></main></body></html>`;
}
