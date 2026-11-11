// Device rules used by the example panels, the same as remocon.kr (remocon_kr/src/lib/control/):
//   $info  n=…;g=…;t=…;ui=…;p=1   (JSON and the long keys name/group/type are still read)
//   $state key=value;key=value
//   screen { schema: 1, title?, controls: [...] } from an official type file or the device's $panel
// No DOM here, so it runs in Node tests too.

const KEY = /^[A-Za-z_][\w-]{0,31}$/;
const CMD = /^[^\u0000-\u001f\u007f]{1,64}$/;
const TEXT_VALUE = /^[^\u0000-\u001f\u007f;]*$/;
export const WIDGETS = ['button', 'buttons', 'switch', 'slider', 'select', 'color', 'value', 'gauge', 'pad', 'text', 'row', 'section'];
export const PAD_KEYS = [['up', '▲'], ['left', '◀'], ['ok', 'OK'], ['right', '▶'], ['down', '▼']];
const LIMITS = { controls: 60, depth: 3, options: 24, label: 40 };

export function parseState(raw) {
  if (typeof raw !== 'string') return {};
  const text = raw.trim();
  if (!text) return {};
  const state = { _: text };
  for (const part of text.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    if (KEY.test(key)) state[key] = part.slice(index + 1).trim();
  }
  return state;
}

export function formatState(state) {
  return Object.entries(state).filter(([key]) => key !== '_' && KEY.test(key)).map(([key, value]) => `${key}=${value}`).join(';');
}

export const isTruthy = (value) => ['1', 'on', 'true'].includes(String(value ?? '').toLowerCase());
export const renderCommand = (template, value) => String(template || '{v}').split('{v}').join(value == null ? '' : String(value));

// A command applied to a group's shared state (a group has no device to run it): on/off/toggle, all=…, key=value.
export function applyCommand(state, command) {
  const next = { ...state };
  delete next._;
  const cmd = String(command ?? '').trim();
  if (cmd === 'on' || cmd === 'off') next.on = cmd === 'on' ? '1' : '0';
  else if (cmd === 'toggle') next.on = next.on === '1' ? '0' : '1';
  else if (cmd.includes('=')) {
    const index = cmd.indexOf('=');
    const key = cmd.slice(0, index).trim();
    const value = cmd.slice(index + 1).trim();
    if (!KEY.test(key) || value.includes(';')) return next;
    if (key === 'all') for (const relay of Object.keys(next).filter((k) => /^r\d+$/.test(k))) next[relay] = value;
    else next[key] = value;
  }
  return next;
}

// $info of a device: { name, group, type, ui, hasPanel }. The short keys win over the long ones.
export function parseInfo(raw) {
  let info;
  if (typeof raw === 'string' && !raw.trimStart().startsWith('{')) info = parseState(raw);
  else {
    try { info = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {}; }
  }
  if (!info || typeof info !== 'object') return {};
  const out = {};
  for (const key of ['name', 'group', 'type', 'ui']) if (typeof info[key] === 'string') out[key] = info[key];
  for (const [short, key] of [['n', 'name'], ['g', 'group'], ['t', 'type']]) if (typeof info[short] === 'string') out[key] = info[short];
  if (typeof out.type === 'string') out.type = out.type.replace(/^remocon\/([a-z0-9-]+)\/v(\d+)$/, '$1.$2');
  out.hasPanel = String(info.p) === '1';
  return out;
}

// Is this device the board of the example? The type decides; without one, the name.
export function matches(target, info) {
  if (!info?.name) return false;
  if (target.type) return info.type === target.type;
  return Boolean(target.name) && info.name === target.name;
}

const str = (value, max) => (typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null);
const num = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const cmd = (value, fallback) => (typeof (value ?? fallback) === 'string' && CMD.test(value ?? fallback) ? (value ?? fallback) : null);
const key = (value, fallback) => (typeof (value ?? fallback) === 'string' && KEY.test(value ?? fallback) ? (value ?? fallback) : null);

function options(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, LIMITS.options).map((option) => {
    const raw = typeof option === 'string' ? { label: option, value: option } : option;
    const value = raw && (typeof raw.value === 'string' || typeof raw.value === 'number') ? String(raw.value) : null;
    const label = raw && str(raw.label ?? value, LIMITS.label);
    return value != null && label ? { label, value } : null;
  }).filter(Boolean);
}

