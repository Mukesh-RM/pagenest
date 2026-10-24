import { expect, test, type Page } from '@playwright/test';
import { launch, waitForServiceWorkerControl } from './support/app';

// Blueprint section 14 (PWA setup) and 5.6 (install and first launch).
const PHASE = Number(process.env.PAGENEST_PHASE ?? 0);

type Icon = { src: string; sizes?: string; type?: string; purpose?: string };
type Manifest = {
  name?: string; short_name?: string; display?: string; start_url?: string; scope?: string;
  theme_color?: string; background_color?: string; icons?: Icon[]; categories?: string[];
  share_target?: { action?: string; method?: string; enctype?: string; params?: unknown };
};

async function loadManifest(page: Page): Promise<{ url: string; manifest: Manifest }> {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href, 'index.html must link a web app manifest').toBeTruthy();
  const url = new URL(href!, page.url()).toString();
  const res = await page.request.get(url);
  expect(res.status(), `manifest at ${url}`).toBe(200);
  return { url, manifest: (await res.json()) as Manifest };
}

test.describe('pwa installability', () => {
  test('manifest has name, standalone display, start URL and colours', async ({ page }) => {
    await launch(page);
    const { manifest } = await loadManifest(page);
    expect(manifest.name).toMatch(/pagenest/i);
    expect(manifest.short_name, 'short_name').toBeTruthy();
    expect(manifest.short_name!.length, 'short_name should fit under a home-screen icon').toBeLessThanOrEqual(12);
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url, 'start_url').toBeTruthy();
    expect(manifest.theme_color, 'theme_color').toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color, 'background_color').toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('manifest has 192 and 512 icons plus a maskable icon, and every icon file loads', async ({ page }) => {
    await launch(page);
    const { url, manifest } = await loadManifest(page);
    const icons = manifest.icons ?? [];
    const sizes = (i: Icon) => (i.sizes ?? '').split(/\s+/);
    expect(icons.some((i) => sizes(i).includes('192x192') && /image\/png/.test(i.type ?? 'image/png')), '192x192 png icon').toBe(true);
    expect(icons.some((i) => sizes(i).includes('512x512') && /image\/png/.test(i.type ?? 'image/png')), '512x512 png icon').toBe(true);
    expect(icons.some((i) => (i.purpose ?? '').split(/\s+/).includes('maskable')), 'maskable icon').toBe(true);
    for (const icon of icons) {
      const res = await page.request.get(new URL(icon.src, url).toString());
      expect(res.status(), `icon ${icon.src}`).toBe(200);
      expect(res.headers()['content-type'] ?? '', `icon ${icon.src} content-type`).toMatch(/^image\//);
    }
  });

  test('manifest declares categories and a Share Target for Android (blueprint 14; lands with Phase 1 import)', async ({ page }) => {
    test.skip(PHASE < 1, 'Share Target is delivered with Phase 1 import; set PAGENEST_PHASE=1 to enforce');
    await launch(page);
    const { manifest } = await loadManifest(page);
    expect(manifest.categories?.length ?? 0, 'categories').toBeGreaterThan(0);
    expect(manifest.share_target?.action, 'share_target.action').toBeTruthy();
    expect(manifest.share_target?.method?.toUpperCase(), 'share_target.method').toBe('POST');
  });

  test('iPhone and browser chrome tags are present (blueprint 14)', async ({ page }) => {
    await launch(page);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#[0-9a-f]{6}$/i);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    const capable = await page
      .locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]')
      .count();
    expect(capable, 'standalone meta tag').toBeGreaterThan(0);
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveCount(1);
  });

  test('apple-touch-icon file loads', async ({ page }) => {
    await launch(page);
    const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    const res = await page.request.get(new URL(href!, page.url()).toString());
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type'] ?? '').toMatch(/^image\//);
  });

  test('styles use safe-area insets for the notch and home bar (blueprint 14)', async ({ page }) => {
    await launch(page);
    const uses = await page.evaluate(async () => {
      const chunks: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try { chunks.push(Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')); }
        catch { chunks.push(await fetch(sheet.href!).then((r) => r.text())); }
      }
      document.querySelectorAll('style').forEach((s) => chunks.push(s.textContent ?? ''));
      const css = chunks.join('\n');
      return { top: /safe-area-inset-top/.test(css), bottom: /safe-area-inset-bottom/.test(css) };
    });
    expect(uses.top, 'env(safe-area-inset-top) is used').toBe(true);
    expect(uses.bottom, 'env(safe-area-inset-bottom) is used').toBe(true);
  });

  test('service worker is served from the app scope and controls the start URL', async ({ page }) => {
    await launch(page);
    await waitForServiceWorkerControl(page);
    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { scope: r.scope, script: r.active?.scriptURL };
    });
    expect(reg.script, 'active worker script URL').toBeTruthy();
    expect(new URL(page.url()).href.startsWith(reg.scope)).toBe(true);
  });

  test('page is served in a secure context (installable)', async ({ page }) => {
    await launch(page);
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  });
});
