// «Нет у нас» из пультов без таблицы (02.10): ролик, к которому человек вписал фильм, которого
// нет в справочнике, — опознать по Wikidata и применить, не дожидаясь синхронизации с Google.
//   npx tsx tools/apply-typed.mts [--no-resolve]
//
// Раньше это делал только круг таблицы (deploy/markup-sync.command): import-markup.py
// складывал такие строки в .cache/markup/typed.json, tools/resolve-markup-films.mts их опознавал,
// второй импорт применял. Пульты ссылок и «Проверка» пишут решения сразу в
// tools/markup-verdicts.json, и их «нет у нас» ждали таблицы. Здесь тот же круг, но только по
// решениям пультов; строки таблицы в typed.json не трогаются (их перепишет следующий импорт).
// Правило применения — то же, что у import-markup.py: выбор из тёзок без уверенности — `guess`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { saveVerdicts } from './registry-lib.mts';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const VERDICTS = new URL('tools/markup-verdicts.json', root);
const RESOLVED = new URL('tools/markup-resolved.json', root);
const TYPED = new URL('.cache/markup/typed.json', root);
const DESKS = new Set(['desk', 'check']);
const SHEET_OF: Record<string, string> = { desk: 'пульт ссылок', check: 'проверка' };

type V = { key: string | null; why?: string; film?: string; title?: string; from?: string; at?: string; guess?: boolean; err?: string };
const today = new Date().toISOString().slice(0, 10);

async function apply(): Promise<{ applied: number; waiting: { video: string; film: string; title: string; sheet: string }[] }> {
  const body = JSON.parse(readFileSync(VERDICTS, 'utf8')) as { updated?: string; videos: Record<string, V> };
  const resolved = existsSync(RESOLVED) ? (JSON.parse(readFileSync(RESOLVED, 'utf8')).videos ?? {}) as Record<string, { typed: string; key: string; label: string; sure: boolean }> : {};
  let applied = 0;
  const waiting: { video: string; film: string; title: string; sheet: string }[] = [];
  for (const [vid, v] of Object.entries(body.videos)) {
    if (!DESKS.has(v.from ?? '') || v.key || v.why !== 'нет у нас' || !v.film) continue;
    const r = resolved[vid];
    if (r && r.typed === v.film && r.key) {
      body.videos[vid] = { key: r.key, film: r.label, from: v.from, at: today, ...(r.sure ? {} : { guess: true }), ...(v.err ? { err: v.err } : {}) };
      applied += 1;
    } else waiting.push({ video: vid, film: v.film, title: v.title ?? '', sheet: SHEET_OF[v.from!] });
  }
  if (applied) {
    body.updated = today;
    await saveVerdicts(body, 'typed');
  }
  return { applied, waiting };
}

let { applied, waiting } = await apply();
if (waiting.length) {
  // строки таблицы оставляем как есть, строки пультов — свежие
  const prev = existsSync(TYPED) ? (JSON.parse(readFileSync(TYPED, 'utf8')).rows ?? []) as { sheet?: string }[] : [];
  const rows = [...prev.filter((r) => !Object.values(SHEET_OF).includes(r.sheet ?? '')), ...waiting];
  writeFileSync(TYPED, JSON.stringify({ rows }, null, 1));
  if (!process.argv.includes('--no-resolve')) {
    console.error(`опознаю по Wikidata: ${waiting.length} (${[...new Set(waiting.map((w) => w.film))].slice(0, 8).join(', ')}${waiting.length > 8 ? '…' : ''})`);
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'tsx', 'tools/resolve-markup-films.mts'],
      { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
    if (r.status !== 0) { console.log(`«нет у нас»: опознаватель упал (код ${r.status}), применено ${applied}, ждут ${waiting.length}`); process.exit(1); }
    const second = await apply();
    applied += second.applied;
    waiting = second.waiting;
  }
}
console.log(`«нет у нас»: применено ${applied}, ждут ${waiting.length}${waiting.length ? ` (${[...new Set(waiting.map((w) => w.film))].slice(0, 5).join(', ')})` : ''}`);
