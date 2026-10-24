import { chromium } from '@playwright/test';
const which = process.argv[2];
const b = await chromium.launch();
const names = ['epub · stored as “book.epub__1_”','PDF · stored as “scan.txt”','MOBI','FB2','DOCX','TXT','COMIC'];
const list = which ? [which] : ['EPUB · stored','PDF','MOBI','FB2','DOCX','TXT','comic pages'];
for (const name of list) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error','warning'].includes(m.type()) && !/sandbox/.test(m.text())) logs.push(m.type() + ': ' + m.text().slice(0,300)); });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message.slice(0,300)));
  await page.goto('http://localhost:5199/dev/reader');
  const t0 = Date.now();
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
  await page.waitForURL(/\/read\//);
  let ok = true;
  try { await page.waitForFunction(() => document.querySelector('.pn-reader__status') !== null, null, { timeout: 15000 }); } catch { ok = false; }
  const open = Date.now() - t0;
  await page.waitForTimeout(1500);
  const slug = name.replace(/[^a-z0-9]/gi, '');
  await page.screenshot({ path: `/workspace/scratch/f-${slug}-1.png` });
  console.log(name, 'ready', ok, 'ms', open, 'title', await page.locator('.pn-reader__book').innerText().catch(()=>'?'), 'status', await page.locator('.pn-reader__scrub-value').innerText().catch(()=>'?'));
  console.log(logs.slice(0, 8).join('\n'));
  await ctx.close();
}
await b.close();
