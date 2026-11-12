// Improv Wi-Fi Serial (https://www.improv-wifi.com/serial/): packets between this page and a board over USB.
// Packet: "IMPROV", version 1, type, length, data, checksum (sum of all previous bytes). The page adds '\n'.

export const TYPE = { STATE: 1, ERROR: 2, RPC: 3, RESULT: 4 };
export const STATE = { 2: 'ready', 3: 'provisioning', 4: 'provisioned' };
export const ERROR = { 0: '', 1: 'invalid', 2: 'unknown-command', 3: 'unable-to-connect', 5: 'bad-hostname', 255: 'unknown' };
export const COMMAND = { WIFI: 1, STATE: 2, INFO: 3, SCAN: 4, GET_SETTINGS: 0xa0, SET_SETTINGS: 0xa1 };

const HEADER = [73, 77, 80, 82, 79, 86]; // "IMPROV"
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function packet(type, data = []) {
  const body = [...HEADER, 1, type, data.length, ...data];
  return Uint8Array.from([...body, body.reduce((a, b) => a + b, 0) & 0xff, 10]);
}

export function rpc(command, data = []) {
  return packet(TYPE.RPC, [command, data.length, ...data]);
}

// Wi-Fi settings command. Throws when the SSID is not 1-32 bytes or the password over 64 bytes.
export function wifiSettings(ssid, password) {
  const s = encoder.encode(ssid);
  const p = encoder.encode(password);
  if (s.length < 1 || s.length > 32) throw new RangeError('Wi-Fi 이름은 1~32바이트여야 합니다.');
  if (p.length > 64) throw new RangeError('비밀번호는 64바이트까지입니다.');
  return rpc(COMMAND.WIFI, [s.length, ...s, p.length, ...p]);
}

// RPC result data: command, total length, then length-prefixed strings.
export function decodeResult(data) {
  const strings = [];
  let at = 2;
  const end = Math.min(data.length, 2 + (data[1] ?? 0));
  while (at < end) {
    const len = data[at++];
    strings.push(decoder.decode(Uint8Array.from(data.slice(at, at + len))));
    at += len;
  }
  return { command: data[0], strings };
}

// Splits a byte stream into Improv packets and text lines (the board's own log output).
// push() returns events: { kind: 'packet', type, data } or { kind: 'text', text }.
export class Parser {
  constructor() { this.buf = []; this.text = []; }

  push(bytes) {
    const events = [];
    for (const b of bytes) {
      this.buf.push(b);
      // Keep only a prefix that can still become a packet; the rest is log text.
      while (this.buf.length && !this.#maybePacket()) this.#toText(this.buf.shift(), events);
      const p = this.#complete();
      if (p) {
        this.buf = [];
        if (p.ok) events.push({ kind: 'packet', type: p.type, data: p.data });
      }
    }
    return events;
  }

  // Lines still waiting for '\n'.
  flush() {
    const text = decoder.decode(Uint8Array.from(this.text));
    this.text = [];
    return text;
  }

  #maybePacket() {
    const b = this.buf;
    for (let i = 0; i < Math.min(b.length, 6); i++) if (b[i] !== HEADER[i]) return false;
    return b.length < 7 || b[6] === 1;
  }

  #complete() {
    const b = this.buf;
    if (b.length < 9 || b.length < 10 + b[8]) return null;
    const sum = b.slice(0, 9 + b[8]).reduce((a, x) => a + x, 0) & 0xff;
    return { ok: sum === b[9 + b[8]], type: b[7], data: b.slice(9, 9 + b[8]) };
  }

  #toText(byte, events) {
    if (byte === 10) {
      const text = decoder.decode(Uint8Array.from(this.text)).replace(/\r$/, '');
      this.text = [];
      if (text) events.push({ kind: 'text', text });
    } else this.text.push(byte);
  }
}

// IOSignal server and device key (commands 0xA0 / 0xA1, IOSignalWiFi only).
// Each value: undefined = leave as it is, '' = clear (the sketch value is used again), text = store.
const HOST = /^[A-Za-z0-9][A-Za-z0-9.-]{0,62}$/;
const KEY = /^[!-~]{1,8}\.[!-~]+$/;

export function checkSettings({ host, port, key } = {}) {
  if (host && !HOST.test(host)) return '서버 주소는 영문, 숫자, 점(.), 하이픈(-)으로 63자까지입니다.';
  if (port && (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65535)) return '포트는 1~65535입니다.';
  if (key && (!KEY.test(key) || key.indexOf('.') > 8 || encoder.encode(key).length > 64)) return '장치 키는 id.key 형식입니다. id는 8자까지, 전체 64자까지, 공백 없이 씁니다.';
  return '';
}

export function settingsUpdate(values) {
  const problem = checkSettings(values);
  if (problem) throw new RangeError(problem);
  const data = [];
  [[1, values.host], [2, values.port], [3, values.key]].forEach(([field, value]) => {
    if (value === undefined) return;
    const bytes = encoder.encode(String(value));
    data.push(field, bytes.length, ...bytes);
  });
  if (!data.length) throw new RangeError('바꿀 값이 없습니다.');
  return rpc(COMMAND.SET_SETTINGS, data);
}

// One "server" field: "host" or "host:port". A web address is refused: the board speaks IOSignal TCP.
// Returns { host, port } for settingsUpdate (port '' = the sketch's port), or throws RangeError.
export function parseServer(text) {
  const value = String(text).trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.includes('/')) {
    throw new RangeError('보드는 웹소켓이 아니라 IOSignal TCP 포트로 접속합니다. ws://, https:// 없이 호스트:포트로 쓰세요(보통 55488).');
  }
  const m = /^([^:]+)(?::(\d*))?$/.exec(value);
  if (!m) throw new RangeError('서버는 호스트 또는 호스트:포트로 씁니다. 예: io.remocon.kr:55488');
  const host = m[1];
  const port = m[2] ?? '';
  if (m[2] === '') throw new RangeError('콜론(:) 뒤에 포트를 쓰세요. 예: io.remocon.kr:55488');
  const problem = checkSettings({ host, port: port || undefined });
  if (problem) throw new RangeError(problem);
  return { host, port };
}

// Result strings of 0xA0 / 0xA1: host, host source, port, port source, key state, storage.
export function decodeSettings([host, hostSource, port, portSource, keyState = 'none', storage = 'none']) {
  const [keySource, keyId] = keyState === 'none' ? ['none', ''] : keyState.split(/:(.*)/s);
  return { host, hostSource, port: Number(port), portSource, keySource, keyId, storage: storage === 'ok' };
}
