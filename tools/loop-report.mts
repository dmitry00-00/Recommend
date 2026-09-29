// Отчёт петли прогноза по файлу базы (трек Б, шаг Б2). Тот же расчёт, что у эндпоинта
// /api/report/loop (worker/loop.ts), но офлайн — по скачанной копии базы с bothost:
// «Файлы» → /app/data/tm.sqlite → скачать.
//
//   npx tsx tools/loop-report.mts ~/Downloads/tm.sqlite            — все участники
//   npx tsx tools/loop-report.mts ~/Downloads/tm.sqlite --user u-…  — один участник
//   … --json                                                        — сырой JSON
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loopReport, DIFFICULTIES, type LoopRows } from '../worker/loop.ts';

const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error('укажите путь к tm.sqlite'); process.exit(1); }
const userId = rest.includes('--user') ? rest[rest.indexOf('--user') + 1] : undefined;

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');
const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(file));
const all = <T,>(sql: string): T[] => {
  const stmt = db.prepare(sql + (userId ? ' WHERE user_id = ?' : ''));
  if (userId) stmt.bind([userId]);
  const out: T[] = [];
  while (stmt.step()) out.push(stmt.getAsObject() as T);
  stmt.free();
  return out;
};
const has = (table: string, column: string) => {
  const s = db.prepare(`PRAGMA table_info(${table})`); const cols: string[] = [];
  while (s.step()) cols.push(String(s.getAsObject().name)); s.free(); return cols.includes(column);
};
const tableExists = (t: string) => db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${t}'`).length > 0;

const rows: LoopRows = {
  predictions: all(`SELECT user_id, entry_id, work_id, expected, model, ${has('prediction', 'model_p') ? 'model_p' : 'NULL AS model_p'}, at FROM prediction`),
  checkins: all('SELECT user_id, entry_id, work_id, status, perceived, reason, at FROM checkin'),
  journal: all(`SELECT user_id, entry_id, started_at, work_id, status, ${has('journal', 'eagerness') ? 'eagerness' : 'NULL AS eagerness'} FROM journal`),
  feedback: all(`SELECT user_id, rec_id, work_id, action, reason, at, ${has('feedback', 'eagerness') ? 'eagerness' : 'NULL AS eagerness'} FROM feedback`),
  impressions: tableExists('impression') ? all('SELECT user_id, slate_id, rec_id, work_id, slot, rank, at FROM impression') : [],
};
const r = loopReport(rows);
if (rest.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

const pct = (x?: number) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const line = (name: string, s?: { n: number; brier: number; exact: number }) =>
  `| ${name} | ${s?.n ?? '—'} | ${s?.brier ?? '—'} | ${pct(s?.exact)} |`;
console.log(`# Петля прогноза — ${r.generatedAt.slice(0, 16).replace('T', ' ')}\n`);
console.log(`Участников: ${r.users}. Наблюдений (прогноз + «как пошло»): ${r.observations}.\n\n> ${r.note}\n`);
console.log('## Калибровка\n\n| | N | Брайер | Точно |\n|---|---|---|---|');
console.log([line('Модель', r.calibration.model), line('Человек', r.calibration.human),
  line('Частота по всем', r.calibration.baseRate), line('Всегда «в самый раз»', r.calibration.alwaysJustRight)].join('\n'));
for (const who of ['model', 'human'] as const) {
  console.log(`\n## ${who === 'model' ? 'Модель' : 'Человек'}: прогноз (строки) против факта (столбцы)\n`);
  console.log(`| | ${DIFFICULTIES.join(' | ')} |\n|---|---|---|---|`);
  for (const a of DIFFICULTIES) console.log(`| ${a} | ${DIFFICULTIES.map((b) => r.confusion[who][a][b]).join(' | ')} |`);
}
console.log(`\nЧеловек и модель совпали: ${pct(r.agreement.humanModel)} (из ${r.agreement.n}).`);
console.log(`\n## Лента\n\nПоказано кадров ${r.slate.impressions} в ${r.slate.slates} лентах; начали ${r.slate.start} (${pct(r.slate.acceptance)}), в планы ${r.slate.save}, «не сейчас» ${r.slate.dismiss}.`);
if (Object.keys(r.dismiss).length) console.log(`Причины «не сейчас»: ${JSON.stringify(r.dismiss)}`);
console.log(`Броски из-за фильма: ${r.abandon.fit}, по обстоятельствам: ${r.abandon.circumstances}. Начали, но не посмотрели: ответили ${r.notWatched.answered}, без ответа ${r.notWatched.expired}.`);
if (Object.keys(r.plans).length) {
  console.log('\n## Планы: насколько хотелось → дошли ли\n\n| хочется | отложено | начато | досмотрено |\n|---|---|---|---|');
  for (const [k, v] of Object.entries(r.plans).sort(([a], [b]) => Number(b) - Number(a))) {
    console.log(`| ${k === '0' ? 'без оценки' : k} | ${v.saved} | ${v.started} | ${v.finished} |`);
  }
}
console.log(`\n## Брошенное\n\nБросили ${r.abandon.n}, медиана до броска ${r.abandon.medianDays ?? '—'} дн. Причины: ${JSON.stringify(r.abandon.reasons)}`);
