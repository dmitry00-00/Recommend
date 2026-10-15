// Прогрев обложек книг на сервере (11.10): сервер берёт обложку Open Library при первом запросе (`/api/cover/<id>`,
// worker/index.ts) — а старые обложки Open Library лежат в хранилище Internet Archive и идут десятки секунд. Чтобы
// этого не ждал первый читатель, после выкладки и публикации справочников обходим все обложки книг сами.
//   npx tsx tools/warm-covers.mts [--server https://…]
// Сервер — TM_SERVER (как у publish-reference). Уже взятое сервер отдаёт с диска за миллисекунды — повтор дешёвый.
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
import { bookMedia } from '../src/mocks/bookMedia.ts';

loadEnvFile();
const argv = process.argv.slice(2);
const server = (argv[argv.indexOf('--server') + 1] && argv.includes('--server') ? argv[argv.indexOf('--server') + 1]
  : process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const OPEN_LIBRARY = /^https:\/\/covers\.openlibrary\.org\/b\/id\/(\d{1,10})-[SML]\.jpg$/;

const ids = new Set<string>();
for (const w of worksIndex({ all: true })) {
  if (w.work.type !== 'book') continue;
  for (const u of [w.work.coverUrl, (bookMedia as Record<string, { coverUrl?: string }>)[w.key]?.coverUrl]) {
    const m = u ? OPEN_LIBRARY.exec(u) : null;
    if (m) ids.add(m[1]);
  }
}
console.log(`обложек книг: ${ids.size} → ${server}`);
const list = [...ids];
let ok = 0, miss = 0, slow = 0;
// по четыре разом: сервер сам ждёт Internet Archive до 30 секунд на обложку
for (let i = 0; i < list.length; i += 4) {
  await Promise.all(list.slice(i, i + 4).map(async (id) => {
    const t = Date.now();
    const r = await fetch(`${server}/api/cover/${id}`, { signal: AbortSignal.timeout(45000) }).catch(() => undefined);
    await r?.arrayBuffer().catch(() => undefined);
    if (r?.ok) ok++; else miss++;
    if (Date.now() - t > 5000) slow++;
  }));
  if ((i / 4) % 25 === 24) console.log(`  ${i + 4} из ${list.length}: есть ${ok}, нет ${miss}`);
}
console.log(`готово: есть ${ok}, нет ${miss} (дольше 5 секунд — ${slow})`);
