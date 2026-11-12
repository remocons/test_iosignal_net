// Sets Wi-Fi on an ESP32/ESP8266 board over USB (Web Serial + Improv Wi-Fi Serial).
import { COMMAND, ERROR, Parser, STATE, TYPE, decodeResult, decodeSettings, parseServer, rpc, settingsUpdate, wifiSettings } from '/lib/improv.js';

const $ = (id) => document.getElementById(id);
const ui = {
  connect: $('connect'), disconnect: $('disconnect'), reset: $('reset'), scan: $('scan'), save: $('save'),
  ssid: $('ssid'), password: $('password'), networks: $('networks'), form: $('wifiForm'),
  state: $('state'), deviceName: $('deviceName'), chip: $('chip'), firmware: $('firmware'),
  result: $('result'), log: $('serialLog'),
  serverSection: $('serverSection'), serverForm: $('serverForm'), server: $('server'), idKey: $('idKey'),
  clearKey: $('clearKey'), defaultServer: $('defaultServer'), applyServer: $('applyServer'), serverResult: $('serverResult'),
  currentServer: $('currentServer'), currentKey: $('currentKey'), noStorage: $('noStorage'),
};
const SOURCE = { stored: '브라우저에서 저장', sketch: '스케치 기본값' };
const STATE_TEXT = {
  ready: '연결됨 · Wi-Fi 미접속', provisioning: 'Wi-Fi 접속 시도 중…', provisioned: '연결됨 · Wi-Fi 접속됨',
};
const ERROR_TEXT = {
  invalid: '보드가 요청을 읽지 못했습니다.', 'unknown-command': '보드가 지원하지 않는 요청입니다.',
  'unable-to-connect': 'Wi-Fi에 접속하지 못했습니다. 이름과 비밀번호, 2.4GHz 여부를 확인하세요. 보드는 이전 설정으로 돌아갑니다.',
  unknown: '보드에서 알 수 없는 오류가 났습니다.',
};

let port = null;
let reader = null;
let parser = null;
let improvSeen = false;
let pending = null; // { command, resolve, reject, timer }
let scanRows = [];

if (!('serial' in navigator)) {
  $('unsupported').hidden = false;
  ui.connect.disabled = true;
}

function log(line) {
  ui.log.textContent += `${line}\n`;
  const lines = ui.log.textContent.split('\n');
  if (lines.length > 400) ui.log.textContent = lines.slice(-400).join('\n');
  ui.log.scrollTop = ui.log.scrollHeight;
}

function setConnected(on) {
  ui.connect.disabled = on || !('serial' in navigator);
  ui.disconnect.disabled = !on;
  ui.reset.disabled = !on;
  for (const el of [ui.scan, ui.save, ui.ssid, ui.password]) el.disabled = !on || !improvSeen;
}

function showState(name) {
  ui.state.textContent = STATE_TEXT[name] ?? name;
}

async function write(bytes) {
  const writer = port.writable.getWriter();
  try { await writer.write(bytes); } finally { writer.releaseLock(); }
}

// Sends an RPC and waits for the result (or an error state) from the board.
function request(command, data = [], timeout = 3000) {
  if (pending) pending.reject(new Error('다른 요청을 기다리는 중입니다.'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending = null; reject(new Error('timeout')); }, timeout);
    pending = { command, resolve, reject, timer };
    const bytes = data instanceof Uint8Array ? data : rpc(command, data); // a ready packet, or RPC data
    write(bytes).catch((err) => { clearTimeout(timer); pending = null; reject(err); });
  });
}

function settle(fn, value) {
  if (!pending) return;
  clearTimeout(pending.timer);
  const p = pending;
  pending = null;
  p[fn](value);
}

function onPacket(type, data) {
  if (!improvSeen) { improvSeen = true; setConnected(true); }
  if (type === TYPE.STATE) {
    const name = STATE[data[0]] ?? `state ${data[0]}`;
    showState(name);
    if (pending?.command === COMMAND.STATE) settle('resolve', name);
  } else if (type === TYPE.ERROR) {
    const name = ERROR[data[0]] ?? 'unknown';
    if (name && pending) settle('reject', new Error(name));
  } else if (type === TYPE.RESULT) {
    const { command, strings } = decodeResult(data);
    if (command === COMMAND.SCAN) {
      if (strings.length) { scanRows.push(strings); return; }
      if (pending?.command === COMMAND.SCAN) settle('resolve', scanRows);
    } else if (pending?.command === command) settle('resolve', strings);
  }
}

