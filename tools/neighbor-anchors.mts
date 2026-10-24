// Файл опорных историй для соседей по вкусу на сервере (23.10, worker/neighbors.ts). Из seeds/*.json — только
// обезличенные z-оценки: люди под случайными id (новые при каждой сборке), фильмы — таблицей ключей, ни имён, ни сырых
// оценок, ни дат. Один человек под несколькими историями — один (tools/seed-identity.mts), первая история главнее.
// Решение владельца 23.10: такой файл на сервере держать можно; перенос и выкладка — только по его слову.
//   npx tsx tools/neighbor-anchors.mts --out <путь вне репозитория> [--min 20]
// Путь по умолчанию — NEIGHBOR_ANCHORS_FILE; внутрь репозитория писать отказывается (seeds — личные, файл — тоже).
// На сервере: NEIGHBOR_ANCHORS_FILE=<путь> и NEIGHBORS=1 (server/index.js отдаёт чтение файла воркеру).
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { anchorFileOf, keysOfRating, personZ, type Rated } from '../src/lib/model/neighbors.ts';
import { identityOf } from './seed-identity.mts';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const MIN = Number(opt('--min') ?? 20);
const out = opt('--out') ?? process.env.NEIGHBOR_ANCHORS_FILE;
if (!out) throw new Error('куда писать: --out <путь> или NEIGHBOR_ANCHORS_FILE');
const file = resolve(out);
if ((file + sep).startsWith(resolve(process.cwd()) + sep)) throw new Error(`внутри репозитория нельзя: ${file}`);

interface SeedRating { workId: string; rating: number; raw?: number; work?: { type?: string; externalIds?: { tmdb?: number; imdb?: string } } }
const byWho = new Map<string, Rated[]>();
for (const f of readdirSync('seeds').filter((f) => f.endsWith('.json')).sort()) {
  let ratings: SeedRating[];
  try { ratings = ((JSON.parse(readFileSync(`seeds/${f}`, 'utf8')) as { ratings?: SeedRating[] }).ratings ?? []).filter((r) => r.raw != null); } catch { continue; }
  if (ratings.length < MIN) continue;
  const who = identityOf(f.replace(/\.json$/, ''));
  const list = byWho.get(who) ?? [];
  // повтор фильма из второй истории того же человека отсечёт personZ (первая главнее)
  for (const r of ratings) list.push({ keys: keysOfRating(r.workId, r.work), raw: r.raw! });
  byWho.set(who, list);
}
// порядок людей — случайный: по нему не восстановить, кто за историей
const people = [...byWho.values()].map((list) => ({ films: personZ(list), o: randomBytes(4).readUInt32LE() }))
  .filter((p) => p.films.length >= MIN).sort((a, b) => a.o - b.o);
const data = anchorFileOf(people, () => randomBytes(6).toString('hex'));
writeFileSync(file, JSON.stringify(data));
const pairs = data.people.reduce((s, p) => s + p.r.length / 2, 0);
console.log(`опорных историй ${data.people.length}, фильмов ${data.films.length}, оценок ${pairs} → ${file}`);
