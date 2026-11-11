// Builds the static pages of test.iosignal.net from content/examples/<library>/<name>.json.
// The JSON comes from the Arduino repository (npm run site:export there).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const LIBRARIES = {
  iosignal: { label: 'IOSignal', about: '채널 신호를 주고받는 기본 통신 예제입니다.' },
  remocon: { label: 'Remocon', about: 'remocon.kr 웹앱이 찾고 제어하는 장치 예제입니다.' },
};
export const MEDIA_KINDS = { photo: '실사 사진', wiring: '배선도', schematic: '회로도', pinmap: '핀맵', document: '문서' };
const MEDIA_ORDER = Object.keys(MEDIA_KINDS);
export const KINDS = { device: '장치', group: '그룹', channel: '채널 송수신', camera: '카메라', other: '기타' };
const KIND_ORDER = Object.keys(KINDS);

export const NAV = [
  ['examples', '/', '예제'],
  ['lab', '/lab/', '웹 실습실'],
  ['webrtc', '/webrtc/', 'WebRTC'],
];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export function loadExamples(dir) {
  const examples = [];
  for (const library of Object.keys(LIBRARIES)) {
    const folder = path.join(dir, library);
    if (!existsSync(folder)) continue;
    for (const file of readdirSync(folder).filter((f) => f.endsWith('.json')).sort()) {
      const doc = JSON.parse(readFileSync(path.join(folder, file), 'utf8'));
      if (doc.library !== library || `${doc.name}.json` !== file) throw new Error(`Mismatched example file: ${library}/${file}`);
      examples.push(doc);
    }
  }
  return examples.sort((a, b) =>
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.title.localeCompare(b.title, 'ko'));
}

export const exampleURL = (ex) => `/examples/${ex.library}/${ex.name}/`;

