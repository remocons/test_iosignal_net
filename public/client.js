import IO from 'iosignal/io';
import { presets, boards, parseArgs, describeArgs, cidTags } from './lib/protocol.js';
import { protocolSwitchURL, protocolSwitchBlocked, connectionAdvice } from './lib/connection.js';
const $ = id => document.getElementById(id);
$('ioVersion').textContent = `v${IO.version}`;
let io, ready = false, paused = false, logs = [], activeTags = new Set(), currentPreset = "", resetControls = () => {};
function notice(text = '') { $('notice').textContent = text; }
function attempt(fn) { try { fn(); notice(); } catch (error) { notice(error.message); } }
function record(direction, tag, args) {
  logs.push({ time: new Date().toLocaleTimeString(), direction, tag, value: describeArgs(args) });
  if (logs.length > 200) logs.shift();
  if (!paused) renderLog();
}
function renderLog() {
  const filter = $('logFilter').value;
  $('messageView').replaceChildren(...logs.filter(row => row.tag.includes(filter)).slice().reverse().map(row => {
    const div = document.createElement('div'); div.className = 'log-row';
    for (const text of [row.time, row.direction, row.tag, row.value]) { const span = document.createElement('span'); span.textContent = text; if (text === row.direction) span.className = row.direction.toLowerCase(); div.append(span); }
    return div;
  }));
}
function updateReady(value) {
  ready = value;
  for (const id of ['sendButton', 'subscribeButton', 'unsubscribeButton', 'discover', 'useCID']) $(id).disabled = !ready;
  for (const input of document.querySelectorAll('#presetControls button, #sliders input')) input.disabled = !ready;
}
function requestedTags() { return [...new Set($('subscriptions').value.split('\n').map(t => t.trim()).filter(Boolean))]; }
function applySubscriptions() {
  if (!ready) return;
  const next = new Set(requestedTags());
  // Validate before changing the existing subscriptions.
  for (const tag of next) if (new TextEncoder().encode(tag).length > 255) throw Error('구독 태그는 UTF-8 255바이트 이내여야 합니다.');
  for (const tag of activeTags) if (!next.has(tag)) io.unsubscribe(tag);
  for (const tag of next) if (!activeTags.has(tag)) io.subscribe(tag);
  activeTags = next;
}
function send(tag, args) {
  if (!ready) throw Error('서버가 ready 상태인 후 송신하세요.');
  if (!tag) throw Error('송신 태그를 입력하세요.');
  io.signal(tag, ...args); record('TX', tag, args);
}
function sendValue(value, type = 'text') { $('payloadType').value = type; $('payload').value = value; send($('sendTag').value, parseArgs(type, value)); }
function action(label, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = !ready; b.onclick = () => attempt(fn); $('presetControls').append(b); }
function usePreset() {
  const key = $('preset').value, p = presets[key];
  resetControls = () => {};
  $('sendTag').value = p.tag; $('payloadType').value = p.type; $('payload').value = p.value;
  $('subscriptions').value = p.subscriptions.join('\n'); $('presetHelp').textContent = p.help;
  $('cidControls').hidden = key !== 'cid'; $('presetControls').replaceChildren(); $('sliders').replaceChildren(); $('sliders').hidden = true;
  if (key === 'cid' && $('board').value === 'esp01') {
    $('payload').value = 'Relay';
    $('presetHelp').textContent = 'CID 적용 후 Relay 또는 LED로 해당 출력을 토글합니다. 상태 두 자리는 GPIO 출력값입니다.';
  }
  if (key === 'basic') action('버튼 이벤트', () => sendValue('browser'));
  $('irisControls').hidden = key !== 'iris';
  if (key === 'iris') {
    const tag = `#Iris-g${$('irisGroup').value}$states`;
    $('sendTag').value = tag; $('subscriptions').value = tag;
    action('모두 켜기', () => sendValue('11111111'));
    action('모두 끄기', () => sendValue('00000000'));
    for (let i = 0; i < 8; i++) action(`장치 ${i}만 켜기`, () => sendValue('0'.repeat(i) + '1' + '0'.repeat(7-i)));
  }
  if (key === 'cid') for (const cmd of ($('board').value === 'esp01' ? ['Relay', 'LED'] : ['on', 'off', 'toggle'])) action(cmd, () => sendValue(cmd));
  if (key === 'group') for (const [label, value] of [['모두 켜기', '11'], ['모두 끄기', '00'], ['장치 1', '10'], ['장치 2', '01']]) action(label, () => sendValue(value));
  if (key === 'direction') for (const [label, value] of [['↑', 'u'], ['←', 'l'], ['정지', 's'], ['→', 'r'], ['↓', 'd']]) action(label, () => sendValue(value));
  if (key === 'rgb' || key === 'motor') {
    let values = Array.from(parseArgs('hex', p.value)[0]); $('sliders').hidden = false;
    const labels = key === 'rgb' ? ['R', 'G', 'B'] : ['M1A', 'M1B', 'M2A', 'M2B'];
    const emit = () => sendValue(values.map(v => v.toString(16).padStart(2, '0')).join(' '), 'hex');
    labels.forEach((name, i) => {
      const label = document.createElement('label'); label.textContent = name;
      const slider = document.createElement('input'); slider.type = 'range'; slider.min = 0; slider.max = 255; slider.value = values[i]; slider.disabled = !ready; slider.setAttribute('aria-label', name);
      slider.addEventListener('input', () => { values[i] = Number(slider.value); });
      slider.addEventListener('change', () => attempt(emit)); label.append(slider); $('sliders').append(label);
    });
    resetControls = () => { values.fill(0); for (const el of $('sliders').querySelectorAll('input')) el.value = 0; };
    action(key === 'rgb' ? 'LED 끄기' : '정지 (00 00 00 00)', () => { resetControls(); emit(); });
    if (key === 'rgb') action('빨강', () => { values = [255, 0, 0, 0]; $('sliders').querySelectorAll('input').forEach((el, i) => { el.value = values[i]; }); emit(); });
  }
  currentPreset = key;
  applySubscriptions();
}
// Motor control requires device-side timeout stopping; a browser cannot guarantee delivery on disconnect.
function stopMotor() { if (currentPreset === 'motor') { resetControls(); if (ready) attempt(() => sendValue('00 00 00 00', 'hex')); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMotor(); });
window.addEventListener('pagehide', () => { stopMotor(); io?.stop(); });
$('connectForm').addEventListener('submit', e => { e.preventDefault(); attempt(() => {
  const url = new URL($('serverURL').value);
  if (!['ws:', 'wss:'].includes(url.protocol)) throw Error('ws:// 또는 wss:// 주소를 입력하세요.');
  updateConnectionAdvice();
  stopMotor(); if (io) { io.removeAllListeners(); io.destroy(); }
  io = new IO(); activeTags.clear(); updateReady(false); $('ioCID').textContent = '—';
  const key = $('authKey').value; if (key) io.auth(key); $('authKey').value = '';
  io.on('error', () => notice('연결 또는 통신 오류입니다. 서버 주소·TLS 설정·방화벽과 브라우저의 로컬 네트워크 접근 권한을 확인하세요.'));
  io.on('change', state => { $('ioStateName').textContent = state; updateReady(state === 'ready'); if (state !== 'ready') $('ioCID').textContent = '—'; if (state === 'auth_fail') notice('인증에 실패했습니다. 본인의 인증정보와 서버를 확인하세요.'); });
  io.on('ready', () => { updateReady(true); $('ioCID').textContent = io.cid; activeTags.clear(); attempt(applySubscriptions); });
  io.on('message', (tag, ...args) => record('RX', tag, args));
  io.on('@', (tag, ...args) => record('RX', tag, args));
  try { io.open(url.href); }
  catch (error) {
    io.stop(); updateReady(false); $('ioStateName').textContent = '연결 실패';
    throw Error(`연결을 시작하지 못했습니다: ${error.message}`);
  }
}); });
$('closeButton').onclick = () => { stopMotor(); io?.stop(); updateReady(false); $('ioCID').textContent = '—'; };
$('sendForm').onsubmit = e => { e.preventDefault(); attempt(() => send($('sendTag').value, parseArgs($('payloadType').value, $('payload').value))); };
$('subscribeForm').onsubmit = e => { e.preventDefault(); attempt(applySubscriptions); };
$('unsubscribeButton').onclick = () => attempt(() => { $('subscriptions').value = ''; applySubscriptions(); });
$('discover').onclick = () => attempt(() => { const tags = new Set(requestedTags()); tags.add('#notify'); $('subscriptions').value = [...tags].join('\n'); applySubscriptions(); send('#search', []); });
$('useCID').onclick = () => attempt(() => { const p = cidTags($('deviceCID').value); $('sendTag').value = p.command; $('subscriptions').value = ['#notify', ...p.subscriptions].join('\n'); applySubscriptions(); });
$('preset').onchange = () => { stopMotor(); attempt(usePreset); };
$('pauseLog').onclick = () => { paused = !paused; $('pauseLog').textContent = paused ? '표시 재개' : '표시 일시정지'; if (!paused) renderLog(); };
$('clearLog').onclick = () => { logs = []; renderLog(); };
$('logFilter').oninput = renderLog;
$('copyLog').onclick = async () => { try { await navigator.clipboard.writeText(logs.map(r => `${r.time} ${r.direction} ${r.tag} ${r.value}`).join('\n')); notice('로그를 복사했습니다.'); } catch { notice('클립보드를 사용할 수 없습니다. 로그의 텍스트를 선택해 복사하세요.'); } };
for (const [key, p] of Object.entries(presets)) { const opt = document.createElement('option'); opt.value = key; opt.textContent = p.name; $('preset').append(opt); }
for (const [key, b] of Object.entries(boards)) { const opt = document.createElement('option'); opt.value = key; opt.textContent = b.name; $('board').append(opt); }
function useBoard() {
  stopMotor();
  const b = boards[$('board').value];
  $('preset').value = b.preset;
  $('boardTutorial').href = `https://iosignal.net/docs/examples/workbench/${b.page}`;
  usePreset();
}
$('board').onchange = () => attempt(useBoard);
$('irisGroup').onchange = () => attempt(usePreset);
const params = new URLSearchParams(location.search);
if (boards[params.get('board')]) $('board').value = params.get('board');
useBoard();
if (presets[params.get('preset')]) $('preset').value = params.get('preset');
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') $('serverURL').value = 'ws://localhost:7777';
usePreset(); updateReady(false);

