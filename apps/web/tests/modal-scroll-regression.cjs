// Shared Modal verification, isolated from accounts and API fixtures. Vite must be running.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5192';
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/styles/global.css"></head><body><div style="height:1600px"></div><div id="test-root"></div><div style="height:900px"></div>
<script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
const {createRoot}=ReactDOM;
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window);
window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type;
window.__vite_plugin_react_preamble_installed__=true;
const {Modal}=await import('/src/components/UI.tsx');
const h=React.createElement;
function Harness() {
 const [open,setOpen]=React.useState(false),[nested,setNested]=React.useState(false);
 return h(React.Fragment,null,h('button',{onClick:()=>setOpen(true)},'Abrir modal'),h(Modal,{open,title:'Primeiro modal',onClose:()=>setOpen(false)},h('p',null,'Conteúdo do modal'),h('button',{onClick:()=>setNested(true)},'Abrir sobreposto'),h(Modal,{open:nested,title:'Segundo modal',onClose:()=>setNested(false)},'Conteúdo sobreposto')));
}
const root=createRoot(document.getElementById('test-root')); root.render(h(React.StrictMode,null,h(Harness)));
window.unmountHarness=()=>root.unmount();
</script></body></html>`;
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
  for (const width of [320, 390, 760, 1366]) {
   const context = await browser.newContext({ viewport: { width, height: 650 }, hasTouch: width <= 760 });
   const page = await context.newPage();
   const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.route('**/__audit-modal', route => route.fulfill({ contentType: 'text/html', body: html }));
   await page.goto(base + '/__audit-modal');
   const trigger = page.getByRole('button', { name: 'Abrir modal', exact: true });
   await trigger.scrollIntoViewIfNeeded();
   const y = await page.evaluate(() => scrollY);
   await trigger.click();
   await page.getByRole('dialog', { name: 'Primeiro modal', exact: true }).waitFor();
   assert.equal(await page.evaluate(() => scrollY), y);
   await page.getByRole('button', { name: 'Abrir sobreposto' }).click();
   await page.getByRole('dialog', { name: 'Segundo modal', exact: true }).waitFor();
   assert.equal(await page.evaluate(() => scrollY), y);
   await page.keyboard.press('Escape');
   assert.equal(await page.getByRole('dialog').count(), 1);
   assert.equal(await page.evaluate(() => document.documentElement.style.overflow), 'hidden');
   await page.keyboard.press('Escape');
   assert.equal(await page.getByRole('dialog').count(), 0);
   assert.equal(await page.evaluate(() => scrollY), y);
   assert.equal(await trigger.evaluate(e => e === document.activeElement), true, 'focus returns to opener');
   await trigger.click();
   await page.evaluate(() => window.unmountHarness());
   assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '', 'unmount releases scroll');
   assert.equal(await page.evaluate(() => scrollY), y);
   await page.mouse.move(width / 2, 400); await page.mouse.wheel(0, 150);
   await page.waitForFunction(previous => scrollY > previous, y);
   if (width <= 760) {
    const cdp = await context.newCDPSession(page);
    const previous = await page.evaluate(() => scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: width / 2, y: 500 }] });
    for (let dy = 0; dy < 200; dy += 25) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: width / 2, y: 500 - dy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(previous => scrollY > previous, previous);
    await cdp.detach();
   }
   assert.deepEqual(errors, []);
   console.log('PASS shared Modal', width, 'scroll preserved, nested Escape, focus, unmount, wheel/touch');
   await context.close();
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