// A /lab/ link that fills the tags this example uses, or '' when the lab has no matching template.
export function labLink(ex) {
  const flow = ex.flow ?? [];
  const params = new URLSearchParams();
  if (ex.kind === 'device') params.set('preset', 'cid');
  else if (ex.kind === 'group') {
    const tag = flow.map((f) => f.tag).find((t) => /^#[^@]*\$state$/.test(t ?? ''));
    if (!tag) return '';
    params.set('preset', 'group'); params.set('tag', tag); params.set('sub', tag);
  } else if (ex.kind === 'channel') {
    const tag = flow.find((f) => f.value === '구독' && /^#\w+$/.test(f.tag ?? ''))?.tag;
    if (!tag) return '';
    params.set('preset', 'basic'); params.set('tag', tag); params.set('sub', tag);
  } else return '';
  return `/lab/?${params}`;
}

function statusBadge(ex) {
  if (ex.draft) return '<span class="badge warn" title="코드를 보고 작성한 설명이며 실제 보드로 확인하지 않았습니다">초안 · 실물 미확인</span>';
  return '<span class="badge ok" title="실제 보드로 확인한 기록이 있는 예제입니다">실물 확인 예제</span>';
}

export function layout({ title, description = '', active = '', body, scripts = [] }) {
  const nav = NAV.map(([key, href, label]) =>
    `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${description ? `<meta name="description" content="${esc(description)}">` : ''}
<link rel="stylesheet" href="/style.css"></head>
<body>
<header class="topbar"><a class="brand" href="/">IOSignal 실습실</a><nav aria-label="주 메뉴">${nav}<a href="https://github.com/remocons" target="_blank" rel="noreferrer">GitHub ↗</a></nav></header>
${body}
<footer>계정 등록 없이 실습하고, 자신의 IOSignal 서버에도 연결할 수 있습니다. · MIT License</footer>
${scripts.map((src) => `<script type="module" src="${src}"></script>`).join('\n')}
</body></html>
`;
}

function card(ex) {
  const boards = ex.boards.map((b) => b.name).join(', ');
  return `<li class="card" data-kind="${esc(ex.kind)}"><a href="${exampleURL(ex)}">
<span class="card-kind">${esc(KINDS[ex.kind] ?? ex.kind)}</span>
<strong>${esc(ex.title)}</strong>
<span class="card-summary">${esc(ex.summary)}</span>
<span class="card-meta">${esc(boards)}${ex.draft ? ' · 초안' : ''}</span></a></li>`;
}

export function renderHome(examples) {
  const groups = Object.entries(LIBRARIES).map(([key, lib]) => {
    const list = examples.filter((ex) => ex.library === key);
    if (!list.length) return '';
    return `<section class="library" id="${key}"><h2>${lib.label} 예제 <span class="count">${list.length}</span></h2><p class="hint">${lib.about}</p><ul class="cards">${list.map(card).join('')}</ul></section>`;
  }).join('\n');
  const body = `<main class="home">
<section class="intro"><span class="eyebrow">IOSIGNAL / ARDUINO EXAMPLES</span><h1>예제를 고르고, 연결하고, 확인하세요.</h1>
<p>아두이노 예제마다 준비물, 배선, 순서, 시그널 흐름을 한 페이지에 모았습니다. 보드 없이 통신만 확인하려면 <a href="/lab/">웹 실습실</a>을 여세요.</p></section>
${groups}
</main>
<script>if (/[?&](preset|board)=/.test(location.search)) location.replace('/lab/' + location.search);</script>`;
  return layout({ title: 'IOSignal 실습실 · 아두이노 예제', description: 'IOSignal과 Remocon 아두이노 예제별 배선, 순서, 시그널 흐름', active: 'examples', body });
}

const table = (head, rows) => `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

// Pictures first (photo, wiring, schematic, pinmap), then documents such as PDFs as links.
export function renderMedia(media) {
  const sorted = [...media].sort((a, b) => MEDIA_ORDER.indexOf(a.kind) - MEDIA_ORDER.indexOf(b.kind));
  const label = (m) => MEDIA_KINDS[m.kind] ?? m.kind;
  const images = sorted.filter((m) => m.image);
  const docs = sorted.filter((m) => !m.image);
  if (!images.length && !docs.length) return '<p class="placeholder">아직 등록된 사진과 회로도가 없습니다. 아래 배선 표를 참고하세요.</p>';
  const figures = images.map((m) => `<figure class="media-${esc(m.kind)}"><a href="${esc(m.url)}" target="_blank" rel="noreferrer"><img src="${esc(m.url)}" alt="${esc(m.caption || label(m))}" loading="lazy"></a><figcaption><b>${esc(label(m))}</b>${m.caption ? ` ${esc(m.caption)}` : ''}</figcaption></figure>`).join('');
  const links = docs.map((m) => `<li><a href="${esc(m.url)}" target="_blank" rel="noreferrer">${esc(m.caption || label(m))} ↗</a> <span class="hint">${esc(label(m))}</span></li>`).join('');
  return `${figures ? `<div class="gallery">${figures}</div>` : '<p class="placeholder">아직 등록된 사진이 없습니다.</p>'}${links ? `<ul class="docs">${links}</ul>` : ''}`;
}

export function renderExample(ex) {
  const lib = LIBRARIES[ex.library];
  const lab = labLink(ex);
  const sections = [];
  sections.push(`<section id="media"><h2>사진 · 회로도</h2>${renderMedia(ex.media ?? [])}</section>`);
  const ready = [
    ...ex.boards.map((b) => `<li><b>보드</b> ${esc(b.name)}${b.note ? ` <span class="hint">(${esc(b.note)})</span>` : ''} <code>${esc(b.fqbn)}</code></li>`),
    ex.network ? `<li><b>네트워크</b> ${esc(ex.network)}</li>` : '',
    ex.app ? `<li><b>앱</b> ${esc(ex.app)}</li>` : '',
    ...(ex.partners ?? []).map((p) => typeof p === 'string' ? `<li><b>연동</b> ${esc(p)}</li>` : `<li><b>연동</b> ${esc(p.name)}: ${esc(p.role)}</li>`),
  ].join('');
  sections.push(`<section id="parts"><h2>준비물</h2><ul class="facts">${ready}</ul></section>`);
  sections.push(`<section id="wiring"><h2>배선 · 핀맵</h2>${ex.wiring?.length
    ? table(['보드 핀', '연결', '비고'], ex.wiring.map((w) => [`<code>${esc(w.pin)}</code>`, esc(w.part), esc(w.note)]))
    : '<p>따로 배선할 부품이 없습니다.</p>'}</section>`);
  if (ex.setup?.length) sections.push(`<section id="steps"><h2>사용 순서</h2><ol class="steps">${ex.setup.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>`);
  if (ex.flow?.length) sections.push(`<section id="flow"><h2>시그널 흐름</h2>${table(['보내는 쪽', '받는 쪽', '태그', '값', '설명'],
    ex.flow.map((f) => [esc(f.from), esc(f.to), `<code>${esc(f.tag)}</code>`, f.value ? `<code>${esc(f.value)}</code>` : '', esc(f.note)]))}</section>`);
  if (ex.notes?.length) sections.push(`<section id="notes"><h2>참고</h2><ul>${ex.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>`);
  sections.push(`<section id="code"><h2>소스 코드</h2><div class="actions"><a class="button" href="${esc(ex.sketch)}" target="_blank" rel="noreferrer">스케치 보기 ↗</a><a class="button secondary" href="${esc(ex.source)}" target="_blank" rel="noreferrer">예제 폴더 ↗</a>${lab ? `<a class="button secondary" href="${esc(lab)}">웹 실습실에서 열기</a>` : ''}</div></section>`);

  const body = `<main class="doc">
<nav class="crumb" aria-label="위치"><a href="/">예제</a> › <a href="/#${ex.library}">${lib.label}</a> › ${esc(ex.title)}</nav>
<header class="doc-head"><span class="eyebrow">${lib.label.toUpperCase()} / ${esc(ex.name)}</span><h1>${esc(ex.title)}</h1><p class="lead">${esc(ex.summary)}</p>
<p class="badges"><span class="badge">${esc(KINDS[ex.kind] ?? ex.kind)}</span>${ex.boards.map((b) => `<span class="badge">${esc(b.name)}</span>`).join('')}${statusBadge(ex)}</p></header>
${sections.join('\n')}
</main>`;
  return layout({ title: `${ex.title} · IOSignal 실습실`, description: ex.summary, active: 'examples', body });
}
