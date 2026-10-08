// Копии базы участников с сервера (ЗП-4, 06.10). Сервер сам снимает копию каждую ночь (server/backup.js),
// но держит её на своём диске — от потери диска она не спасает. Этот скрипт забирает копию на Mac.
//
//   npx tsx tools/db-backup.mts pull             — снять свежую копию на сервере и забрать её (ночной сбор)
//   npx tsx tools/db-backup.mts list             — копии на сервере и здесь
//   npx tsx tools/db-backup.mts restore <имя>    — восстановить сервер из его копии (имя из list)
//   npx tsx tools/db-backup.mts restore <файл>   — восстановить из копии с этого Mac (.sqlite.gz)
//
// Сервер — TM_SERVER (по умолчанию боевой), токен — TM_ADMIN_TOKEN из .env.local. Копии здесь —
// TM_DB_BACKUP_DIR (по умолчанию ~/recomend-backups/db, вне репозитория: он публичный, а в копиях —
// данные участников); хранится TM_DB_BACKUP_KEEP последних (30).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = process.env.TM_ADMIN_TOKEN;
const dir = process.env.TM_DB_BACKUP_DIR ?? join(homedir(), 'recomend-backups', 'db');
const keep = Number(process.env.TM_DB_BACKUP_KEEP) || 30;
if (!token) { console.error('нет TM_ADMIN_TOKEN в .env.local'); process.exit(1); }
const auth = { authorization: `Bearer ${token}` };

interface Backup { name: string; kind: string; size: number; at: string }

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${server}${path}`, { ...init, headers: { ...auth, ...(init.headers ?? {}) } });
  const text = await res.text();
  if ((res.status === 401 || res.status === 404) && path.startsWith('/api/admin/backups')) {
    // сборка до 06.10 ручек копий не знает: запрос уходит в воркер, и тот отвечает 401 — как на чужой токен.
    // Различаем по ручке, которая есть и в старой сборке: токен там принят — значит, сборка старая
    const probe = await fetch(`${server}/api/admin/registry/version`, { headers: auth }).catch(() => undefined);
    if (probe?.ok) {
      console.log(`сервер ${server} ещё на сборке без копий базы (до 06.10) — копия НЕ снята, нужна выкладка`);
      process.exit(0);
    }
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
    const made = await api<Backup & { check?: { users: number; ratings: number } }>('/api/admin/backups', { method: 'POST' });
    const res = await fetch(`${server}/api/admin/backups/${encodeURIComponent(made.name)}`, { headers: auth });
    if (!res.ok) throw new Error(`скачивание ${made.name}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length !== made.size) throw new Error(`скачано ${buf.length} байт из ${made.size}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, made.name), buf);
    const all = local();
    for (const old of all.slice(keep)) rmSync(join(dir, old));
    console.log(`копия базы: ${made.name}, ${kb(buf.length)}${made.check ? `, участников ${made.check.users}, оценок ${made.check.ratings}` : ''} → ${dir} (здесь ${Math.min(all.length, keep)})`);
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
    console.error('команды: pull | list | restore <имя или файл>');
    process.exit(1);
  }
} catch (err) {
  console.error(`копии базы: ${(err as Error).message}`);
  process.exit(1);
}
