import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCommand, formatState, matches, normalizeScreen, parseInfo, parseState, screenFromUi, textCommand } from '../public/lib/control.js';
import { loadExamples, loadTypes, panelConfig, renderExample } from '../scripts/site/pages.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');

test('info: short keys, long keys of older boards, JSON, p=1', () => {
  assert.deepEqual(parseInfo('n=Lamp;g=HOME;t=light.1'), { name: 'Lamp', group: 'HOME', type: 'light.1', hasPanel: false });
  assert.equal(parseInfo('name=Old;type=remocon/switch2/v1').type, 'switch2.1');
  assert.equal(parseInfo('n=New;name=Old').name, 'New');
  assert.equal(parseInfo('{"name":"J","ui":"on,off"}').ui, 'on,off');
  assert.equal(parseInfo('n=Relay Control;ui=r1,all;p=1').hasPanel, true);
  assert.deepEqual(parseInfo('{bad'), {});
});

test('matching: the type decides, the name when there is no type', () => {
  assert.ok(matches({ type: 'light.1' }, { name: 'x', type: 'light.1' }));
  assert.ok(!matches({ type: 'light.1' }, { name: 'x', type: 'switch2.1' }));
  assert.ok(matches({ name: 'ESP32-LED' }, { name: 'ESP32-LED' }));
  assert.ok(!matches({ name: 'ESP32-LED' }, {}));
});

test('state and group commands', () => {
  assert.deepEqual(parseState('on=1;level=70'), { _: 'on=1;level=70', on: '1', level: '70' });
  assert.equal(formatState(applyCommand(parseState('s1=0;s2=1'), 's1=1')), 's1=1;s2=1');
  assert.equal(formatState(applyCommand({ r1: '0', r2: '1' }, 'all=1')), 'r1=1;r2=1');
  assert.equal(formatState(applyCommand({ on: '1' }, 'toggle')), 'on=0');
  assert.equal(formatState(applyCommand({ s1: '0' }, 's1=1;s2=1')), 's1=0');
});

test('screens: unknown widgets and bad values are dropped, text keeps its limits', () => {
  const screen = normalizeScreen(JSON.stringify({ schema: 1, title: 'T', controls: [
    { widget: 'switch', label: '<b>x</b>', key: 'on' },
    { widget: 'script', src: 'x' },
    { widget: 'button' },
    { widget: 'slider', key: 'b', min: 10, max: 5 },
    { widget: 'section', label: 'S', children: [{ widget: 'text', key: 'target', cmd: 'target={v}', maxLength: 12 }] },
  ] }));
  assert.deepEqual(screen.controls.map((c) => c.widget), ['switch', 'section']);
  assert.equal(screen.controls[0].label, '<b>x</b>'); // drawn as text, never as HTML
  assert.equal(normalizeScreen({ schema: 2, controls: [] }), null);
  assert.equal(normalizeScreen('not json'), null);
  const text = screen.controls[1].children[0];
  assert.deepEqual(textCommand(text, ' 2001 '), { ok: true, command: 'target=2001' });
  assert.equal(textCommand(text, 'a;b').ok, false);
  assert.equal(textCommand(text, 'x'.repeat(13)).ok, false);
  assert.deepEqual(screenFromUi('on,off').controls[0].options.map((o) => o.value), ['on', 'off']);
});

test('every official type the examples use is a valid screen, and panels pick the right mode', () => {
  const types = loadTypes(path.join(root, 'types'));
  for (const [name, type] of Object.entries(types)) assert.ok(normalizeScreen(type), name);
  const examples = Object.fromEntries(loadExamples(path.join(root, 'examples')).map((ex) => [ex.name, ex]));
  const config = (name) => panelConfig(examples[name], types);
  assert.deepEqual(config('esp8266-d1-mini').target, { type: 'light.1' });
  assert.equal(config('esp8266-d1-mini').mode, 'device');
  assert.deepEqual(config('esp32-cid-led').target, { name: 'ESP32-LED' });
  assert.equal(config('Remocon8266-4ch-control').hasPanel, true);
  assert.equal(config('wifi-simple').mode, 'group');
  assert.equal(config('wifi-simple').channel, '#switch');
  assert.equal(config('esp8266_channel_txrx').channel.tag, '#homeButton');
  assert.equal(config('iris-basic-control'), null);
  assert.ok(renderExample(examples['esp8266-d1-mini'], types).includes('/example/panel.js'));
  assert.ok(!renderExample(examples['iris-basic-control'], types).includes('id="try"'));
  assert.ok(!renderExample(examples['esp8266-d1-mini'], types).includes('</script></script>'));
});
