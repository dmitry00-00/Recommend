// Перепроверка разметки по классификатору (24.10, слово владельца «перепроверить уже готовую разметку»): классификатор
// на текстовом энкодере (tools/markup-encoder.py --dump) оценивает каждый размеченный фильм вне своей части — модель фильм
// не видела. Где оценка уровня расходится с разметкой на --gap и больше, агент перечитывает вещь: оставить или исправить.
// Расхождение — повод перечитать, а не ошибка: классификатор видит только описание (MAE ~0,8), разметчик — фильм.
//   npx tsx tools/markup-recheck.mts queue <заход> [--dump .cache/eval/markup-encoder/oof-2410.json] [--gap 3] [--size 30]
//   npx tsx tools/markup-recheck.mts apply <заход> [--dry]
// Очередь и ответы — .cache/markup/recheck-<заход>/ (batch-N.tsv → out-N.json). Ответ — массив строк формата
// tools/markup-wave.spec.md («Выход») плюс "verdict": "keep" | "fix" и "why" (одна фраза). apply подменяет запись
// разметки на месте (в draftAnnotations*.ts / seriesAnnotations*.ts повтор ключа в словаре — ошибка TS) с пометкой
// «перепроверено»; keep — ничего не меняет. Своя разметка владельца (не черновик) сюда не попадает: её нет в этих файлах.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const [cmd, wave] = argv;
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
if (!wave || !['queue', 'apply'].includes(cmd)) { console.error('queue|apply <заход>'); process.exit(1); }
const DIR = `.cache/markup/recheck-${wave}/`;
const FILES = ['src/mocks/draftAnnotations.ts', 'src/mocks/draftAnnotationsLinks.ts', 'src/mocks/seriesAnnotations.ts', 'src/mocks/seriesAnnotationsWiki.ts'];
const OPS = new Set(['pattern_recognition', 'causal_reasoning', 'perspective_taking', 'analogical_thinking', 'synthesis', 'abstraction', 'metacognition', 'critical_analysis']);
const BARRIERS = new Set(['Медленный темп', 'Сатирическая условность', 'Хоррор-образы', 'Нелинейное время', 'Размытая граница реальности', 'Без сюжета в привычном смысле', 'Долгий хронометраж', 'Разговорная форма', 'Нарастающий дискомфорт', 'Фрагментарная структура', 'Одна комната', 'Театральная манера', 'Непривычная мифология', 'Мало слов', 'Много линий', 'Ненадёжный рассказчик', 'Условная актёрская манера', 'Смена жанра', 'Смена рассказчиков без предупреждения', 'Найденная плёнка', 'Архаичная речь', 'Кукольная эстетика', 'Чёрно-белое изображение', 'Немое кино', 'Музыкальные номера']);
const WARNINGS = new Set(['Насилие', 'Жестокость', 'Хоррор-образы', 'Сексуальные сцены', 'Нецензурная лексика', 'Насилие над детьми', 'Физиологические сцены', 'Сексуальное насилие', 'Самоубийство', 'Наркотики', 'Алкоголь', 'Жестокость к животным', 'Самоповреждение']);
const keyRe = (k: string) => new RegExp(`\\n  '${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}': a\\([\\s\\S]*?'\\),\\n`);

