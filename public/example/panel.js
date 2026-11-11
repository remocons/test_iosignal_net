// "직접 해 보기" on an example page. The page carries its setup in #panel-config (see scripts/site/pages.mjs):
//   device  find the example's board with #search, draw its official type or its own $panel, send <cid>@ commands
//   group   draw the group's type and rewrite the shared #ch$state
//   channel send to a channel and show what arrives
import IO from 'iosignal/io';
import { applyCommand, formatState, matches, normalizeScreen, parseInfo, parseState } from '../lib/control.js';
import { renderScreen } from '../lib/widgets.js';

const config = JSON.parse(document.getElementById('panel-config').textContent);
const $ = (id) => document.getElementById(id);
const area = $('panelArea');
const LOG_MAX = 8;
let io = null;
let stop = () => {};

const notice = (text = '') => { $('panelNotice').textContent = text; };
function log(direction, tag, value) {
  const row = document.createElement('li');
  row.textContent = `${new Date().toLocaleTimeString()} ${direction} ${tag}${value === undefined ? '' : ` ${typeof value === 'string' ? value : JSON.stringify(value)}`}`;
  row.className = direction === 'TX' ? 'tx' : 'rx';
  $('panelLog').prepend(row);
  while ($('panelLog').children.length > LOG_MAX) $('panelLog').lastChild.remove();
}
function signal(tag, ...args) { io.signal(tag, ...args); log('TX', tag, args[0]); }
function status(text) { $('panelState').textContent = text; }
const text = (value) => (typeof value === 'string' ? value : '');

function deviceMode() {
  const tracked = new Map(); // cid → info, for every device that answered
  let current = '';
  let update = null;
  let lastState = {};
  let panelShown = false;
  const timers = [];
  const pick = $('deviceSelect');

  function draw(screen, source) {
    update = renderScreen(area, screen, { send: (cmd) => current && signal(`${current}@`, cmd), notice });
    update(lastState); // A screen that arrives after the state shows it at once.
    update.setEnabled(Boolean(current));
    $('screenSource').textContent = source;
  }
  function list() {
    const mine = [...tracked].filter(([, info]) => matches(config.target, info));
    pick.replaceChildren(...mine.map(([cid, info]) => Object.assign(document.createElement('option'), { value: cid, textContent: `${info.name} · ${cid}` })));
    pick.hidden = mine.length < 2;
    const others = tracked.size - mine.length;
    $('deviceFound').textContent = mine.length
      ? `이 예제의 보드 ${mine.length}대를 찾았습니다.${others ? ` 다른 장치 ${others}대는 이 예제와 맞지 않아 숨겼습니다.` : ''}`
      : `이 예제의 보드를 찾고 있습니다…${others ? ` (다른 장치 ${others}대는 숨김)` : ''}`;
    if (!current && mine.length) choose(mine[0][0]);
  }
  function choose(cid) {
    if (current) { io.unsubscribe(`${current}@$state`); io.unsubscribe(`${current}@$panel`); }
    current = cid;
    lastState = {};
    pick.value = cid;
    panelShown = false;
    const info = tracked.get(cid);
    draw(config.screen, config.screenSource);
    io.subscribe(`${cid}@$state`);
    if (info?.hasPanel) io.subscribe(`${cid}@$panel`);
    status(`${info?.name ?? cid} 제어 중`);
  }
  pick.onchange = () => choose(pick.value);

  const onMessage = (tag, value) => {
    log('RX', tag, value);
    if (tag === '#notify') {
      const cid = text(value);
      if (cid && !cid.startsWith('#') && !tracked.has(cid)) { tracked.set(cid, {}); io.subscribe(`${cid}@$info`); }
      return;
    }
    const [cid, part] = tag.split('@$');
    if (!tracked.has(cid)) return;
    if (part === 'info') { tracked.set(cid, parseInfo(value)); list(); }
    if (cid !== current) return;
    if (part === 'state') {
      if (value === 'close') { status('보드 연결이 끊겼습니다. 보드가 다시 켜지면 장치 찾기를 누르세요.'); update?.setEnabled(false); return; }
      lastState = parseState(text(value));
      update?.(lastState);
      notice();
    }
    if (part === 'panel' && !panelShown) {
      const screen = normalizeScreen(value);
      if (screen) { panelShown = true; draw(screen, '보드가 보낸 화면($panel)'); }
    }
  };
  const search = () => { if (io?.getStateName?.() === 'ready') signal('#search'); };
  $('searchButton').onclick = search;
  draw(config.screen, config.screenSource);
  return {
    ready() {
      io.subscribe('#notify');
      timers.push(setTimeout(search), setTimeout(search, 1000), setTimeout(() => {
        if (!current) notice('보드를 찾지 못했습니다. 보드가 같은 서버에 접속했는지, 이 브라우저와 같은 공유기(같은 공인 IP)에 있는지 확인하세요. #search는 같은 공인 IP에만 전달됩니다.');
      }, 4000));
    },
    message: onMessage,
    reset() {
      timers.splice(0).forEach(clearTimeout); tracked.clear(); current = ''; lastState = {};
      pick.replaceChildren(); pick.hidden = true;
      $('deviceFound').textContent = '연결하면 이 예제의 보드를 찾습니다.';
      draw(config.screen, config.screenSource);
    },
  };
}

