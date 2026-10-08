// Очередь разметки владельца с телефона (06.10): то же, что вкладки «Проверка» и «Рубрики» пульта,
// но на экране приложения (src/screens/OwnerDeskScreen.tsx) — пульт живёт на Mac, а размечать удобно
// с телефона. Очередь кладётся на сервер рядом со справочниками и раздаётся только владельцу; решения
// он пишет туда же, забирает их tools/owner-pull.mts.
//   npx tsx tools/owner-queue.mts [--check 1500] [--lens 1500] [--dry]
// Без --dry — PUT /api/admin/owner-queue (TM_SERVER и TM_ADMIN_TOKEN из .env.local, как у
// publish-reference). Копия — .cache/owner-queue.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { checkRows } from './check-desk.mts';
import { filmOptions } from './links-desk-lib.mts';
import { worksIndex } from './works-index.mts';
import { LENSES, LENS_RU, readLensFile, readLensVerdicts } from './lens-lib.mts';
import { WEAK } from './lens-desk.mts';

loadEnvFile();
const arg = (name: string, def: number) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) || def : def; };
const DRY = process.argv.includes('--dry');
const CHECK = arg('check', 1500);
const LENS = arg('lens', 1500);

// привязки: очередь «Проверки» — спорные, непроверенные, без привязки с находкой модели
const check = checkRows()
  .filter((r) => r.group === 'spor' || r.group === 'check' || r.group === 'gap')
  .slice(0, CHECK)
  .map((r) => ({
    id: r.id, title: r.title, ...(r.channel ? { channel: r.channel } : {}), ...(r.date ? { date: r.date.slice(0, 10) } : {}),
    ...(r.minutes ? { minutes: r.minutes } : {}), group: r.group,
    ...(r.film ? { film: r.film } : {}), ...(r.evidence ? { evidence: r.evidence } : {}),
    // что говорит модель: «согласна», «другой фильм», «не о фильме»…; Enter пульта — её фильм
    ...(r.llm ? { model: { flag: r.llm.flag, says: r.llm.flagRu, ...(r.llm.label ? { film: r.llm.label } : {}),
      ...(r.llm.typed ? { typed: r.llm.typed } : {}), ...(r.llm.note ? { note: r.llm.note } : {}), ...(r.llm.conf != null ? { conf: r.llm.conf } : {}),
      // для «несколько фильмов» и «о франшизе / о человеке» — подсказки модели заранее в полях
      ...(r.llm.also.length ? { also: r.llm.also.map((a) => a.label).filter(Boolean) } : {}),
      ...(r.llm.about ? { about: { kind: r.llm.about.kind, title: r.llm.about.label ?? r.llm.about.title } } : {}) } } : {}),
  }));

// рубрики: не решённые человеком; сначала слабые рубрики модели, в них — наименее уверенные
const human = readLensVerdicts();
const titleOf = new Map(worksIndex({ all: true }).map((w) => [w.key, `${w.work.title}${w.work.year ? ` (${w.work.year})` : ''}`]));
const lens = Object.entries(readLensFile().items)
  .filter(([id]) => id.startsWith('yt:') && !human[id])
  .sort(([, a], [, b]) => Number(WEAK.includes(b.lens)) - Number(WEAK.includes(a.lens)) || (a.conf ?? 1) - (b.conf ?? 1))
  .slice(0, LENS)
  .map(([id, l]) => ({
    id, title: l.title, ...(l.channel ? { channel: l.channel } : {}), lens: l.lens, ...(l.also ? { also: l.also } : {}),
    ...(l.conf != null ? { conf: l.conf } : {}), works: l.keys.slice(0, 3).map((k) => titleOf.get(k) ?? k),
  }));

// ярлыки фильмов — для «не тот фильм»: тот же список, по которому пульт узнаёт вписанное
const films = filmOptions(worksIndex({ all: true })).map((f) => f.label);

const queue = {
  at: new Date().toISOString(),
  lenses: LENSES.map((id) => ({ id, name: LENS_RU[id], weak: WEAK.includes(id) })),
  check, lens, films,
};
const text = JSON.stringify(queue);
mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
writeFileSync(new URL('../.cache/owner-queue.json', import.meta.url), text);
console.log(`очередь: привязок ${check.length}, рубрик ${lens.length}, фильмов в списке ${films.length}; ${(text.length / 1024).toFixed(0)} КБ`);

if (!DRY) {
  const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
  const token = process.env.TM_ADMIN_TOKEN;
  if (!token) { console.error('нет TM_ADMIN_TOKEN в .env.local — отправить нечем'); process.exit(1); }
  const r = await fetch(`${server}/api/admin/owner-queue`, { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: text });
  if (!r.ok) { console.error(`сервер ответил ${r.status}: ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  console.log(`→ ${server} (${r.status})`);
}
