// Improv Wi-Fi Serial (https://www.improv-wifi.com/serial/): packets between this page and a board over USB.
// Packet: "IMPROV", version 1, type, length, data, checksum (sum of all previous bytes). The page adds '\n'.

export const TYPE = { STATE: 1, ERROR: 2, RPC: 3, RESULT: 4 };
export const STATE = { 2: 'ready', 3: 'provisioning', 4: 'provisioned' };
export const ERROR = { 0: '', 1: 'invalid', 2: 'unknown-command', 3: 'unable-to-connect', 5: 'bad-hostname', 255: 'unknown' };
export const COMMAND = { WIFI: 1, STATE: 2, INFO: 3, SCAN: 4 };

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
