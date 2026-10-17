// Копии базы участников с сервера (ЗП-4, 06.10). Сервер сам снимает копию каждую ночь (server/backup.js),
// но держит её на своём диске — от потери диска она не спасает. Этот скрипт забирает копию на Mac.
//
//   npx tsx tools/db-backup.mts pull             — забрать копию: самая новая на сервере моложе 20 ч — её (если её ещё
//                                                  нет здесь), старше — снять новую (сбор, агент launchd каждые 6 ч)
//   npx tsx tools/db-backup.mts pull --fresh     — снять новую копию на сервере в любом случае и забрать (перед выкладкой)
//   npx tsx tools/db-backup.mts list             — копии на сервере и здесь
//   npx tsx tools/db-backup.mts restore <имя>    — восстановить сервер из его копии (имя из list)
//   npx tsx tools/db-backup.mts restore <файл>   — восстановить из копии с этого Mac (.sqlite.gz)
//
// Сервер — TM_SERVER (по умолчанию боевой), токен — TM_ADMIN_TOKEN из .env.local. Копии здесь —
// TM_DB_BACKUP_DIR (по умолчанию ~/recomend-backups/db, вне репозитория: он публичный, а в копиях —
// данные участников); хранится TM_DB_BACKUP_KEEP последних (30).
//
// 17.10 (аудит, волна 1, п. 10): копия не снята по любой причине — код выхода 1 (раньше старая сборка сервера
// давала 0, и сбор считал шаг удачным). `pull` без --fresh не снимает новую копию, если на сервере есть моложе
// TM_DB_BACKUP_FRESH_HOURS (20): сервер держит 14 копий всех видов вместе, и частые ручные вытеснили бы ночные.
// Скачанная копия проверяется здесь же: распаковывается и начинается с заголовка SQLite.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = process.env.TM_ADMIN_TOKEN;
const dir = process.env.TM_DB_BACKUP_DIR ?? join(homedir(), 'recomend-backups', 'db');
const keep = Number(process.env.TM_DB_BACKUP_KEEP) || 30;
const freshHours = Number(process.env.TM_DB_BACKUP_FRESH_HOURS) || 20;
if (!token) { console.error('нет TM_ADMIN_TOKEN в .env.local'); process.exit(1); }
const auth = { authorization: `Bearer ${token}` };

interface Backup { name: string; kind: string; size: number; at: string }

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // предел 2 мин (17.10): снять копию большой базы — секунды, но зависший прокси не должен держать агент launchd
  const res = await fetch(`${server}${path}`, { signal: AbortSignal.timeout(120e3), ...init, headers: { ...auth, ...(init.headers ?? {}) } });
  const text = await res.text();
  if ((res.status === 401 || res.status === 404) && path.startsWith('/api/admin/backups')) {
    // сборка до 06.10 ручек копий не знает: запрос уходит в воркер, и тот отвечает 401 — как на чужой токен.
    // Различаем по ручке, которая есть и в старой сборке: токен там принят — значит, сборка старая
    const probe = await fetch(`${server}/api/admin/registry/version`, { headers: auth, signal: AbortSignal.timeout(30e3) }).catch(() => undefined);
    // 17.10: раньше здесь был выход с кодом 0 — копии нет, а шаг «готово»
    if (probe?.ok) throw new Error(`сервер ${server} ещё на сборке без копий базы (до 06.10) — копия НЕ снята, нужна выкладка`);
  }
  const hint = res.status === 401 && path.startsWith('/api/admin/backups')
    ? ' — токен не принят, или сервер ещё на сборке без копий базы (до 06.10): нужна выкладка' : '';
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text.slice(0, 300)}${hint}`);
  return JSON.parse(text) as T;
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} КБ`;
const local = () => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.sqlite.gz')).sort().reverse() : []);

const [cmd = 'pull', target] = process.argv.slice(2);

