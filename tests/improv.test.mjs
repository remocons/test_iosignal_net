import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMAND, Parser, TYPE, decodeResult, packet, rpc, wifiSettings } from '../public/lib/improv.js';

const ascii = (s) => [...Buffer.from(s)];

test('Wi-Fi settings match the specification example', () => {
  const p = wifiSettings('MyWirelessAP', 'mysecurepassword');
  assert.deepEqual([...p.slice(0, 11)], [...ascii('IMPROV'), 1, TYPE.RPC, 32, COMMAND.WIFI, 0x1e]);
  assert.deepEqual([...p.slice(11, 24)], [12, ...ascii('MyWirelessAP')]);
  const body = p.slice(0, -2);
  assert.equal(p.at(-2), body.reduce((a, b) => a + b, 0) & 0xff);
  assert.equal(p.at(-1), 10);
});

test('Wi-Fi settings refuse lengths the board cannot store', () => {
  assert.throws(() => wifiSettings('', 'x'), RangeError);
  assert.throws(() => wifiSettings('x'.repeat(33), ''), RangeError);
  assert.throws(() => wifiSettings('ok', 'x'.repeat(65)), RangeError);
  assert.equal(wifiSettings('한글와이파이', '').length, 10 + 2 + 1 + 18 + 1 + 1); // UTF-8 bytes
});

test('parser separates board log lines from packets', () => {
  const parser = new Parser();
  const state = packet(TYPE.STATE, [4]);
  const info = packet(TYPE.RESULT, [COMMAND.INFO, 12, 3, ...ascii('abc'), 1, ...ascii('1'), 2, ...ascii('C3'), 2, ...ascii('Hi')]);
  const stream = [...ascii('READY CID: k3x9\r\nIMPRO'), ...ascii('x\n'), ...state, ...info.slice(0, -1), ...ascii('tail')];
  const events = [];
  for (const b of stream) events.push(...parser.push([b])); // byte by byte
  assert.deepEqual(events.filter((e) => e.kind === 'text').map((e) => e.text), ['READY CID: k3x9', 'IMPROx']);
  const packets = events.filter((e) => e.kind === 'packet');
  assert.deepEqual(packets.map((e) => e.type), [TYPE.STATE, TYPE.RESULT]);
  assert.deepEqual(packets[0].data, [4]);
  assert.deepEqual(decodeResult(packets[1].data), { command: COMMAND.INFO, strings: ['abc', '1', 'C3', 'Hi'] });
  assert.equal(parser.flush(), 'tail');
});

test('parser drops a packet with a bad checksum and keeps going', () => {
  const parser = new Parser();
  const bad = packet(TYPE.STATE, [2]); bad[10] ^= 1;
  const events = parser.push([...bad, ...packet(TYPE.ERROR, [3])]);
  assert.deepEqual(events.filter((e) => e.kind === 'packet').map((e) => [e.type, ...e.data]), [[TYPE.ERROR, 3]]);
});

test('empty scan result ends the list', () => {
  assert.deepEqual(decodeResult([COMMAND.SCAN, 0]), { command: COMMAND.SCAN, strings: [] });
  assert.deepEqual([...rpc(COMMAND.SCAN)].slice(7, 11), [TYPE.RPC, 2, COMMAND.SCAN, 0]);
});

test('server settings: fields, clearing and validation', async () => {
  const { settingsUpdate, decodeSettings, checkSettings } = await import('../public/lib/improv.js');
  const p = settingsUpdate({ host: 'io.example.net', port: '7000', key: undefined });
  const data = [...p.slice(9, -2)];
  assert.deepEqual(data.slice(0, 2), [0xa1, 2 + 14 + 2 + 4]);
  assert.deepEqual(data.slice(2), [1, 14, ...ascii('io.example.net'), 2, 4, ...ascii('7000')]);
  // '' clears: field with length 0.
  assert.deepEqual([...settingsUpdate({ key: '' }).slice(9, -2)], [0xa1, 2, 3, 0]);
  assert.throws(() => settingsUpdate({}), RangeError);
  for (const bad of [{ host: 'bad host' }, { host: '-x' }, { port: '0' }, { port: '65536' }, { port: '08' },
    { key: 'nokey' }, { key: '123456789.k' }, { key: 'id.' }, { key: 'id.a b' }, { key: 'id.' + 'k'.repeat(62) }]) {
    assert.notEqual(checkSettings(bad), '', JSON.stringify(bad));
  }
  assert.equal(checkSettings({ host: '192.168.0.10', port: '65535', key: '12345678.' + 'k'.repeat(55) }), '');
  assert.deepEqual(decodeSettings(['io.remocon.kr', 'sketch', '55488', 'sketch', 'stored:dev1', 'ok']),
    { host: 'io.remocon.kr', hostSource: 'sketch', port: 55488, portSource: 'sketch', keySource: 'stored', keyId: 'dev1', storage: true });
  assert.equal(decodeSettings(['h', 'stored', '1', 'stored', 'none', 'none']).keySource, 'none');
});

test('one server field: host or host:port, never a web address', async () => {
  const { parseServer } = await import('../public/lib/improv.js');
  assert.deepEqual(parseServer(' 172.30.1.33:55488 '), { host: '172.30.1.33', port: '55488' });
  assert.deepEqual(parseServer('io.remocon.kr'), { host: 'io.remocon.kr', port: '' }); // port: the sketch's
  for (const bad of ['wss://io.remocon.kr/ws', 'http://172.30.1.33:19080', 'io.remocon.kr/ws', 'host:', 'host:0', 'host:65536', 'a:b:c', 'bad host:1', '']) {
    assert.throws(() => parseServer(bad), RangeError, bad);
  }
  assert.match((() => { try { parseServer('ws://x:1'); } catch (e) { return e.message; } })(), /TCP/);
});
