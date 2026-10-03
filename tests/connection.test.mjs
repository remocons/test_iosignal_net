import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionAdvice } from '../public/lib/connection.js';

test('HTTPS WS advice covers both loopback and LAN without rejecting the connection', () => {
  for (const host of ['localhost', '127.0.0.1', '192.168.1.10', 'example.com']) {
    assert.match(connectionAdvice('https:', `ws://${host}:7777`), /차단될 수/);
  }
  assert.equal(connectionAdvice('https:', 'wss://io.remocon.kr/ws'), '');
  assert.match(connectionAdvice('http:', 'ws://192.168.1.10:7777'), /로컬 네트워크/);
});