async function readLoop() {
  while (port?.readable) {
    reader = port.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const e of parser.push(value)) {
          if (e.kind === 'text') log(e.text);
          else onPacket(e.type, e.data);
        }
      }
    } catch (err) {
      log(`[읽기 오류] ${err.message}`);
    } finally {
      reader.releaseLock();
      reader = null;
    }
    if (!port) break;
  }
}

// The board may still be booting: ask for its state for up to 10 s.
async function hello() {
  for (let i = 0; i < 10 && port; i++) {
    try {
      showState(await request(COMMAND.STATE, [], 1000));
      const [firmware, version, chip, name] = await request(COMMAND.INFO);
      ui.deviceName.textContent = name || '—';
      ui.chip.textContent = chip || '—';
      ui.firmware.textContent = [firmware, version].filter(Boolean).join(' ') || '—';
      await loadSettings();
      return;
    } catch (err) {
      if (err.message !== 'timeout') { log(`[요청 오류] ${err.message}`); return; }
    }
  }
  if (port && !improvSeen) {
    ui.state.textContent = '응답 없음';
    ui.result.textContent = '보드가 Wi-Fi 설정 요청에 답하지 않습니다. IOSignalWiFi를 쓰는 스케치인지, 속도가 115200인지 확인하세요. 보드 재시작을 눌러 볼 수도 있습니다.';
  }
}

ui.connect.addEventListener('click', async () => {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
  } catch (err) {
    port = null;
    if (err.name !== 'NotFoundError') ui.result.textContent = `포트를 열지 못했습니다: ${err.message}`;
    return;
  }
  parser = new Parser();
  improvSeen = false;
  ui.result.textContent = '';
  ui.state.textContent = '응답 기다리는 중…';
  setConnected(true);
  readLoop();
  hello();
});

// IOSignal server and key (IOSignalWiFi firmware only; older firmware answers "unknown command").
function showSettings(st) {
  ui.currentServer.textContent = `${st.host}:${st.port} (${st.hostSource === 'stored' || st.portSource === 'stored' ? SOURCE.stored : SOURCE.sketch})`;
  ui.currentKey.textContent = st.keySource === 'none' ? '없음 · 익명 접속' : `id ${st.keyId} (${SOURCE[st.keySource] ?? st.keySource})`;
  ui.noStorage.hidden = st.storage;
  for (const el of [ui.server, ui.idKey, ui.clearKey, ui.defaultServer, ui.applyServer]) el.disabled = !st.storage;
  ui.clearKey.disabled ||= st.keySource !== 'stored';
}

async function loadSettings() {
  try {
    showSettings(decodeSettings(await request(COMMAND.GET_SETTINGS)));
    ui.serverSection.hidden = false;
  } catch (err) {
    ui.serverSection.hidden = true;
    if (err.message !== 'unknown-command' && err.message !== 'timeout') log(`[서버 설정 읽기 오류] ${err.message}`);
  }
}

// The board restarts after a change; ask again once it is back.
async function applySettings(values) {
  let bytes;
  try { bytes = settingsUpdate(values); } catch (err) { ui.serverResult.textContent = err.message; return; }
  ui.applyServer.disabled = true;
  ui.serverResult.textContent = '보드에 보냈습니다…';
  try {
    const st = decodeSettings(await request(COMMAND.SET_SETTINGS, bytes, 5000));
    showSettings(st);
    ui.server.value = '';
    ui.serverResult.textContent = '저장했습니다. 보드가 재시작합니다. 시리얼 로그에서 접속을 확인하세요.';
    ui.state.textContent = '재시작 중…';
    setTimeout(() => { if (port) hello(); }, 3000);
  } catch (err) {
    ui.serverResult.textContent = err.message === 'timeout' ? '보드가 응답하지 않습니다.'
      : err.message === 'invalid' ? '보드가 값을 받지 않았습니다. 형식을 확인하세요.'
      : err.message === 'unknown' ? '보드가 저장하지 못했습니다.' : (ERROR_TEXT[err.message] ?? err.message);
  } finally {
    ui.idKey.value = '';
    ui.clearKey.checked = false;
    ui.applyServer.disabled = !port;
  }
}

