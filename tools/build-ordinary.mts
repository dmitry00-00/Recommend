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
const raw: string[] = [];
for (const a of parseArgs([])) {
  for (const p of readExport(a.path).posts) {
    addText(counts, p.text);
    lower.push(p.text.toLowerCase().replace(/ё/g, 'е'));
    raw.push(p.text.replace(/ё/g, 'е'));
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
// Фраза из двух и больше слов: считаем, сколько раз она написана строчными посреди речи — не с
// заглавной и не в кавычках (так пишут название). Порог — ниже, чем у слова: фраза в речи по природе
// реже слова. Прежний счёт без учёта регистра на полном корпусе (65 949 постов, порог 132) не поймал
// «главный герой» — и фильм «Главный герой» (2021) получил 83 «упоминания» из закавыченного
// термина (01.10). Одно слово — как раньше.
const phraseThreshold = Math.max(10, Math.round(posts * SHARE / 4));
for (const name of byWords) {
  const low = name.toLowerCase().replace(/ё/g, 'е');
  const multi = /\s/.test(low.trim());
  const re = multi
    ? new RegExp(`(?<![\\p{L}«"„'])${esc(low)}(?![\\p{L}»"“'])`, 'u')
    : new RegExp(`(?<!\\p{L})${esc(low)}(?!\\p{L})`, 'u');
  const need = multi ? phraseThreshold : threshold;
  let n = 0;
  for (const t of multi ? raw : lower) if (re.test(t)) { n += 1; if (n >= need) break; }
  if (n >= need) ordinary.push(name);
}
ordinary.sort((a, b) => a.localeCompare(b, 'ru'));

writeFileSync(new URL('../.cache/ordinary.json', import.meta.url),
  JSON.stringify({ posts, share: SHARE, threshold, names: ordinary }, null, 1));
console.log(`постов ${posts}, порог ${threshold}; все слова повседневные — у ${byWords.size} названий, и фраза тоже — у ${ordinary.length}`);
if (argv.includes('--show')) console.log(ordinary.join(' · '));
console.log('→ .cache/ordinary.json');
