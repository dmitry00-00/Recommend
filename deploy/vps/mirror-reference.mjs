// Справочники со старого сервера на новый один в один (deploy/vps/migrate.md): GET /api/reference/<имя> со старого
// (данные общие, отдаются без токена) → PUT на новый с TM_ADMIN_TOKEN → GET с нового и сверка sha256.
// Зачем, если есть tools/publish-reference.mts: публикация собирает справочники заново из src/mocks и сейчас может
// стоять на стопе (.cache/publish.hold) или отличаться от того, что на боевом; для переезда нужно ровно то, что
// видят люди. После переезда справочники публикуются как обычно — publish-reference с TM_SERVER нового адреса.
//
//   node deploy/vps/mirror-reference.mjs --to https://новый [--from https://старый] [--dry] [--verify]
//     --from     по умолчанию TM_SERVER из .env.local (до переключения — bothost)
//     --to       по умолчанию TM_VPS_SERVER из окружения/.env.local
//     --dry      только прочитать со старого: что есть, размеры, хеши
//     --verify   ничего не писать: сверить хеши старого и нового
//
// Имена — из worker/index.ts (REFERENCE_NAMES), чтобы не разъехаться со списком сервера. Не справочники и сюда не
// входят: списки просмотренного (seed--*.json — tools/publish-seed.mts, tools/kinopoisk-desk), очередь владельца
// (owner-queue.json — tools/owner-queue.mts), обложки книг и кеш картинок (наберутся сами; tools/warm-covers.mts).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = existsSync(join(ROOT, '.env.local')) ? readFileSync(join(ROOT, '.env.local'), 'utf8') : '';
const envVar = (k) => process.env[k] ?? [...env.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/gm)].find((m) => m[1] === k)?.[2].replace(/^['"]|['"]$/g, '');
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes('--dry');
const VERIFY = args.includes('--verify');
const from = (arg('--from') ?? envVar('TM_SERVER') ?? '').replace(/\/+$/, '');
const to = (arg('--to') ?? envVar('TM_VPS_SERVER') ?? '').replace(/\/+$/, '');
const token = envVar('TM_ADMIN_TOKEN');
const fail = (m) => { console.error(`✖ ${m}`); process.exit(1); };
if (!from) fail('нет --from и TM_SERVER');
if (!DRY && !to) fail('нет --to и TM_VPS_SERVER');
if (!DRY && from === to) fail(`--from и --to совпадают (${from})`);
if (!DRY && !VERIFY && !token) fail('нет TM_ADMIN_TOKEN (.env.local) — писать на новый нечем');

// REFERENCE_NAMES из worker/index.ts: строки в new Set([...]) плюс доли analyses-00…NN, если они там есть
const src = readFileSync(join(ROOT, 'worker', 'index.ts'), 'utf8');
const decl = /export const REFERENCE_NAMES = new Set\(\[([\s\S]*?)\]\);/.exec(src)?.[1];
if (!decl) fail('не нашёл REFERENCE_NAMES в worker/index.ts');
const names = [...decl.replace(/\/\/.*$/gm, '').matchAll(/'([A-Za-z0-9-]+)'/g)].map((m) => m[1]);
const shards = /length:\s*(\d+)\s*\}[^\n]*analyses-/.exec(decl);
if (shards) for (let i = 0; i < Number(shards[1]); i++) names.push(`analyses-${String(i).padStart(2, '0')}`);

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
async function get(base, name) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${base}/api/reference/${name}`, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(60e3) });
      if (res.status === 404) return { status: 404 };
      const buf = Buffer.from(await res.arrayBuffer());
      if (!res.ok) throw new Error(`${res.status} ${buf.toString('utf8', 0, 120)}`);
      return { status: 200, buf, sha: sha(buf) };
    } catch (err) {
      // bothost то отвечает, то нет (reports/hosting-1810.md) — три попытки
      if (attempt >= 3) return { status: 0, error: err.message };
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

console.log(`${DRY ? 'чтение' : VERIFY ? 'сверка' : 'перенос'}: ${from}${DRY ? '' : ` → ${to}`} (${names.length} имён)`);
let moved = 0, same = 0, missing = 0, bad = 0, bytes = 0;
for (const name of names) {
  const a = await get(from, name);
  if (a.status === 404) { missing++; continue; }
  if (!a.buf) { bad++; console.log(`  ✖ ${name}: со старого не прочитался (${a.error})`); continue; }
  bytes += a.buf.length;
  if (DRY) { console.log(`  ${name}: ${(a.buf.length / 1024).toFixed(0)} КБ ${a.sha.slice(0, 12)}`); continue; }
  if (!VERIFY) {
    try { JSON.parse(a.buf.toString('utf8')); } catch { bad++; console.log(`  ✖ ${name}: со старого пришёл не JSON`); continue; }
    const res = await fetch(`${to}/api/reference/${name}`, {
      method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: a.buf, signal: AbortSignal.timeout(120e3),
    }).catch((err) => ({ ok: false, status: 0, text: async () => err.message }));
    if (!res.ok) { bad++; console.log(`  ✖ ${name}: PUT ${res.status} ${(await res.text()).slice(0, 120)}`); continue; }
  }
  const b = await get(to, name);
  if (b.sha === a.sha) { VERIFY ? same++ : moved++; continue; }
  bad++;
  console.log(`  ✖ ${name}: на новом ${b.buf ? `другой (${b.sha.slice(0, 12)} ≠ ${a.sha.slice(0, 12)})` : b.status === 404 ? 'нет' : b.error}`);
}
console.log(`\n${DRY ? '' : VERIFY ? `совпадает ${same}, ` : `перенесено и сверено ${moved}, `}нет на старом ${missing}, ошибок ${bad}; ${(bytes / 1048576).toFixed(1)} МБ`);
process.exit(bad ? 1 : 0);
