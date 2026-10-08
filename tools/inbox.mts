// Форма Google → база приложения (06.10): ссылки на каналы и ролики, которые владелец вставляет в лист
// «Ссылки» (tools/inbox-google.py), забираются в `registry_inbox` (worker/registry.ts).
//   npx tsx tools/inbox.mts take            — забрать новые строки (утром, из ночного сбора)
//   npx tsx tools/inbox.mts take --clear    — забрать и стереть из формы то, что база подтвердила (16:00, launchd)
//   npx tsx tools/inbox.mts list            — что лежит во входящих
// Стирается только строка, все ссылки которой сервер подтвердил в ответе на этот же забор, и только если
// строка с тех пор не менялась: сеть упала, сервер не ответил — форма остаётся как была.
// Разбор входящих — вкладка «Ссылки» пульта (tools/links-desk.mts): новые ссылки из формы появляются там сами.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mode, registryApi } from './registry-lib.mts';

const root = fileURLToPath(new URL('..', import.meta.url));
const DIR = new URL('../.cache/inbox/', import.meta.url);
const venv = fileURLToPath(new URL('../.cache/venv/bin/python', import.meta.url));
const PY = existsSync(venv) ? venv : 'python3';
const log = (s: string) => console.error(s);

interface FormItem { url: string; film: string | null; note: string | null; row: number }
interface FormRow { row: number; cells: string[]; urls: string[] }

function form(args: string[]): string {
  const r = spawnSync(PY, ['tools/inbox-google.py', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || `код ${r.status}`).trim().split('\n').slice(-3).join(' '));
  return r.stdout;
}

async function take(clear: boolean): Promise<void> {
  if (mode() !== 'server') { log('реестр ещё в файлах (REGISTRY_MODE ≠ server) — входящие некуда класть'); process.exit(1); }
  const got = JSON.parse(form(['pull'])) as { items: FormItem[]; rows: FormRow[]; bad: FormRow[] };
  const stamp = new Date().toISOString();
  log(`форма: строк ${got.rows.length}, ссылок ${got.items.length}${got.bad.length ? `, без ссылки ${got.bad.length} (строки ${got.bad.map((b) => b.row).join(', ')})` : ''}`);
  let held: string[] = [];
  if (got.items.length) {
    const r = await registryApi<{ held: string[] }>('POST', '/api/admin/inbox', {
      rows: got.items.map((x) => ({ url: x.url, film: x.film, note: x.note, sheetAt: stamp })),
    });
    held = r.held;
    log(`в базе: ${held.length} из ${got.items.length}`);
  }
  mkdirSync(DIR, { recursive: true });
  const file = new URL(`last.json`, DIR);
  writeFileSync(file, JSON.stringify({ at: stamp, held, rows: got.rows }, null, 1));
  if (!clear) return;
  if (!got.rows.length) { log('форма пуста — стирать нечего'); return; }
  const res = JSON.parse(form(['clear', fileURLToPath(file)])) as { deleted: number; kept: number };
  log(`форма: стёрто строк ${res.deleted}, осталось ${res.kept}`);
}

async function list(): Promise<void> {
  const r = await registryApi<{ rows: { url: string; film: string | null; status: string; taken_at: string; result?: unknown }[] }>('GET', '/api/admin/inbox');
  const by: Record<string, number> = {};
  for (const x of r.rows) by[x.status] = (by[x.status] ?? 0) + 1;
  log(`входящих: ${r.rows.length} (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(', ')})`);
  for (const x of r.rows.filter((y) => y.status !== 'done').slice(0, 40)) log(`  ${x.status} ${x.url}${x.film ? ` — ${x.film}` : ''}`);
}

const cmd = process.argv[2];
try {
  if (cmd === 'take') await take(process.argv.includes('--clear'));
  else if (cmd === 'list') await list();
  else { log('npx tsx tools/inbox.mts take [--clear] | list'); process.exit(2); }
} catch (err) {
  log(`входящие: ${(err as Error).message}`);
  process.exit(1);
}
