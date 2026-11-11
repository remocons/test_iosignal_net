import { test, expect } from '@playwright/test';
import { IO } from 'iosignal';

test('home lists examples and an example page links to the lab', async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Remocon 예제/})).toBeVisible();
  await page.getByRole('link',{name:/ESP32 그룹 LED/}).click();
  await expect(page.locator('h1')).toHaveText('ESP32 그룹 LED');
  await expect(page.locator('#wiring table')).toBeVisible();
  await page.screenshot({path:'test-results/example-desktop.png',fullPage:true});
  await page.getByRole('link',{name:'웹 실습실에서 열기'}).click();
  await expect(page).toHaveURL(/\/lab\/\?preset=group/);
  await expect(page.locator('#sendTag')).toHaveValue('#lab$state');
  await expect(page.locator('#subscriptions')).toHaveValue('#lab$state');
  await page.goto('/?preset=cid');
  await expect(page).toHaveURL(/\/lab\/\?preset=cid/);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/examples/remocon/Remocon8266-4ch-control/');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/example-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('lab: connection, typed messages, CID template, group template and mobile layout', async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/lab/');
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
    await page.getByRole('button',{name:'1번만',exact:true}).click();
    await expect(page.locator('#messageView')).toContainText('#switch$state');
    await expect(page.locator('#messageView')).toContainText('string: "s1=1;s2=0;s3=0"');
    await page.locator('#preset').selectOption('motor');
    await page.getByRole('button',{name:'정지 (00 00 00 00)',exact:true}).click();
    await expect(page.locator('#messageView')).toContainText('BINARY 4 bytes: 00 00 00 00');
    await page.screenshot({path:'test-results/lab-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:'test-results/lab-mobile.png',fullPage:true});
    await page.locator('#closeButton').click(); await expect(page.locator('#sendButton')).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {device.stop();device.socket?.terminate?.();}
});
