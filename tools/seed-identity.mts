// Кто за историей (22.10): один человек бывает под несколькими seeds/*.json — импорт Кинопоиска, Letterboxd, Telegram,
// присланный список (<ник>, letterboxd-<ник>, tg-<ник>). Для замеров он должен считаться одним: иначе
// его же вторая история подсказывает спрятанное. Группы ищет tools/seed-dupes.mts (по составу и оценкам, плюс по имени)
// и кладёт в .cache/eval/seed-dupes.json; здесь — только чтение: identityOf(имя истории) → общий ключ человека.
// Нет файла или истории в нём — ключ по имени без приставки источника (kp_, letterboxd-, tg-, trakt-).
//   import { identityOf } from './seed-identity.mts';
import { readFileSync } from 'node:fs';

/** имя истории без приставки источника, в нижнем регистре — запасной ключ человека */
export const stripName = (name: string) => name.replace(/^(?:kp_|letterboxd-|tg-|trakt-)/, '').toLowerCase();

export const DUPES_FILE = new URL('../.cache/eval/seed-dupes.json', import.meta.url);

export interface DupeGroup { id: string; people: string[]; why: string[] }

let byName: Map<string, string> | undefined;
function load(): Map<string, string> {
  if (byName) return byName;
  byName = new Map();
  try {
    const { groups } = JSON.parse(readFileSync(DUPES_FILE, 'utf8')) as { groups: DupeGroup[] };
    for (const g of groups) for (const p of g.people) byName.set(p, g.id);
  } catch { /* ещё не собирали — только по имени */ }
  return byName;
}

/** общий ключ человека для истории seeds/<имя>.json */
export const identityOf = (seedName: string) => load().get(seedName) ?? stripName(seedName);
