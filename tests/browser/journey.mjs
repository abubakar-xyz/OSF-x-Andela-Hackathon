/**
 * The full journey, driven in a real browser.  DESIGN.md §32.
 *
 * Cold start -> camera -> clue review -> verification -> Two Truths ->
 * Check Again -> routing -> Draft Studio -> Disclosure Review -> share
 * image. Fails on ANY console error.
 *
 *     npm install && npm run verify:journey
 *     SHOTS=./shots npm run verify:journey   # also writes screenshots
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = process.env.SHOTS;
const shot = async (page, name) => { if (!SHOTS) return; await page.screenshot({ path: `${SHOTS}/${name}.png` }); console.log(`  shot: ${name}`); };
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(4173, r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const step = (name) => shot(page, name);

console.log('1. cold start');
console.log('   invite:', (await page.locator('#cold p').first().textContent())?.slice(0,60));
await step('01-cold');

// The one-time tap. getUserMedia is unavailable headless without flags → DENIED path.
await page.locator('#cold button').first().click();
await page.waitForTimeout(1400);
console.log('2. home  | state:', await page.evaluate(() => __wazi.machine.state));
console.log('   caption:', (await page.locator('.cap-line').first().textContent())?.slice(0,70));
console.log('   chips:', await page.locator('#chipHost .chip').count());
await step('02-home');

console.log('3. camera → fixture');
await page.locator('#cameraBtn').click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Use this signboard' }).click();
await page.waitForTimeout(700);
console.log('   state:', await page.evaluate(() => __wazi.machine.state));
console.log('   clue rows:', await page.locator('.clue').count());
await step('03-clues');

console.log('4. verify (motes run)');
await page.getByRole('button', { name: 'Check this' }).click();
await page.waitForTimeout(900);
await step('04-verifying');
await page.waitForFunction(() => __wazi.machine.state === 'evidence', null, { timeout: 20000 });
await page.waitForTimeout(500);
const verdict = await page.locator('.tt__verdict .state span').last().textContent();
console.log('   state:', await page.evaluate(() => __wazi.machine.state), '| verdict:', verdict);
console.log('   differ items:', await page.locator('.tt__list--differ li').count());
await step('05-twotruths');

console.log('5. check again');
await page.getByRole('button', { name: 'Check again' }).click();
await page.waitForTimeout(2200);
const v2 = await page.locator('.tt__verdict .state span').last().textContent();
const was = await page.locator('.tt__was').count();
console.log('   verdict now:', v2, '| "was" shown:', was > 0);
await step('06-overturned');

console.log('6. take action');
await page.getByRole('button', { name: 'Take action' }).click();
await page.waitForTimeout(2000);
console.log('   state:', await page.evaluate(() => __wazi.machine.state));
console.log('   office:', await page.locator('.card__title').first().textContent());
await step('07-draft');

console.log('7. disclosure');
await page.getByRole('button', { name: 'Review what’s shared' }).click();
await page.waitForTimeout(600);
console.log('   state:', await page.evaluate(() => __wazi.machine.state));
console.log('   rows:', await page.locator('.disc__row').count());
await step('08-disclosure');

console.log('8. share image renders');
const png = await page.evaluate(async () => {
  const { renderShareImage } = await import('/src/components/shareImage.js');
  const c = renderShareImage(__wazi.payload, { caseId: __wazi.caseId });
  return { w: c.width, h: c.height, data: c.toDataURL('image/png').length };
});
console.log('   canvas:', png.w + 'x' + png.h, '| bytes(b64):', png.data);

console.log('\nconsole errors:', errors.length);
for (const e of errors.slice(0, 12)) console.log('  ✗', e);

await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
