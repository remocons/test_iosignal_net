// Writes the generated pages into public/: index.html, lab/index.html, wifi/index.html, examples/**/index.html.
// These files are build output (see .gitignore); edit scripts/site/ and content/ instead.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exampleURL, layout, loadExamples, loadTypes, renderExample, renderHome } from './site/pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');

export function generate() {
  const examples = loadExamples(path.join(root, 'content', 'examples'));
  const types = loadTypes(path.join(root, 'content', 'types'));
  const write = (rel, html) => {
    const file = path.join(pub, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, html);
  };
  rmSync(path.join(pub, 'examples'), { recursive: true, force: true });
  write('index.html', renderHome(examples));
  write('lab/index.html', layout({
    title: '웹 실습실 · IOSignal 실습실', description: '브라우저에서 IOSignal 시그널을 보내고 받는 범용 통신 실습실',
    active: 'lab', body: readFileSync(path.join(root, 'scripts', 'site', 'lab-body.html'), 'utf8'), scripts: ['/lab/lab.js'],
  }));
  write('wifi/index.html', layout({
    title: 'Wi-Fi 설정 · IOSignal 실습실', description: 'USB로 연결한 ESP32·ESP8266 보드의 Wi-Fi 이름과 비밀번호를 브라우저에서 바꿉니다',
    active: 'wifi', body: readFileSync(path.join(root, 'scripts', 'site', 'wifi-body.html'), 'utf8'), scripts: ['/wifi/wifi.js'],
  }));
  write('examples/index.html', layout({ title: '예제 · IOSignal 실습실', active: 'examples',
    body: '<main class="doc"><p><a href="/">예제 목록으로 이동합니다.</a></p></main><script>location.replace("/")</script>' }));
  // Prebuilt firmware from the Arduino repository (npm run site:firmware there), when present.
  const firmwareOf = (ex) => {
    const file = path.join(root, 'static', 'firmware', ex.library, ex.name, 'firmware.json');
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  };
  for (const ex of examples) write(path.join(exampleURL(ex), 'index.html'), renderExample(ex, types, firmwareOf(ex)));
  return examples.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Generated ${generate()} example pages.`);