function updateConnectionAdvice() {
  const advice = connectionAdvice(location.protocol, $('serverURL').value);
  $('connectionAdviceText').textContent = advice;
  $('connectionAdvice').hidden = !advice;
  $('switchProtocolInline').hidden = !(location.protocol === 'https:' && advice);
}
function switchProtocol() {
  const target = protocolSwitchURL(location.href);
  stopMotor(); io?.destroy(); updateReady(false);
  $('authKey').value = '';
  location.assign(target);
}
$('pageProtocol').textContent = `${location.protocol === 'https:' ? 'HTTPS' : 'HTTP'} 접속 중`;
$('switchProtocol').textContent = `${location.protocol === 'https:' ? 'HTTP' : 'HTTPS'}로 전환`;
$('switchProtocol').onclick = () => attempt(switchProtocol);
$('switchProtocolInline').onclick = () => attempt(switchProtocol);
$('serverURL').addEventListener('input', updateConnectionAdvice);
updateConnectionAdvice();

if (protocolSwitchBlocked(location.href)) {
  $('protocolFallback').hidden = false;
  $('httpAddress').value = protocolSwitchURL(location.href);
}
$('copyHttpAddress').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('httpAddress').value);
    $('protocolCopyStatus').textContent = 'HTTP 주소를 복사했습니다. 브라우저 주소창에 붙여 넣어 접속하세요.';
  } catch {
    $('httpAddress').select();
    $('protocolCopyStatus').textContent = '주소를 선택했습니다. 직접 복사하세요.';
  }
};
