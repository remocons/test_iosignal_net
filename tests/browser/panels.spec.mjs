import { test, expect } from '@playwright/test';
import { IO } from 'iosignal';

// The local IOSignal server started by playwright.config.mjs (npm run dev, WS_PORT 17777).
const SERVER = 'ws://127.0.0.1:17777';
const clients = [];
test.afterEach(() => { for (const io of clients.splice(0)) { io.stop(); io.socket?.terminate?.(); } });

async function client() {
  const io = new IO(); io.on('error', () => {}); clients.push(io);
  const ready = new Promise((resolve) => io.once('ready', resolve)); io.open(SERVER); await ready;
  return io;
}

// A board that follows the device rules: answers #search, keeps $panel/$info/$state, applies key=value.
async function board(info, { panel, state = {} } = {}) {
  const io = await client();
  const received = [];
  const publish = () => io.signal('@$state', Object.entries(state).map(([k, v]) => `${k}=${v}`).join(';'));
  io.subscribe('#search');
  io.on('#search', () => io.signal('#notify', io.cid));
  if (panel) io.signal('@$panel', JSON.stringify(panel));
  io.signal('@$info', info); publish(); io.signal('#notify', io.cid);
  io.on('@', (tag, cmd) => {
    if (tag !== '@') return;
    received.push(cmd);
    if (cmd === 'on' || cmd === 'off') state.on = cmd === 'on' ? '1' : '0';
    else if (cmd === 'toggle') state.on = state.on === '1' ? '0' : '1';
    else if (cmd.includes('=')) state[cmd.split('=')[0]] = cmd.split('=')[1];
    publish();
  });
  return { io, received };
}

async function open(page, url) {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.locator('#panelServer').fill(SERVER);
  await page.getByRole('button', { name: '연결', exact: true }).click();
  await expect(page.locator('#panelConnection')).toHaveText('ready');
  return errors;
}

test('device panel finds the board by type and draws its official screen', async ({ page }) => {
  const lamp = await board('n=D1-mini;g=HOME;t=light.1', { state: { on: '0' } });
  await board('n=Other;t=switch2.1', { state: { s1: '0' } });
  const errors = await open(page, '/examples/remocon/esp8266-d1-mini/');
  await expect(page.locator('#deviceFound')).toContainText('1대');
  await expect(page.locator('#deviceFound')).toContainText('다른 장치 1대');
  await expect(page.locator('#screenSource')).toHaveText('공식 타입 light.1');
  const power = page.getByRole('switch', { name: '전원' });
  await expect(power).not.toBeChecked();
  await power.click();
  await expect.poll(() => lamp.received).toEqual(['on']);
  await expect(power).toBeChecked();
  await page.getByRole('button', { name: '토글', exact: true }).click();
  await expect(power).not.toBeChecked();
  await page.screenshot({ path: 'test-results/panel-device.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('a board with p=1 replaces the screen with its own $panel', async ({ page }) => {
  const panel = { schema: 1, title: 'Relay Control', controls: [
    { widget: 'text', label: 'Target CID', key: 'target', cmd: 'target={v}', maxLength: 12 },
    { widget: 'value', label: 'Relays 1-4', key: 'relays' },
  ] };
  const controller = await board('n=Relay Control;ui=r1,r2,r3,r4,all;p=1', { panel, state: { target: 'the-cid', relays: '0000' } });
  const errors = await open(page, '/examples/remocon/Remocon8266-4ch-control/');
  await expect(page.locator('#screenSource')).toHaveText('보드가 보낸 화면($panel)');
  await expect(page.getByRole('textbox', { name: 'Target CID' })).toHaveValue('the-cid');
  await page.getByRole('textbox', { name: 'Target CID' }).fill('2001');
  await page.getByRole('button', { name: '보내기' }).click();
  await expect.poll(() => controller.received).toEqual(['target=2001']);
  await page.screenshot({ path: 'test-results/panel-own-screen.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('group panel rewrites the shared state; channel panel sends and receives', async ({ page }) => {
  const member = await client();
  const states = [];
  member.subscribe('#switch$state');
  member.on('#switch$state', (tag, value) => states.push(value));
  const errors = await open(page, '/examples/remocon/wifi-simple/');
  await page.getByRole('switch', { name: '2번' }).click();
  await expect.poll(() => states).toContain('s2=1');
  await page.getByRole('switch', { name: '1번' }).click();
  await expect.poll(() => states).toContain('s2=1;s1=1');

  const txrx = await client();
  const got = [];
  txrx.subscribe('#homeButton');
  txrx.on('#homeButton', (tag, value) => got.push(value));
  errors.push(...await open(page, '/examples/iosignal/esp8266_channel_txrx/'));
  await page.getByRole('button', { name: '신호 보내기' }).click();
  await expect.poll(() => got).toContain('browser');
  txrx.signal('#homeButton', 'esp8266');
  await expect(page.locator('#channelReceived')).toContainText('"esp8266"');
  expect(errors).toEqual([]);
});