if (cmd === 'queue') {
  const dump = JSON.parse(readFileSync(opt('--dump') ?? '.cache/eval/markup-encoder/oof-2410.json', 'utf8')) as { key: string; level: number; ridge: number; top_op: string; top_pred: string }[];
  const films = new Map((JSON.parse(readFileSync('.cache/eval/markup-encoder/films.json', 'utf8')).films as Record<string, unknown>[]).map((f) => [String(f.key), f]));
  const GAP = Number(opt('--gap') ?? 3), SIZE = Number(opt('--size') ?? 30);
  const src = FILES.filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
  const pick = dump.filter((r) => Math.abs(r.ridge - r.level) >= GAP && keyRe(r.key).test(src)).sort((a, b) => Math.abs(b.ridge - b.level) - Math.abs(a.ridge - a.level));
  mkdirSync(DIR, { recursive: true });
  const cell = (v: unknown) => String(v ?? '').replace(/[\t\n]+/g, ' ');
  const head = ['key', 'название', 'оригинал', 'год', 'жанры', 'автор', 'разметка сейчас', 'классификатор: уровень', 'классификатор: главная операция', 'описание'];
  let n = 0;
  for (let i = 0; i < pick.length; i += SIZE) {
    const rows = pick.slice(i, i + SIZE).map((r) => {
      const f = films.get(r.key) ?? {};
      return [r.key, f.title, f.orig, f.year, f.genres, f.creatorName, typeof f.label === 'string' ? f.label : JSON.stringify(f.label), r.ridge.toFixed(1), r.top_pred, String(f.text ?? '').slice(0, 1500)].map(cell).join('\t');
    });
    writeFileSync(`${DIR}batch-${++n}.tsv`, [head.join('\t'), ...rows].join('\n') + '\n');
  }
  writeFileSync(`${DIR}queue.json`, JSON.stringify(pick.map((r) => r.key)));
  console.log(`расхождение уровня ≥ ${GAP}: ${pick.length} (из ${dump.length} оценённых; не черновики пропущены); пачек ${n} по ${SIZE} → ${DIR}`);
} else {
  const DRY = argv.includes('--dry');
  const queue = new Set(JSON.parse(readFileSync(`${DIR}queue.json`, 'utf8')) as string[]);
  type Row = { key: string; verdict: string; why?: string; ops: [string, number][]; level: number; barriers?: string[]; warnings?: string[]; niche?: boolean; confidence: string; by?: string; what: string };
  const texts = new Map(FILES.filter(existsSync).map((f) => [f, readFileSync(f, 'utf8')]));
  const bad: string[] = [];
  let keep = 0, fix = 0;
  const str = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const date = new Date().toISOString().slice(0, 10);
  for (const f of readdirSync(DIR).filter((f) => /^out-\d+\.json$/.test(f))) {
    for (const r of JSON.parse(readFileSync(DIR + f, 'utf8')) as Row[]) {
      if (!queue.has(r.key)) { bad.push(`${f} ${r.key}: не из очереди`); continue; }
      if (r.verdict === 'keep') { keep++; continue; }
      const why = r.verdict !== 'fix' ? 'verdict'
        : !Array.isArray(r.ops) || !r.ops.length || r.ops.length > 3 || r.ops.some(([o, v]) => !OPS.has(o) || !(v > 0 && v <= 1)) ? 'операции'
        : !(Number.isInteger(r.level) && r.level >= 1 && r.level <= 10) ? 'уровень'
        : (r.barriers ?? []).some((x) => !BARRIERS.has(x)) ? 'барьер'
        : (r.warnings ?? []).some((x) => !WARNINGS.has(x)) ? 'предупреждение'
        : !['high', 'medium', 'low'].includes(r.confidence) ? 'уверенность'
        : typeof r.what !== 'string' || r.what.length < 30 || r.what.length > 200 ? 'строка what'
        : undefined;
      if (why) { bad.push(`${f} ${r.key}: ${why}`); continue; }
      const file = [...texts].find(([, t]) => keyRe(r.key).test(t))?.[0];
      if (!file) { bad.push(`${f} ${r.key}: запись не найдена`); continue; }
      const entry = `\n  // перепроверено ${date} (tools/markup-recheck.mts, заход ${wave}): ${String(r.why ?? '').replace(/\n/g, ' ').slice(0, 160)}\n  ${str(r.key)}: a(${JSON.stringify(r.ops.map(([o, v]) => [o, Math.round(v * 100) / 100])).replace(/"/g, "'")}, ${r.level}, ${JSON.stringify(r.barriers ?? []).replace(/"/g, "'")}, ${JSON.stringify(r.warnings ?? []).replace(/"/g, "'")}, ${Boolean(r.niche)}, '${r.confidence}',\n    ${str(r.what)}),\n`;
      texts.set(file, texts.get(file)!.replace(keyRe(r.key), () => entry));
      fix++;
    }
  }
  console.log(`оставить ${keep}, исправить ${fix}; отброшено ${bad.length}`);
  for (const b of bad.slice(0, 30)) console.log(`  ✗ ${b}`);
  if (!DRY) for (const [f, t] of texts) if (t !== readFileSync(f, 'utf8')) { writeFileSync(f, t); console.log(`→ ${f}`); }
}
