// Board settings over USB (Web Serial + Improv Wi-Fi Serial): Wi-Fi, IOSignal server and key,
// and the sketch's own settings that an IOSignalConfig board lists.
import { COMMAND, ERROR, Parser, STATE, TYPE, appUpdate, checkAppValue, decodeAppRow, decodeResult, decodeSettings, parseServer, rpc, settingsUpdate, wifiSettings } from '/lib/improv.js';

const $ = (id) => document.getElementById(id);
const ui = {
  connect: $('connect'), disconnect: $('disconnect'), reset: $('reset'), scan: $('scan'), save: $('save'),
  ssid: $('ssid'), password: $('password'), networks: $('networks'), form: $('wifiForm'),
  state: $('state'), deviceName: $('deviceName'), chip: $('chip'), firmware: $('firmware'),
  result: $('result'), log: $('serialLog'),
  serverSection: $('serverSection'), serverForm: $('serverForm'), server: $('server'), idKey: $('idKey'),
  clearKey: $('clearKey'), defaultServer: $('defaultServer'), applyServer: $('applyServer'), serverResult: $('serverResult'),
  currentServer: $('currentServer'), currentKey: $('currentKey'), noStorage: $('noStorage'),
  appSection: $('appSection'), appForm: $('appForm'), appFields: $('appFields'), applyApp: $('applyApp'), appResult: $('appResult'),
};
// Commands whose answer is several results ended by an empty one.
const LIST_COMMANDS = new Set([COMMAND.SCAN, COMMAND.LIST_APP, COMMAND.SET_APP]);
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
let listRows = [];  // rows of the list command being answered
let appRows = [];   // the sketch settings last listed by the board

if (!('serial' in navigator)) {
  $('unsupported').hidden = false;
  ui.connect.disabled = true;
}

// The board prints this right before it restarts after saving settings.
function onLogLine(line) {
  log(line);
  if (line.includes('settings saved, restarting')) {
    ui.state.textContent = '재시작 중…';
    setTimeout(() => { if (port) hello(); }, 3000);
  }
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
    if (LIST_COMMANDS.has(command)) listRows = [];
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
    if (LIST_COMMANDS.has(command)) {
      if (strings.length) { listRows.push(strings); return; }
      if (pending?.command === command) settle('resolve', listRows);
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
          if (e.kind === 'text') onLogLine(e.text);
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
      await loadApp();
      return;
    } catch (err) {
      if (err.message !== 'timeout') { log(`[요청 오류] ${err.message}`); return; }
    }
  }
  if (port && !improvSeen) {
    ui.state.textContent = '응답 없음';
    ui.result.textContent = '보드가 Wi-Fi 설정 요청에 답하지 않습니다. IOSignalConfig를 쓰는 스케치인지, 속도가 115200인지 확인하세요. 보드 재시작을 눌러 볼 수도 있습니다.';
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

// IOSignal server and key (IOSignalConfig firmware only; older firmware answers "unknown command").
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

// ---- Sketch settings (0xA2 / 0xA3) ----
const KIND_TEXT = { text: '글자', cid: 'CID', int: '정수', bool: '켜기/끄기', choice: '선택' };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v; else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children);
  return node;
}

// One field per setting. Empty input or "(바꾸지 않음)" leaves it; "기본값으로" clears the stored value.
function inputFor(row) {
  const id = `app-${row.name}`;
  if (row.kind === 'bool' || row.kind === 'choice') {
    const values = row.kind === 'bool' ? [['1', '켜기 (1)'], ['0', '끄기 (0)']] : row.options.map((o) => [o, o]);
    return el('select', { id, 'data-name': row.name }, el('option', { value: '', text: '(바꾸지 않음)' }),
      ...values.map(([v, label]) => el('option', { value: v, text: label })));
  }
  const attrs = { id, 'data-name': row.name, autocomplete: 'off', placeholder: '비워 두면 바꾸지 않습니다' };
  if (row.kind === 'int') Object.assign(attrs, { inputmode: 'numeric', placeholder: `${row.min} ~ ${row.max}` });
  if (row.kind === 'cid') attrs.maxlength = 12;
  if (row.secret) attrs.type = 'password';
  return el('input', attrs);
}

function renderApp(rows) {
  appRows = rows;
  ui.appFields.replaceChildren(...rows.map((row) => {
    const now = row.secret ? (row.source === 'stored' ? '저장됨 (값은 보이지 않음)' : '없음') : (row.value || '(빈 값)');
    const notes = [KIND_TEXT[row.kind] ?? row.kind, row.kind === 'text' && row.max ? `${row.max}바이트까지` : '',
      row.remote ? '원격 명령으로도 바뀜' : '', row.restart ? '바꾸면 재시작' : ''].filter(Boolean).join(' · ');
    const reset = el('input', { type: 'checkbox', 'data-reset': row.name, disabled: row.source !== 'stored' });
    return el('fieldset', { class: 'app-field' },
      el('legend', { text: row.label }),
      el('p', { class: 'app-now' }, el('code', { text: row.name }), ` 현재: ${now} (${SOURCE[row.source] ?? row.source})`),
      el('label', {}, `새 값`, inputFor(row)),
      el('label', { class: 'check-row' }, reset, ' 스케치 기본값으로'),
      el('small', { text: notes }));
  }));
  ui.appSection.hidden = rows.length === 0;
}

async function loadApp() {
  try {
    renderApp((await request(COMMAND.LIST_APP)).map(decodeAppRow));
  } catch (err) {
    ui.appSection.hidden = true; // older firmware ("unknown command") or no settings
    if (err.message !== 'unknown-command' && err.message !== 'timeout') log(`[스케치 설정 읽기 오류] ${err.message}`);
  }
}

ui.appForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const changes = [];
  for (const row of appRows) {
    const reset = ui.appForm.querySelector(`[data-reset="${row.name}"]`);
    const input = ui.appForm.querySelector(`[data-name="${row.name}"]`);
    if (reset?.checked) changes.push([row, '']);
    else if (input?.value !== '') changes.push([row, input.value.trim()]);
  }
  let bytes;
  try { bytes = appUpdate(changes); } catch (err) { ui.appResult.textContent = err.message; return; }
  ui.applyApp.disabled = true;
  ui.appResult.textContent = '보드에 보냈습니다…';
  try {
    renderApp((await request(COMMAND.SET_APP, bytes, 5000)).map(decodeAppRow));
    const restart = changes.some(([row]) => row.restart);
    ui.appResult.textContent = restart ? '저장했습니다. 보드가 재시작합니다.' : '저장했습니다. 보드가 바로 적용합니다(그렇게 만들지 않은 스케치는 재시작합니다).';
  } catch (err) {
    ui.appResult.textContent = err.message === 'timeout' ? '보드가 응답하지 않습니다.'
      : err.message === 'invalid' ? '보드가 값을 받지 않았습니다. 형식을 확인하세요.'
      : err.message === 'unknown' ? '보드가 저장하지 못했습니다.' : (ERROR_TEXT[err.message] ?? err.message);
  } finally {
    ui.applyApp.disabled = !port;
  }
});

// Each field shows its own rule problem as it is typed.
ui.appForm.addEventListener('input', (event) => {
  const name = event.target.dataset?.name;
  const row = appRows.find((r) => r.name === name);
  if (!row) return;
  const problem = checkAppValue(row, event.target.value.trim());
  event.target.setCustomValidity(problem);
  ui.appResult.textContent = problem;
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
  ui.appSection.hidden = true;
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