function control(input, depth, counter) {
  if (!input || typeof input !== 'object' || !WIDGETS.includes(input.widget) || ++counter.count > LIMITS.controls) return null;
  const out = { widget: input.widget };
  const label = str(input.label, LIMITS.label);
  if (label) out.label = label;
  switch (input.widget) {
    case 'button': out.cmd = cmd(input.cmd); out.label ??= out.cmd; return out.cmd ? out : null;
    case 'buttons': out.options = options(input.options); out.cmd = cmd(input.cmd, '{v}'); if (input.key !== undefined) out.key = key(input.key); return out.options.length && out.cmd ? out : null;
    case 'switch': out.key = key(input.key, 'on'); out.cmdOn = cmd(input.cmdOn, 'on'); out.cmdOff = cmd(input.cmdOff, 'off'); return out.key && out.cmdOn && out.cmdOff ? out : null;
    case 'slider': case 'gauge':
      out.key = key(input.key); out.min = num(input.min, 0); out.max = num(input.max, 100);
      if (str(input.unit, 8)) out.unit = str(input.unit, 8);
      if (input.widget === 'slider') { out.step = num(input.step, 1); out.cmd = cmd(input.cmd, out.key && `${out.key}={v}`); if (input.track === 'hue') out.track = 'hue'; }
      return out.key && out.max > out.min && (input.widget === 'gauge' || (out.cmd && out.step > 0)) ? out : null;
    case 'select': out.key = key(input.key); out.options = options(input.options); out.cmd = cmd(input.cmd, out.key && `${out.key}={v}`); return out.key && out.options.length && out.cmd ? out : null;
    case 'color': out.key = key(input.key, 'color'); out.cmd = cmd(input.cmd, out.key && `${out.key}={v}`); return out.key && out.cmd ? out : null;
    case 'value': out.key = key(input.key); if (str(input.unit, 8)) out.unit = str(input.unit, 8); return out.key ? out : null;
    case 'pad': out.cmd = cmd(input.cmd, '{v}'); return out.cmd ? out : null;
    case 'text':
      out.key = key(input.key); out.cmd = cmd(input.cmd, out.key && `${out.key}={v}`);
      out.maxLength = Number.isInteger(input.maxLength) && input.maxLength >= 1 && input.maxLength <= 64 ? input.maxLength : 64;
      return out.key && out.cmd?.includes('{v}') ? out : null;
    default:
      if (input.widget === 'section' && input.collapsed === true) out.collapsed = true;
      out.children = depth < LIMITS.depth && Array.isArray(input.children)
        ? input.children.map((child) => control(child, depth + 1, counter)).filter(Boolean) : [];
      return out;
  }
}

// A screen made only of known widgets with checked values, or null. A device's $panel is data from the
// bus: anything unknown is dropped, and the page draws it with text, never as HTML.
export function normalizeScreen(input) {
  let screen = input;
  if (typeof screen === 'string') { try { screen = JSON.parse(screen); } catch { return null; } }
  if (!screen || typeof screen !== 'object' || screen.schema !== 1 || !Array.isArray(screen.controls)) return null;
  const counter = { count: 0 };
  const controls = screen.controls.map((c) => control(c, 1, counter)).filter(Boolean);
  if (!controls.length) return null;
  return { title: str(screen.title, 60) ?? '', controls };
}

// The ui list of $info ("on,off,toggle") as a screen: one row of buttons and the raw state.
export function screenFromUi(ui) {
  const buttons = String(ui ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, LIMITS.options);
  const controls = buttons.length ? [{ widget: 'buttons', options: buttons.map((b) => ({ label: b, value: b })), cmd: '{v}' }] : [];
  controls.push({ widget: 'value', label: '현재 상태', key: '_' });
  return { title: '', controls };
}

export function textCommand(spec, input) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return { ok: false, error: '값을 입력하세요.' };
  if (value.length > spec.maxLength) return { ok: false, error: `최대 ${spec.maxLength}자입니다.` };
  if (!TEXT_VALUE.test(value)) return { ok: false, error: "한 줄 문자만 쓸 수 있고 ';'는 쓸 수 없습니다." };
  const command = renderCommand(spec.cmd, value);
  return command.length > 64 ? { ok: false, error: '명령이 64자를 넘습니다.' } : { ok: true, command };
}