ui.serverForm.addEventListener('submit', (event) => {
  event.preventDefault();
  let values = {};
  if (ui.server.value.trim()) {
    try { values = parseServer(ui.server.value); } catch (err) { ui.serverResult.textContent = err.message; return; }
  }
  if (ui.clearKey.checked) values.key = '';
  else if (ui.idKey.value) values.key = ui.idKey.value;
  applySettings(values);
});

ui.defaultServer.addEventListener('click', () => {
  ui.server.value = '';
  applySettings({ host: '', port: '' });
});

async function close() {
  const p = port;
  port = null;
  settle('reject', new Error('closed'));
  try { await reader?.cancel(); } catch { /* already closed */ }
  try { await p?.close(); } catch { /* already closed */ }
  improvSeen = false;
  setConnected(false);
  ui.state.textContent = '미연결';
  for (const el of [ui.deviceName, ui.chip, ui.firmware]) el.textContent = '—';
  ui.serverSection.hidden = true;
}

ui.disconnect.addEventListener('click', close);
navigator.serial?.addEventListener('disconnect', (e) => { if (e.target === port) close(); });

// EN is pulled low while RTS is set on boards with the usual auto-reset circuit.
ui.reset.addEventListener('click', async () => {
  try {
    await port.setSignals({ dataTerminalReady: false, requestToSend: true });
    await new Promise((r) => setTimeout(r, 120));
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    log('[보드 재시작 신호를 보냈습니다]');
    improvSeen = false;
    setConnected(true);
    ui.state.textContent = '응답 기다리는 중…';
    setTimeout(hello, 800);
  } catch (err) {
    log(`[재시작 실패] ${err.message}`);
  }
});

ui.scan.addEventListener('click', async () => {
  ui.scan.disabled = true;
  ui.result.textContent = '주변 Wi-Fi를 찾는 중…';
  scanRows = [];
  try {
    const rows = await request(COMMAND.SCAN, [], 15000);
    const best = new Map();
    for (const [ssid, rssi, auth] of rows) {
      if (!best.has(ssid) || Number(rssi) > Number(best.get(ssid).rssi)) best.set(ssid, { rssi, auth });
    }
    ui.networks.replaceChildren(...[...best].sort((a, b) => b[1].rssi - a[1].rssi).map(([ssid, { rssi, auth }]) => {
      const option = document.createElement('option');
      option.value = ssid;
      option.label = `${rssi} dBm${auth === 'YES' ? ' · 암호' : ' · 개방'}`;
      return option;
    }));
    ui.result.textContent = `${best.size}개를 찾았습니다. 이름 칸에서 고르세요.`;
  } catch (err) {
    ui.result.textContent = err.message === 'timeout' ? '찾기 응답이 없습니다.' : (ERROR_TEXT[err.message] ?? err.message);
  } finally {
    ui.scan.disabled = !port;
  }
});

ui.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  let bytes;
  try { bytes = wifiSettings(ui.ssid.value, ui.password.value); } catch (err) { ui.result.textContent = err.message; return; }
  ui.save.disabled = true;
  ui.result.textContent = '보드에 보냈습니다. 접속을 확인하는 중… (최대 20초)';
  try {
    const urls = await request(COMMAND.WIFI, bytes, 30000);
    ui.result.textContent = `“${ui.ssid.value}”에 접속했습니다. 보드가 저장했으므로 다음 부팅부터 이 Wi-Fi를 씁니다.`;
    if (urls[0]) {
      const a = document.createElement('a');
      a.href = urls[0]; a.textContent = ' 장치 페이지 열기'; a.target = '_blank'; a.rel = 'noreferrer';
      ui.result.append(a);
    }
    ui.password.value = '';
  } catch (err) {
    ui.result.textContent = err.message === 'timeout' ? '보드가 응답하지 않습니다.' : (ERROR_TEXT[err.message] ?? err.message);
  } finally {
    ui.save.disabled = !port;
  }
});

$('clearLog').addEventListener('click', () => { ui.log.textContent = ''; });
