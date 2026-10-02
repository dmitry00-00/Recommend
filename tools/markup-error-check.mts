// Сверка опознавателя с разметкой ошибок (02.10): строки, у которых в таблице или в пульте ссылок
// указан вид ошибки («не тот фильм», «не фильм», «несколько фильмов»), прогоняются через нынешние
// правила (tools/match-videos.mts). Показывает, что из отмеченного ещё ошибается — по видам.
//   npx tsx tools/markup-error-check.mts            — сеть не нужна: выгрузка .cache/youtube/videos.json
import { readFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { matchVideos } from './match-videos.mts';
import { isBookKey } from '../src/lib/keys.ts';
import { cachedVideos } from './youtube-channels.mts';

type V = { key: string | null; err?: string; film?: string; also?: string[] };
const human = JSON.parse(readFileSync(new URL('./markup-verdicts.json', import.meta.url), 'utf8')).videos as Record<string, V>;
const marked = Object.entries(human).filter(([, v]) => v.err);
const videos = new Map((cachedVideos() ?? []).map((v) => [v.id, v]));
const ordFile = new URL('../.cache/ordinary.json', import.meta.url);
let ordinary: Set<string> | undefined;
try { ordinary = new Set(JSON.parse(readFileSync(ordFile, 'utf8')).names ?? []); } catch { /* без ловушек */ }
const ours = worksIndex().filter((w) => !isBookKey(w.key));
const label = new Map(ours.map((w) => [w.key, `${w.work.title} (${w.work.year ?? '—'})`]));
const set = marked.map(([id]) => videos.get(id)).filter((v): v is NonNullable<typeof v> => Boolean(v));
const got = matchVideos(set, ours, ordinary);
console.log(`отмечено ошибок: ${marked.length}, из них в выгрузке: ${set.length}`);
for (const kind of ['не фильм', 'не тот фильм', 'несколько фильмов']) {
  const rows = marked.filter(([id, v]) => v.err === kind && videos.has(id));
  // ошибка остаётся: «не фильм» — привязан хоть к чему-то; «не тот» — к тому же неверному (или к
  // другому, но не к названному человеком); «несколько» — привязан только к одному
  const still = rows.filter(([id, v]) => {
    const g = got.get(id)?.key;
    if (kind === 'не фильм') return Boolean(g);
    if (kind === 'не тот фильм') return Boolean(g) && g !== v.key;
    return true;
  });
  console.log(`\n== ${kind}: ${rows.length}, ещё ошибается ${still.length}`);
  for (const [id] of still.slice(0, 40)) console.log(`  ${videos.get(id)!.title.slice(0, 90)} → ${label.get(got.get(id)?.key ?? '') ?? '—'}`);
}
