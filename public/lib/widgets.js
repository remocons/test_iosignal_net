// Draws a normalized screen (see control.js normalizeScreen) with DOM nodes and text only.
// renderScreen(root, screen, { send, notice }) returns update(state) to show a new $state.
import { isTruthy, PAD_KEYS, renderCommand, textCommand } from './control.js';

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((child) => child != null));
  return node;
};
const HEX = /^#[0-9a-fA-F]{6}$/;

export function renderScreen(root, screen, { send, notice = () => {} }) {
  const updates = [];
  const disabled = new Set();
  let state = {};
  const field = (label, ...children) => el('div', { className: 'w-field' }, label ? el('span', { className: 'w-label', textContent: label }) : null, ...children);

  function draw(spec, parent) {
    switch (spec.widget) {
      case 'row': case 'section': {
        const box = spec.widget === 'row' ? el('div', { className: 'w-row' })
          : spec.collapsed ? el('details', { className: 'w-section' }, el('summary', { textContent: spec.label ?? '' }))
          : el('fieldset', { className: 'w-section' }, spec.label ? el('legend', { textContent: spec.label }) : null);
        for (const child of spec.children) draw(child, box);
        parent.append(box);
        return;
      }
      case 'button': {
        const button = el('button', { type: 'button', textContent: spec.label, onclick: () => send(spec.cmd) });
        disabled.add(button); parent.append(button); return;
      }
      case 'buttons': {
        const group = el('div', { className: 'w-buttons' });
        const buttons = spec.options.map((option) => {
          const button = el('button', { type: 'button', className: 'secondary', textContent: option.label, onclick: () => send(renderCommand(spec.cmd, option.value)) });
          disabled.add(button); group.append(button); return [button, option.value];
        });
        if (spec.key) updates.push(() => buttons.forEach(([button, value]) => button.setAttribute('aria-pressed', String(state[spec.key] === value))));
        parent.append(field(spec.label, group)); return;
      }
      case 'switch': {
        const input = el('input', { type: 'checkbox', role: 'switch' });
        input.setAttribute('aria-label', spec.label ?? spec.key);
        input.onchange = () => send(input.checked ? spec.cmdOn : spec.cmdOff);
        disabled.add(input);
        updates.push(() => { input.checked = isTruthy(state[spec.key]); });
        parent.append(el('label', { className: 'w-switch' }, input, el('span', { textContent: spec.label ?? spec.key })));
        return;
      }
      case 'slider': {
        const input = el('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step, value: spec.min });
        input.setAttribute('aria-label', spec.label ?? spec.key);
        if (spec.track === 'hue') input.className = 'w-hue';
        const shown = el('output', { textContent: '—' });
        input.oninput = () => { shown.textContent = `${input.value}${spec.unit ?? ''}`; };
        input.onchange = () => send(renderCommand(spec.cmd, input.value));
        disabled.add(input);
        updates.push(() => {
          if (document.activeElement === input || state[spec.key] === undefined) return;
          input.value = state[spec.key]; shown.textContent = `${state[spec.key]}${spec.unit ?? ''}`;
        });
        parent.append(field(spec.label, el('div', { className: 'w-slider' }, input, shown))); return;
      }
      case 'select': {
        const select = el('select', {}, el('option', { value: '', textContent: '선택…' }), ...spec.options.map((o) => el('option', { value: o.value, textContent: o.label })));
        select.setAttribute('aria-label', spec.label ?? spec.key);
        select.onchange = () => select.value && send(renderCommand(spec.cmd, select.value));
        disabled.add(select);
        updates.push(() => { if (state[spec.key] !== undefined) select.value = state[spec.key]; });
        parent.append(field(spec.label, select)); return;
      }
      case 'color': {
        const input = el('input', { type: 'color', value: '#ffffff' });
        input.setAttribute('aria-label', spec.label ?? spec.key);
        input.onchange = () => send(renderCommand(spec.cmd, input.value));
        disabled.add(input);
        updates.push(() => { if (HEX.test(state[spec.key] ?? '')) input.value = state[spec.key].toLowerCase(); });
        parent.append(field(spec.label, input)); return;
      }
      case 'value': case 'gauge': {
        const shown = el('output', { className: 'w-value', textContent: '—' });
        const meter = spec.widget === 'gauge' ? el('meter', { min: spec.min, max: spec.max }) : null;
        updates.push(() => {
          const value = state[spec.key];
          shown.textContent = value === undefined ? '—' : `${value}${spec.unit ?? ''}`;
          if (meter && value !== undefined && Number.isFinite(Number(value))) meter.value = Number(value);
        });
        parent.append(field(spec.label ?? (spec.key === '_' ? '상태' : spec.key), meter, shown)); return;
      }
      case 'pad': {
        const pad = el('div', { className: 'w-pad' });
        for (const [value, label] of PAD_KEYS) {
          const button = el('button', { type: 'button', className: `secondary pad-${value}`, textContent: label, onclick: () => send(renderCommand(spec.cmd, value)) });
          button.setAttribute('aria-label', value); disabled.add(button); pad.append(button);
        }
        parent.append(field(spec.label, pad)); return;
      }
      case 'text': {
        const input = el('input', { type: 'text', maxLength: spec.maxLength, placeholder: spec.key });
        input.setAttribute('aria-label', spec.label ?? spec.key);
        const submit = () => { const result = textCommand(spec, input.value); if (result.ok) send(result.command); else notice(result.error); };
        const button = el('button', { type: 'button', textContent: '보내기', onclick: submit });
        input.onkeydown = (event) => { if (event.key === 'Enter') submit(); };
        disabled.add(input); disabled.add(button);
        updates.push(() => { if (document.activeElement !== input && state[spec.key] !== undefined) input.value = state[spec.key]; });
        parent.append(field(spec.label, el('div', { className: 'w-text' }, input, button))); return;
      }
    }
  }

  root.replaceChildren();
  if (screen.title) root.append(el('h3', { className: 'w-title', textContent: screen.title }));
  for (const spec of screen.controls) draw(spec, root);
  const update = (next = state) => { state = next; for (const fn of updates) fn(); };
  update.setEnabled = (on) => { for (const node of disabled) node.disabled = !on; };
  update();
  return update;
}
