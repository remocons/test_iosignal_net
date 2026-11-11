import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, exampleURL, labLink, layout, loadExamples, renderExample, renderHome, renderMedia } from '../scripts/site/pages.mjs';
import { linkOptions } from '../public/lib/protocol.js';

const content = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'examples');
const sample = {
  library: 'remocon', name: 'demo', title: '데모 <LED>', kind: 'device', summary: '요약 & 설명',
  boards: [{ name: 'ESP32', fqbn: 'esp32:esp32:esp32' }], network: 'Wi-Fi', app: 'remocon.kr', partners: [],
  wiring: [{ pin: '2', part: 'LED', note: '"active low"' }], setup: ['업로드합니다.'],
  flow: [{ from: '장치', to: '서버', tag: '@$info', value: 'n=데모;t=light.1', note: '정보' }],
  notes: ['참고'], draft: true, approved: false,
  source: 'https://github.com/remocons/remocon-arduino/tree/main/examples/demo',
  sketch: 'https://github.com/remocons/remocon-arduino/blob/main/examples/demo/demo.ino',
};

test('text is escaped in pages', () => {
  assert.equal(esc(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  const html = renderExample(sample);
  assert.ok(html.includes('데모 &lt;LED&gt;'));
  assert.ok(!html.includes('<LED>'));
  assert.ok(html.includes('&quot;active low&quot;'));
});

test('an example page has the sections, status and links', () => {
  const html = renderExample(sample);
  for (const id of ['media', 'parts', 'wiring', 'steps', 'flow', 'notes', 'code']) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(html.includes('초안 · 실물 미확인'));
  assert.ok(html.includes(sample.sketch));
  assert.ok(html.includes('/lab/?preset=cid'));
  assert.ok(html.includes('aria-current="page"'));
});

test('lab links fill the tags each kind uses', () => {
  assert.equal(labLink(sample), '/lab/?preset=cid');
  const group = { ...sample, kind: 'group', flow: [{ tag: '#lab$info' }, { tag: '#lab$state', value: '구독' }] };
  assert.deepEqual(linkOptions(labLink(group).split('?')[1]), { preset: 'group', tag: '#lab$state', value: undefined, type: undefined, subscriptions: ['#lab$state'] });
  const channel = { ...sample, kind: 'channel', flow: [{ tag: '#homeButton', value: '구독' }] };
  assert.equal(linkOptions(labLink(channel).split('?')[1]).tag, '#homeButton');
  assert.equal(labLink({ ...sample, kind: 'other' }), '');
  assert.equal(linkOptions('?preset=nope').preset, 'basic');
});

test('exported examples load and every page renders', () => {
  const examples = loadExamples(content);
  assert.ok(examples.length > 0);
  const home = renderHome(examples);
  for (const ex of examples) {
    assert.ok(home.includes(`href="${exampleURL(ex)}"`), ex.name);
    assert.ok(renderExample(ex).includes('<h1>'), ex.name);
    assert.ok(ex.sketch.startsWith('https://github.com/remocons/'), ex.name);
  }
  assert.ok(layout({ title: 't', body: '' }).includes('href="/lab/"'));
});

test('media: pictures in a gallery (photo first), documents as links, a placeholder when empty', () => {
  assert.match(renderMedia([]), /placeholder/);
  const html = renderMedia([
    { kind: 'document', caption: '자료 "PDF"', url: 'https://github.com/x/a.pdf', image: false },
    { kind: 'wiring', caption: '', url: '/media/remocon/demo/wiring.png', image: true },
    { kind: 'photo', caption: '완성 모습', url: '/media/remocon/demo/photo.jpg', image: true },
  ]);
  assert.ok(html.indexOf('photo.jpg') < html.indexOf('wiring.png'));
  assert.match(html, /<img src="\/media\/remocon\/demo\/photo.jpg" alt="완성 모습" loading="lazy">/);
  assert.match(html, /alt="배선도"/);
  assert.ok(html.includes('자료 &quot;PDF&quot; ↗'));
  assert.match(renderMedia([{ kind: 'document', caption: '', url: 'x.pdf', image: false }]), /아직 등록된 사진이 없습니다/);
  assert.ok(renderExample({ ...sample, media: [{ kind: 'photo', caption: '', url: '/media/p.jpg', image: true }] }).includes('class="gallery"'));
});
