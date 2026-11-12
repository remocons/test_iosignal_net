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
