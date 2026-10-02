import test from 'node:test';
import assert from 'node:assert/strict';
import { protocolSwitchURL, protocolSwitchBlocked, connectionAdvice } from '../public/lib/connection.js';

test('protocol switch preserves path and tutorial choices without transferring credentials', () => {
  assert.equal(protocolSwitchURL('https://test.iosignal.net/path?board=iris&preset=iris&authKey=secret#secret'), 'http://test.iosignal.net/path?board=iris&preset=iris&transport=http');
  assert.equal(protocolSwitchURL('http://localhost:8080/?board=c3'), 'https://localhost:8080/?board=c3&transport=https');
});
test('HTTPS WS advice covers both loopback and LAN without rejecting the connection', () => {
  for (const host of ['localhost', '127.0.0.1', '192.168.1.10', 'example.com']) {
    assert.match(connectionAdvice('https:', `ws://${host}:7777`), /제한될 수/);
  }
  assert.equal(connectionAdvice('https:', 'wss://io.remocon.kr/ws'), '');
  assert.match(connectionAdvice('http:', 'ws://192.168.1.10:7777'), /로컬 네트워크/);
});

test('HTTP navigation upgraded to HTTPS is detected without confusing a successful switch', () => {
  assert.equal(protocolSwitchBlocked('https://test.iosignal.net/?transport=http'), true);
  assert.equal(protocolSwitchBlocked('http://test.iosignal.net/?transport=http'), false);
  assert.equal(protocolSwitchBlocked('https://test.iosignal.net/?transport=https'), false);
  assert.equal(protocolSwitchBlocked('https://test.iosignal.net/'), false);
});
