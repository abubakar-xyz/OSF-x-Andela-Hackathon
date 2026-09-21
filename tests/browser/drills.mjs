/**
 * Failure drills, driven in a real browser.  DESIGN.md §32.
 *
 * DEMO_SCRIPT.md claims these six behaviours on stage, so they are
 * asserted rather than trusted. This needs a browser, so it is NOT part
 * of `npm run check` — run it with:
 *
 *     npm install && npm run verify:drills
 *
 * A team that can demo its own failure modes is the team the judges
 * believe; a team that claims them without checking is not.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const ROOT='/home/user/OSF-x-Andela-Hackathon';
const M={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(q,r)=>{let b;try{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
const f=join(ROOT,normalize(u).replace(/^(\.\.[/\\])+/,''));b=await readFile(f);
r.writeHead(200,{'Content-Type':M[extname(f)]??'text/plain'});}catch{r.writeHead(404);r.end('');return;}r.end(b);});
await new Promise(r=>server.listen(4176,r));
const browser=await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});

const fresh = async (opts={}) => {
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, ...opts });
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))errs.push(m.text());});
  await page.goto('http://localhost:4176/',{waitUntil:'networkidle'});
  await page.waitForTimeout(400);
  await page.locator('#cold button').first().click();
  await page.waitForTimeout(1100);
  return { page, ctx, errs };
};
const P=(n,ok,d='')=>console.log(`  ${ok?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`);
let bad=0; const chk=(n,ok,d)=>{P(n,ok,d); if(!ok)bad++;};

console.log('\nDrill 1 — nothing found is never disproof');
{
  const {page,ctx,errs}=await fresh();
  await page.locator('#typeBtn').click(); await page.waitForTimeout(300);
  await page.locator('.cap-edit').fill('Is the Kisumu flyover project finished?');
  await page.getByRole('button',{name:'Ask Wazi'}).click();
  await page.waitForTimeout(2500);
  const caps = await page.locator('.cap-line').allTextContents();
  const said = caps.join(' ');
  chk('says it cannot see it', /doesn.?t mean it isn.?t real|isn.?t where I can see/i.test(said), said.slice(-90));
  chk('never says it does not exist', !/does not exist|no such project|never built/i.test(said));
  chk('no page errors', errs.length===0, errs[0]);
  await ctx.close();
}

console.log('\nDrill 2 — offline still answers from the cached pack');
{
  const {page,ctx,errs}=await fresh();
  await ctx.setOffline(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(400);
  chk('machine enters offline', await page.evaluate(()=>__wazi.machine.state)==='offline');
  const said=(await page.locator('.cap-line').allTextContents()).join(' ');
  chk('says what it can still do', /can still work from what I.?ve saved|can.?t check for anything newer/i.test(said), said.slice(-80));
  await ctx.setOffline(false);
  chk('no page errors', errs.length===0, errs[0]);
  await ctx.close();
}

console.log('\nDrill 3 — wrong project offers the alternative');
{
  const {page,ctx,errs}=await fresh();
  await page.locator('#cameraBtn').click(); await page.waitForTimeout(300);
  await page.getByRole('button',{name:'Use this signboard'}).click(); await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Check this'}).click();
  await page.waitForFunction(()=>__wazi.machine.state==='evidence',null,{timeout:20000});
  await page.waitForTimeout(400);
  const has = await page.getByRole('button',{name:'Not this one?'}).count();
  chk('"Not this one?" offered', has>0);
  if (has) {
    await page.getByRole('button',{name:'Not this one?'}).click(); await page.waitForTimeout(400);
    const alts = await page.locator('.sheet .btn').count();
    chk('alternatives listed', alts>0, `${alts} alternative(s)`);
  }
  chk('no page errors', errs.length===0, errs[0]);
  await ctx.close();
}

console.log('\nDrill 4 — no verified contact means no contact offered');
{
  const {page,ctx,errs}=await fresh();
  const res = await page.evaluate(async()=>{
    const T = await import('/src/tools/index.js');
    const r = T.find_responsible_body('ent-usenge-water', __wazi.pack);
    return { ok:r.ok, reason:r.reason };
  });
  chk('refuses to route', res.ok===false, res.reason);
  chk('says why', /no verified contact route/i.test(res.reason||''));
  chk('no page errors', errs.length===0, errs[0]);
  await ctx.close();
}

console.log('\nDrill 5 — reduced motion turns motes into a checklist');
{
  const {page,ctx,errs}=await fresh({ reducedMotion:'reduce' });
  await page.locator('#cameraBtn').click(); await page.waitForTimeout(250);
  await page.getByRole('button',{name:'Use this signboard'}).click(); await page.waitForTimeout(350);
  await page.getByRole('button',{name:'Check this'}).click();
  await page.waitForFunction(()=>__wazi.machine.state==='evidence',null,{timeout:20000});
  await page.waitForTimeout(300);
  const list = await page.locator('#moteList li').count();
  chk('static checklist rendered', list>0, `${list} items`);
  const labels = await page.locator('#moteList li').allTextContents();
  chk('carries the same plain labels', labels.some(l=>/Checking the records|Matching the project|Reading the sign/.test(l)), labels[0]);
  chk('still reaches evidence', await page.evaluate(()=>__wazi.machine.state)==='evidence');
  chk('no page errors', errs.length===0, errs[0]);
  await ctx.close();
}

console.log('\nDrill 6 — export is unreachable without approval');
{
  const {page,ctx,errs}=await fresh();
  const r = await page.evaluate(async()=>{
    const { createMachine } = await import('/src/core/machine.js');
    const m = createMachine({ initial:'drafting', context:{ evidence:{sources:[{id:'s'}]}, route:{office:'x'} }});
    const direct = m.send('APPROVE');            // not in disclosure yet
    m.send('REVIEW');
    const viaDisclosure = m.send('APPROVE');
    return { direct: direct.ok, viaDisclosure: viaDisclosure.ok, state: m.state };
  });
  chk('cannot approve from drafting', r.direct===false);
  chk('can approve from disclosure', r.viaDisclosure===true && r.state==='export');
  chk('no page errors', errs.length===0, errs[0]);
  await ctx.close();
}

console.log(`\n${bad?bad+' check(s) failed':'all drills pass'}\n`);
await browser.close(); server.close(); process.exit(bad?1:0);
