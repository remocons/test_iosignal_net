import { test, expect } from '@playwright/test';
import { IO } from 'iosignal';

test('connection, typed messages, CID preset, group preset and mobile layout', async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#sendButton')).toBeDisabled();
  await page.locator('#serverURL').fill('ws://127.0.0.1:17777');
  await page.locator('#connectButton').click();
  await expect(page.locator('#ioStateName')).toHaveText('ready');
  await page.getByRole('button',{name:'버튼 이벤트',exact:true}).click();
  await expect(page.locator('#messageView')).toContainText('RX');
  await expect(page.locator('#messageView')).toContainText('string: "browser"');
  await page.locator('#payloadType').selectOption('empty');
  await page.locator('#sendButton').click();
  await expect(page.locator('#messageView')).toContainText('EMPTY (인자 없음)');
  await page.locator('#payloadType').selectOption('hex');
  await page.locator('#payload').fill('zz');
  await page.locator('#sendButton').click();
  await expect(page.locator('#notice')).toContainText('HEX');
  const device=new IO(); device.on('error',()=>{});
  try {
    const ready=new Promise(resolve=>device.once('ready',resolve)); device.open('ws://127.0.0.1:17777'); await ready;
    device.on('@',(tag,cmd)=>{if(tag==='@') device.signal('@$state',cmd);});
    await page.locator('#preset').selectOption('cid');
    await page.locator('#deviceCID').fill(device.cid);
    await page.locator('#useCID').click();
    await page.getByRole('button',{name:'on',exact:true}).click();
    await expect(page.locator('#messageView')).toContainText(`${device.cid}@$state`);
    await expect(page.locator('#messageView')).toContainText('string: "on"');
    await page.locator('#preset').selectOption('group');
    await page.getByRole('button',{name:'장치 1',exact:true}).click();
    await expect(page.locator('#messageView')).toContainText('#lab$states');
    await expect(page.locator('#messageView')).toContainText('string: "10"');
    await page.locator('#preset').selectOption('rgb');
    await page.getByRole('button',{name:'빨강',exact:true}).click();
    await expect(page.locator('#messageView')).toContainText('BINARY 4 bytes: ff 00 00 00');
    await page.screenshot({path:'test-results/workbench-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/workbench-mobile.png',fullPage:true});
    await page.locator('#closeButton').click(); await expect(page.locator('#sendButton')).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {device.stop();device.socket?.terminate?.();}
});
