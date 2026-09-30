// Сторож «разбор экранизации не про книгу» (Ж4) — на связях Ж1 вместо одного регулярного
// выражения. Раньше ролик, совпавший с книгой, выбрасывался при любом слове «фильм», «сериал»,
// «смотреть» в заголовке (ADAPTATION): разбор «Соляриса» Тарковского терялся, хотя фильм у нас есть,
// а «книга или фильм» уходил вместе с ним. Теперь, если по связям у книги есть экранизации:
//   · «по роману», «по книге», «по мотивам» или разговор о фильме без разговора о книге — ролик
//     переезжает к экранизации: той, чей год назван в тексте; иначе той, чей режиссёр назван;
//     иначе сериалу, если говорят о сериале; иначе своей (есть карточка), из них — самой поздней,
//     вышедшей до ролика. Нашей карточки у выбранной нет — ролик отбрасываем;
//   · говорят о книге (или о книге и фильме сразу — сравнение) — остаётся книге;
//   · ни то ни другое — остаётся книге: совпало её название.
// Связей нет (Ж1 не прогнан или у книги экранизаций нет) — прежнее правило, ADAPTATION.
// Книга у нас — ключ `isbn:` (издание), а в Wikidata экранизация указывает на произведение; мост —
// элемент книги из связей, а без него — узел-книга с тем же названием (и годом ±3, если он есть).
import { ADAPTATION } from './title-match.mts';
import { talksSeries } from './evidence.mts';
import { normalizeTitle } from '../src/lib/import/match.ts';
import { relationEdges, relationNodes } from '../src/mocks/workRelations.ts';
import type { IndexedWork } from './works-index.mts';

export interface BookVerdict {
  action: 'keep' | 'drop' | 'move';
  to?: IndexedWork;
  /** чем решено: связями или прежним правилом */
  via: 'graph' | 'regex';
}

// «по роману», «экранизация романа» — о фильме, но только рядом со словом о кино: «путеводитель по
// роману» — о книге
const BY_BOOK = /по\s+(?:роману|книге|повести|рассказу|мотивам|произведению)|экранизаци\p{L}*\s+(?:романа|книги|повести|рассказа)/iu;
const BOOK_TALK = /книг|(?<!\p{L})роман(?:а|е|у|ом|ы)?(?!\p{L})|повест|прочита|(?<!\p{L})читать|писател|литератур|страниц/iu;

type Node = { t: string; y?: number; k: string; key?: string };

/** Экранизации книг из графа: ключ книги у нас → узлы-экранизации (фильм, сериал). */
export function adaptationIndex(ours: IndexedWork[], nodes: Record<string, Node> = relationNodes,
  edges: [string, string, string][] = relationEdges): Map<string, { node: Node; work?: IndexedWork }[]> {
  const byKey = new Map(ours.map((w) => [w.key, w]));
  const qOfKey = new Map(Object.entries(nodes).flatMap(([q, n]) => (n.key ? [[n.key, q] as [string, string]] : [])));
  const bookNodesByTitle = new Map<string, string[]>();
  for (const [q, n] of Object.entries(nodes)) {
    if (n.k !== 'book') continue;
    const t = normalizeTitle(n.t.replace(/\s*\((?:роман|повесть|книга|novel)[^)]*\)\s*$/i, ''));
    (bookNodesByTitle.get(t) ?? bookNodesByTitle.set(t, []).get(t)!).push(q);
  }
  const adaptedFrom = new Map<string, string[]>();
  for (const [a, kind, b] of edges) if (kind === 'adaptation_of') (adaptedFrom.get(b) ?? adaptedFrom.set(b, []).get(b)!).push(a);
  const out = new Map<string, { node: Node; work?: IndexedWork }[]>();
  for (const w of ours) {
    if (!w.key.startsWith('isbn:')) continue;
    const direct = qOfKey.get(w.key);
    const byTitle = [w.work.title, w.work.originalTitle].filter((t): t is string => Boolean(t))
      .flatMap((t) => bookNodesByTitle.get(normalizeTitle(t)) ?? [])
      .filter((q) => !w.work.year || !nodes[q].y || Math.abs(nodes[q].y! - w.work.year) <= 3);
    const qs = [...new Set([direct, ...byTitle].filter((q): q is string => Boolean(q)))];
    const list = qs.flatMap((q) => adaptedFrom.get(q) ?? []).map((a) => nodes[a]).filter((n) => n && (n.k === 'film' || n.k === 'series'))
      .map((node) => ({ node, ...(node.key && byKey.get(node.key) ? { work: byKey.get(node.key)! } : {}) }));
    if (list.length) out.set(w.key, list);
  }
  return out;
}

/** Решение по материалу, совпавшему с книгой. */
export function judgeBookMatch(index: ReturnType<typeof adaptationIndex>, bookKey: string, text: string, publishedAt?: string): BookVerdict {
  const film = ADAPTATION.test(text);
  const adaptations = index.get(bookKey);
  if (!adaptations?.length) return film ? { action: 'drop', via: 'regex' } : { action: 'keep', via: 'regex' };
  const book = BOOK_TALK.test(text);
  const aboutFilm = film && (BY_BOOK.test(text) || !book);
  if (!aboutFilm) return { action: 'keep', via: 'graph' };
  const pub = publishedAt ? Number(publishedAt.slice(0, 4)) : NaN;
  const years = new Set([...text.matchAll(/(?<!\d)(19\d{2}|20\d{2})(?!\d)/g)].map((m) => Number(m[1])));
  const series = talksSeries(text);
  const before = adaptations.filter((a) => !a.node.y || !Number.isFinite(pub) || a.node.y <= pub + 1);
  // назван режиссёр или автор нашей экранизации («Солярис Тарковского») — это она
  const low = text.toLowerCase().replace(/ё/g, 'е');
  const byCreator = adaptations.find((a) => a.work?.work.creators.some((c) => {
    const last = c.trim().split(/\s+/).pop()?.toLowerCase().replace(/ё/g, 'е') ?? '';
    return last.length >= 4 && low.includes(last.slice(0, Math.max(4, last.length - 2)));
  }));
  const pick = adaptations.find((a) => a.node.y && years.has(a.node.y))
    ?? byCreator
    ?? (series ? before.find((a) => a.node.k === 'series') : undefined)
    // своя карточка — раньше чужой: иначе разбор уходит к экранизации, которой у нас нет
    ?? [...before].sort((a, b) => Number(Boolean(b.work)) - Number(Boolean(a.work)) || (b.node.y ?? 0) - (a.node.y ?? 0))[0];
  // ни одной экранизации ко времени материала — он о книге
  if (!pick && !before.length) return { action: 'keep', via: 'graph' };
  return pick?.work ? { action: 'move', to: pick.work, via: 'graph' } : { action: 'drop', via: 'graph' };
}