function groupMode() {
  let state = {};
  let update = null;
  const channel = () => $('groupChannel').value.trim();
  const draw = () => {
    update = renderScreen(area, config.screen, {
      notice,
      send: (cmd) => {
        state = applyCommand(state, cmd);
        update(state);
        signal(`${channel()}$state`, formatState(state));
      },
    });
    update.setEnabled(io?.getStateName?.() === 'ready');
  };
  draw();
  let subscribed = '';
  return {
    ready() {
      const ch = channel();
      if (!/^#[^\s@#$;,]+$/.test(ch)) { notice('그룹 채널은 #으로 시작하는 이름이어야 합니다. 예: #lab'); return; }
      subscribed = `${ch}$state`;
      io.subscribe(subscribed);
      update.setEnabled(true);
      status(`${ch} 그룹에 참여했습니다. 보관된 상태가 있으면 바로 받습니다.`);
    },
    message(tag, value) {
      log('RX', tag, value);
      if (tag === subscribed) { state = parseState(text(value)); delete state._; update(state); }
    },
    reset() { state = {}; subscribed = ''; draw(); },
  };
}

function channelMode() {
  const received = $('channelReceived');
  const button = $('channelSend');
  button.onclick = () => signal(config.channel.tag, $('channelValue').value);
  return {
    ready() { io.subscribe(config.channel.tag); button.disabled = false; status(`${config.channel.tag} 채널을 구독했습니다.`); },
    message(tag, ...args) {
      log('RX', tag, args[0]);
      if (tag === config.channel.tag) received.textContent = `마지막 수신 ${new Date().toLocaleTimeString()} · ${args.length ? JSON.stringify(args[0]) : '(값 없음)'}`;
    },
    reset() { button.disabled = true; },
  };
}

const mode = { device: deviceMode, group: groupMode, channel: channelMode }[config.mode]();

function connect(event) {
  event.preventDefault();
  notice();
  let url;
  try { url = new URL($('panelServer').value); } catch { notice('서버 주소가 올바르지 않습니다.'); return; }
  if (!['ws:', 'wss:'].includes(url.protocol)) { notice('ws:// 또는 wss:// 주소를 입력하세요.'); return; }
  stop();
  io = new IO();
  io.on('error', () => notice('연결 또는 통신 오류입니다. 서버 주소와 네트워크를 확인하세요.'));
  io.on('change', (name) => { $('panelConnection').textContent = name; if (name !== 'ready') status(''); });
  io.on('ready', () => { $('panelCID').textContent = io.cid; mode.ready(); });
  io.on('message', (tag, ...args) => mode.message(tag, ...args));
  io.open(url.href);
  stop = () => { io?.removeAllListeners(); io?.stop(); io = null; mode.reset(); $('panelConnection').textContent = '미연결'; $('panelCID').textContent = '—'; status(''); };
}

$('panelConnect').onsubmit = connect;
$('panelClose').onclick = () => stop();
if (['localhost', '127.0.0.1'].includes(location.hostname) && config.localServer) $('panelServer').value = config.localServer;
window.addEventListener('pagehide', () => stop());
