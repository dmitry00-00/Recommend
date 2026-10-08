// Названия-ловушки этого корпуса → .cache/ordinary.json. Читают генераторы индексов
// (build-telegram-index, build-essay-index) и передают в nameMatch.
//   npx tsx tools/build-ordinary.mts [--share 0.002] [--show]
// Списка руками здесь нет нарочно: что в этих каналах повседневное слово, а что название,
// знает сам корпус, и с новыми каналами ответ меняется.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

// Английские ловушки (OPS-9, 06.10): ролик англоязычного канала о Вестеросе «Why Did The Targaryens
// Ignore The Others?» привязывался к «Другим» (2001), «The Fool (Samwell II)» — к «Дураку». В
// английском заголовке все слова с заглавной, и капс ничего не выделяет; зато в описаниях — связной
// речи тех же каналов — повседневная фраза пишется строчными («the others», «the beginning»), а
// название — как название («The Witcher»: 1% иначе, Westworld 4%). Оригинальное название, которое
// в описаниях английских роликов написано не своим регистром хотя бы в EN_SHARE случаев (и
// встречается от EN_MIN раз), — ловушка, но только для англоязычных роликов: в русском заголовке
// «The Others» почти наверняка и значит фильм.
const EN_SHARE = 0.6, EN_MIN = 5;
const VIDEOS = new URL('../.cache/youtube/videos.json', import.meta.url);
const CHANNELS = new URL('../.cache/youtube/channels.json', import.meta.url);
const ordinaryEn: string[] = [];
if (existsSync(VIDEOS) && existsSync(CHANNELS)) {
  const enIds = new Set(Object.entries(JSON.parse(readFileSync(CHANNELS, 'utf8')) as Record<string, { language?: string }>)
    .filter(([, c]) => c.language === 'en').map(([id]) => id));
  const prose = (JSON.parse(readFileSync(VIDEOS, 'utf8')) as { channelId?: string; description?: string }[])
    .filter((v) => v.channelId && enIds.has(v.channelId)).map((v) => v.description ?? '').join('\n');
  const originals = new Set(worksIndex({ all: true }).map((w) => w.work.originalTitle).filter((o): o is string => Boolean(o) && /^[A-Za-z' ]+$/.test(o!) && o!.split(' ').length <= 3));
  for (const o of originals) {
    const any = (prose.match(new RegExp(`(?<![A-Za-z])${esc(o)}(?![A-Za-z])`, 'gi')) ?? []).length;
    if (any < EN_MIN) continue;
    // своим регистром — как названо (Title Case) или капсом: капсом английские каналы набирают названия
    // постоянно («CHILDREN OF MEN»), и обычной речью это не делает (ЗП-23, 07.10)
    const titled = (prose.match(new RegExp(`(?<![A-Za-z])${esc(o)}(?![A-Za-z])`, 'g')) ?? []).length
      + (prose.match(new RegExp(`(?<![A-Za-z])${esc(o.toUpperCase())}(?![A-Za-z])`, 'g')) ?? []).length;
    if ((any - titled) / any >= EN_SHARE) ordinaryEn.push(o);
  }
  ordinaryEn.sort();
}

writeFileSync(new URL('../.cache/ordinary.json', import.meta.url),
  JSON.stringify({ posts, share: SHARE, threshold, names: ordinary, namesEn: ordinaryEn }, null, 1));
console.log(`английских ловушек (описания англоязычных каналов, ≥${EN_SHARE * 100}% не своим регистром): ${ordinaryEn.length}`);
console.log(`постов ${posts}, порог ${threshold}; все слова повседневные — у ${byWords.size} названий, и фраза тоже — у ${ordinary.length}`);
if (argv.includes('--show')) console.log(ordinary.join(' · '));
console.log('→ .cache/ordinary.json');
