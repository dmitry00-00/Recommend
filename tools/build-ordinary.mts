// Названия-ловушки этого корпуса → .cache/ordinary.json. Читают генераторы индексов
// (build-telegram-index, build-essay-index) и передают в nameMatch.
//   npx tsx tools/build-ordinary.mts [--share 0.002] [--show]
// Списка руками здесь нет нарочно: что в этих каналах повседневное слово, а что название,
// знает сам корпус, и с новыми каналами ответ меняется.
import { writeFileSync } from 'node:fs';
import { parseArgs, readExport } from './telegram-export.mts';
import { addText, ORDINARY_SHARE, ordinaryFrom } from './ordinary-names.mts';
import { worksIndex } from './works-index.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const SHARE = Number(opt('--share') ?? ORDINARY_SHARE);

// корпус обходим по каналу и держим в памяти счётчик, а не тексты
const counts = new Map<string, number>();
let posts = 0;
const lower: string[] = [];
for (const a of parseArgs([])) {
  for (const p of readExport(a.path).posts) {
    addText(counts, p.text);
    lower.push(p.text.toLowerCase().replace(/ё/g, 'е'));
    posts += 1;
  }
}

const names = [...new Set(worksIndex().flatMap((w) => w.names))];
// первый признак: все слова названия — повседневные
const byWords = ordinaryFrom(counts, posts, names, SHARE);
// второй: и сама фраза встречается строчными. Без него в ловушки попадают «Один дома»,
// «Назад в будущее», «Волшебник страны Оз» — они собраны из обычных слов, но как фраза
// в речи не встречаются, и требовать для них кавычки значило бы терять привязки (замер 26.09)
const threshold = Math.max(20, Math.round(posts * SHARE));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ordinary: string[] = [];
for (const name of byWords) {
  const re = new RegExp(`(?<!\\p{L})${esc(name.toLowerCase().replace(/ё/g, 'е'))}(?!\\p{L})`, 'u');
  let n = 0;
  for (const t of lower) if (re.test(t)) { n += 1; if (n >= threshold) break; }
  if (n >= threshold) ordinary.push(name);
}
ordinary.sort((a, b) => a.localeCompare(b, 'ru'));

writeFileSync(new URL('../.cache/ordinary.json', import.meta.url),
  JSON.stringify({ posts, share: SHARE, threshold, names: ordinary }, null, 1));
console.log(`постов ${posts}, порог ${threshold}; все слова повседневные — у ${byWords.size} названий, и фраза тоже — у ${ordinary.length}`);
if (argv.includes('--show')) console.log(ordinary.join(' · '));
console.log('→ .cache/ordinary.json');
