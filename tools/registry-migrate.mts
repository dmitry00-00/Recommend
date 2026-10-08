// Перенос реестра из файлов в базу приложения (06.10): один раз, перед переключением `REGISTRY_MODE=server`.
//   npx tsx tools/registry-migrate.mts [--dry]
// Сервер — TM_REGISTRY_SERVER (иначе TM_SERVER), токен — TM_ADMIN_TOKEN. Повторный запуск безопасен:
// сервер пропускает записи, которые уже такие же. После переноса — сверка: снимок с сервера, собранный в
// файлы, должен совпасть с файлами байт в байт (иначе перенос что-то потерял — тогда не переключаться).
import { readFileSync } from 'node:fs';
import { FILES, parseSources, readFiles, registryApi, renderSources, type Entry } from './registry-lib.mts';

const dry = process.argv.includes('--dry');
const entries = readFiles();
const counts: Record<string, number> = {};
for (const e of entries) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
console.error(`в файлах: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')}`);
if (dry) process.exit(0);

const CHUNK = 2000;
let applied = 0;
for (let i = 0; i < entries.length; i += CHUNK) {
  const part = entries.slice(i, i + CHUNK).map((e) => ({ kind: e.kind, id: e.id, body: e.body, ord: e.ord }));
  const r = await registryApi<{ applied: number }>('POST', '/api/admin/registry', { by: 'import', changes: part });
  applied += r.applied;
  console.error(`  ${Math.min(i + CHUNK, entries.length)}/${entries.length}`);
}
console.error(`записано на сервер: ${applied}`);

// сверка: всё, что вернул сервер, — как в файлах
const r = await registryApi<{ version: number; rows: { kind: Entry['kind']; id: string; ord: number | null; body: Record<string, unknown> }[] }>('GET', '/api/admin/registry');
const back = new Map(r.rows.map((x) => [`${x.kind}\u0000${x.id}`, x]));
let bad = 0;
for (const e of entries) {
  const x = back.get(`${e.kind}\u0000${e.id}`);
  if (!x || JSON.stringify(x.body) !== JSON.stringify(e.body) || x.ord !== e.ord) { bad++; if (bad <= 5) console.error(`  расходится: ${e.kind} ${e.id}`); }
}
if (r.rows.length !== entries.length) console.error(`  строк на сервере ${r.rows.length}, в файлах ${entries.length}`);
const src = parseSources(readFileSync(FILES.sources, 'utf8'));
const rebuilt = renderSources(src.head, src.tail, r.rows.filter((x) => x.kind === 'source').map((x) => ({ ...x, ord: x.ord ?? 0 })).sort((a, b) => a.ord - b.ord), src.end);
const same = rebuilt === readFileSync(FILES.sources, 'utf8');
console.error(`сверка: расхождений ${bad}, sources.ts из базы ${same ? 'совпадает' : 'НЕ совпадает'} с файлом; версия ${r.version}`);
process.exit(bad || !same || r.rows.length !== entries.length ? 1 : 0);
