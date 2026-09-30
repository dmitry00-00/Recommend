// Догадка «ролик → фильм» без сети: те же правила, что у индекса разборов
// (tools/build-essay-index.mts), только по готовой выгрузке роликов, а не по обходу каналов.
// Нужна таблице разметки (tools/markup-xlsx.mts) для каналов из ссылок владельца (`via: 'links'`):
// индекс их не обходит, и без этого их ролики приходили в таблицу с пустой колонкой «Фильм»
// (30.09: около 62 тысяч строк).
// Правила по порядку: самое длинное совпадение названия (nameMatch, со сторожами); тёзки при
// равной длине — pickNamesake; сборник и новости (isDigest) — нет; разбор экранизации к книге —
// нет; противоречие года или режиссёра (evidenceFor → conflict) — нет; ролик раньше фильма
// больше чем на год (tooEarly) — нет. Шортсы отсекает сама таблица по длительности.
// Быстро за счёт отбора кандидатов по началу слова: 90 тысяч роликов × 2,6 тысячи фильмов
// напрямую — это минуты, а так — секунды.
import { ADAPTATION, isDigest, nameMatch } from './title-match.mts';
import { evidenceFor, pickNamesake, tooEarly } from './evidence.mts';
import type { IndexedWork } from './works-index.mts';

export interface VideoLike { id: string; title: string; description?: string; publishedAt?: string }
export interface VideoGuess { key: string; work: IndexedWork['work']; evidence?: string }

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const words = (s: string) => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const head = (w: string) => w.slice(0, 4);

export function matchVideos(videos: VideoLike[], ours: IndexedWork[], ordinary?: ReadonlySet<string>): Map<string, VideoGuess> {
  // начало первого слова названия → произведения
  const byHead = new Map<string, IndexedWork[]>();
  for (const w of ours) {
    for (const n of w.names) {
      const first = words(n)[0];
      if (!first) continue;
      const k = head(first);
      const list = byHead.get(k) ?? byHead.set(k, []).get(k)!;
      if (!list.includes(w)) list.push(w);
    }
  }
  const out = new Map<string, VideoGuess>();
  for (const v of videos) {
    const cands = new Set<IndexedWork>();
    for (const t of words(v.title)) for (const w of byHead.get(head(t)) ?? []) cands.add(w);
    if (!cands.size) continue;
    let max = 0;
    let tied: IndexedWork[] = [];
    for (const w of ours) {   // порядок справочников — как у индекса: pickNamesake опирается на него
      if (!cands.has(w)) continue;
      const len = Math.max(0, ...w.names.map((n) => nameMatch(v.title, n, { ordinary })));
      if (!len || len < max) continue;
      if (len > max) { max = len; tied = []; }
      tied.push(w);
    }
    if (!tied.length) continue;
    const text = `${v.title}\n${v.description ?? ''}`;
    const pick = pickNamesake(tied, text, v.publishedAt);
    if (!pick) continue;
    if (isDigest(v.title, pick.names)) continue;
    if (pick.key.startsWith('isbn:') && ADAPTATION.test(v.title)) continue;
    const verdict = evidenceFor(pick.work, text);
    if (verdict === 'conflict' || tooEarly(pick.work, v.publishedAt)) continue;
    out.set(v.id, { key: pick.key, work: pick.work, ...(verdict ? { evidence: verdict } : {}) });
  }
  return out;
}
