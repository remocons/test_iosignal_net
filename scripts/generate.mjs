// Writes the generated pages into public/: index.html, lab/index.html, examples/**/index.html.
// These files are build output (see .gitignore); edit scripts/site/ and content/ instead.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exampleURL, layout, loadExamples, renderExample, renderHome } from './site/pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');

export function generate() {
  const examples = loadExamples(path.join(root, 'content', 'examples'));
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
  write('examples/index.html', layout({ title: '예제 · IOSignal 실습실', active: 'examples',
    body: '<main class="doc"><p><a href="/">예제 목록으로 이동합니다.</a></p></main><script>location.replace("/")</script>' }));
  for (const ex of examples) write(path.join(exampleURL(ex), 'index.html'), renderExample(ex));
  return examples.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Generated ${generate()} example pages.`);