try {

  if (cmd === 'pull') {
    const fresh = process.argv.includes('--fresh');
    let pick: (Backup & { check?: { users: number; ratings: number } }) | undefined;
    let reused = false;
    if (!fresh) {
      const r = await api<{ backups: Backup[] }>('/api/admin/backups');
      const newest = [...r.backups].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
      const age = newest ? (Date.now() - Date.parse(newest.at)) / 3600e3 : Infinity;
      if (newest && age < freshHours) { pick = newest; reused = true; }
    }
    pick ??= await api<Backup & { check?: { users: number; ratings: number } }>('/api/admin/backups', { method: 'POST' });
    // имя идёт в путь на диске — только такие, какие сервер и умеет называть (server/backup.js)
    if (!/^tm-[\w-]+\.sqlite\.gz$/.test(pick.name)) throw new Error(`странное имя копии: ${JSON.stringify(pick.name).slice(0, 80)}`);
    const age = `${((Date.now() - Date.parse(pick.at)) / 3600e3).toFixed(1)} ч назад`;
    const here = join(dir, pick.name);
    if (reused && existsSync(here) && statSync(here).size === pick.size) {
      console.log(`копия базы: ${pick.name} (снята ${age}, моложе ${freshHours} ч) уже здесь — новую не снимаю (${dir}, здесь ${local().length})`);
    } else {
      const res = await fetch(`${server}/api/admin/backups/${encodeURIComponent(pick.name)}`, { headers: auth, signal: AbortSignal.timeout(300e3) });
      if (!res.ok) throw new Error(`скачивание ${pick.name}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length !== pick.size) throw new Error(`скачано ${buf.length} байт из ${pick.size}`);
      let raw: Buffer;
      try { raw = gunzipSync(buf); } catch (err) { throw new Error(`${pick.name} не распаковывается: ${(err as Error).message}`); }
      if (raw.subarray(0, 16).toString('latin1') !== 'SQLite format 3\0') throw new Error(`${pick.name}: внутри не база SQLite`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${here}.tmp`, buf);
      renameSync(`${here}.tmp`, here);
      const all = local();
      for (const old of all.slice(keep)) rmSync(join(dir, old));
      console.log(`копия базы: ${pick.name} (${reused ? `готовая, снята ${age}` : 'снята сейчас'}), ${kb(buf.length)}${pick.check ? `, участников ${pick.check.users}, оценок ${pick.check.ratings}` : ''} → ${dir} (здесь ${Math.min(all.length, keep)})`);
    }
  } else if (cmd === 'list') {
    const r = await api<{ engine: string; backups: Backup[] }>('/api/admin/backups');
    console.log(`сервер (${r.engine === 'sqlite' ? 'node:sqlite' : 'sql.js'}):`);
    for (const b of r.backups) console.log(`  ${b.name}  ${kb(b.size)}`);
    console.log(`здесь, ${dir}:`);
    for (const f of local()) console.log(`  ${f}  ${kb(statSync(join(dir, f)).size)}`);
  } else if (cmd === 'restore' && target) {
    // копия с Mac — телом запроса; иначе — имя копии на сервере
    const file = existsSync(target) ? target : existsSync(join(dir, target)) ? join(dir, target) : undefined;
    const r = file
      ? await api<Record<string, unknown>>('/api/admin/restore', { method: 'POST', headers: { 'content-type': 'application/gzip' }, body: readFileSync(file) })
      : await api<Record<string, unknown>>('/api/admin/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ backup: target }) });
    console.log(`восстановлено из ${file ? basename(file) : target}:`, JSON.stringify(r));
  } else {
    console.error('команды: pull [--fresh] | list | restore <имя или файл>');
    process.exit(1);
  }
} catch (err) {
  const e = err as Error & { cause?: { code?: string } };
  console.error(`копии базы: ${e.name === 'TimeoutError' ? 'сервер не ответил вовремя' : e.message}${e.cause?.code ? ` (${e.cause.code}, ${server})` : ''} — копия НЕ снята`);
  process.exit(1);
}
