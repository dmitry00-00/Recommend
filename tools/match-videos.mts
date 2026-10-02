// Догадка «ролик → фильм» без сети: те же правила, что у индекса разборов
// (tools/build-essay-index.mts), только по готовой выгрузке роликов, а не по обходу каналов.
// Нужна таблице разметки (tools/markup-xlsx.mts) для каналов из ссылок владельца (`via: 'links'`):
// индекс их не обходит, и без этого их ролики приходили в таблицу с пустой колонкой «Фильм»
// (30.09: около 62 тысяч строк).
// Правила по порядку: самое длинное совпадение названия (nameMatch, со сторожами); тёзки при
// равной длине — pickNamesake; сборник и новости (isDigest) — нет; разбор экранизации к книге —
// нет; противоречие года или режиссёра (evidenceFor → conflict) — нет; ролик раньше фильма
// больше чем на год (tooEarly) — нет. Шортсы отсекает сама таблица по длительности.
// Ролик книжного канала (`book`, З6) — свои правила: tools/book-channels.mts.
// Быстро за счёт отбора кандидатов по началу слова: 90 тысяч роликов × 2,6 тысячи фильмов
// напрямую — это минуты, а так — секунды.
import { isDigest, listItems, nameMatchAt } from './title-match.mts';
import { byTags, tagIndex } from './tag-match.mts';
import { adaptationIndex, judgeBookMatch } from './adaptation-guard.mts';
import { evidenceFor, pickNamesake, talksSeries, tooEarly } from './evidence.mts';
import type { IndexedWork } from './works-index.mts';
import { isBookKey } from '../src/lib/keys.ts';
import { isSeries } from '../src/lib/media.ts';
import { bookChannelList, judgeInBookChannel, namesFor, preferBooks, sourceIndex } from './book-channels.mts';

export interface VideoLike {
  id: string; title: string; description?: string; publishedAt?: string;
  /** ролик книжного канала (З6): ищем и книги каталога, из равных — книгу (tools/book-channels.mts) */
  book?: boolean;
  /** ролик англоязычного канала: заголовок в Title Case (tools/title-match.mts, `english`) */
  en?: boolean;
  /** теги YouTube (выгрузка): запасной путь, когда заголовок не назвал фильм (tools/tag-match.mts) */
  tags?: string[];
}
export interface VideoGuess { key: string; work: IndexedWork['work']; evidence?: string; also?: string[] }
/** Ещё одно произведение ролика (OPS-8): «разбор „Адвокат дьявола“ и „Фирма“» — к обоим. */
export interface OtherHit { key: string; work: IndexedWork['work'] }

/** Номер серии или сезона в заголовке: ролик о серии сериала. */
export const EPISODE = /(?<!\p{L})(?:\d{1,3}\s*(?:-?я\s*)?(?:сери[яи]|сезон)|(?:сери[яи]|сезон)\s*\d{1,3})(?!\p{L})|(?<![\p{L}\p{N}])s\d{1,2}\s*e\d{1,3}(?![\p{L}\p{N}])/iu;
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const words = (s: string) => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const head = (w: string) => w.slice(0, 4);

/** Лучшее совпадение названия по каждому ролику: самое длинное, из тёзок — pickNamesake. Без
 *  сторожей «сборник», «экранизация», «противоречие» — их вызывающий ставит сам (индекс разборов
 *  считает, сколько отсеял каждым, и не применяет их к решениям людей). */
export function bestByTitle(videos: VideoLike[], ours: IndexedWork[], options: { ordinary?: ReadonlySet<string>; loose?: boolean; stats?: { lists: number; pairs: number } } = {}):
  Map<string, { key: string; work: IndexedWork['work']; len: number; others?: OtherHit[]; via?: 'hashtag' | 'tags' }> {
  // начало первого слова названия → произведения
  const byHead = new Map<string, IndexedWork[]>();
  for (const w of ours) {
    for (const n of [...w.names, ...(w.bookNames ?? [])]) {
      const first = words(n)[0];
      if (!first) continue;
      const k = head(first);
      const list = byHead.get(k) ?? byHead.set(k, []).get(k)!;
      if (!list.includes(w)) list.push(w);
    }
  }
  const out = new Map<string, { key: string; work: IndexedWork['work']; len: number; others?: OtherHit[]; via?: 'hashtag' | 'tags' }>();
  const tags = tagIndex(ours);
  // заголовок не назвал ни одного нашего фильма — хэштеги и теги ролика (02.10, tools/tag-match.mts).
  // Книжные каналы — мимо: там свои правила; ролик о серии — не к фильму
  const fallback = (v: VideoLike) => {
    if (v.book) return;
    const f = byTags(v, tags);
    if (!f || (EPISODE.test(v.title) && !isSeries(f.work.work))) return;
    out.set(v.id, { key: f.work.key, work: f.work.work, len: 0, via: f.via });
  };
  for (const v of videos) {
    const cands = new Set<IndexedWork>();
    for (const t of words(v.title)) for (const w of byHead.get(head(t)) ?? []) cands.add(w);
    if (!cands.size) { fallback(v); continue; }
    let max = 0;
    let tied: IndexedWork[] = [];
    // все совпадения с местом: из них — второе название ролика (OPS-8, 02.10)
    const hits: { w: IndexedWork; len: number; at: number }[] = [];
    const series = talksSeries(`${v.title}\n${v.description ?? ''}`);
    const episode = EPISODE.test(v.title);
    for (const w of ours) {   // порядок справочников — как у индекса: pickNamesake опирается на него
      if (!cands.has(w) || (w.needsSeriesTalk && !series)) continue;
      // «Адмирал Кузнецов 6 серия обзор», «Больница Питт 2 сезон 7 серия» — разбор серии, а не фильма (01.10)
      if (episode && !isSeries(w.work)) continue;
      let hit: { len: number; at: number } | undefined;
      for (const n of namesFor(w, Boolean(v.book))) {
        const h = nameMatchAt(v.title, n, { ordinary: options.ordinary, loose: options.loose, english: v.en });
        if (h && (!hit || h.len > hit.len)) hit = h;
      }
      const len = hit?.len ?? 0;
      if (hit) hits.push({ w, ...hit });
      if (!len || len < max) continue;
      if (len > max) { max = len; tied = []; }
      tied.push(w);
    }
    if (!tied.length) { fallback(v); continue; }
    // Самое длинное совпадение — одно слово без кавычек, а рядом есть название в кавычках: главное —
    // то, что в кавычках. «Расшифровка фильма «Престиж» Кристофера Нолана» — про «Престиж», а не про
    // «Кристоферов» (02.10)
    const quotedAt = (h: { at: number }) => /[«"„]$/.test(v.title.slice(0, h.at));
    const oneWord = (h: { at: number; len: number }) => !/\s/.test(v.title.slice(h.at, h.at + h.len).trim());
    const top = hits.filter((h) => tied.includes(h.w));
    if (top.length && top.every((h) => oneWord(h) && !quotedAt(h))) {
      const q = hits.filter((h) => quotedAt(h) && !tied.includes(h.w)).sort((a, b) => b.len - a.len);
      if (q.length) { max = q[0].len; tied = q.filter((h) => h.len === max).map((h) => h.w); }
    }
    if (v.book) tied = preferBooks(tied);
    const pick = pickNamesake(tied, `${v.title}\n${v.description ?? ''}`, v.publishedAt);
    if (!pick) continue;
    // Другие названия в заголовке — места, которые не пересекаются с главным и друг с другом;
    // тёзки (одно место) — не второй фильм
    const mainHit = hits.find((h) => h.w === pick)!;
    const taken: [number, number][] = [[mainHit.at, mainHit.at + mainHit.len]];
    const others: OtherHit[] = [];
    const sameTitle = (w: IndexedWork) => w.work.title.toLowerCase() === pick.work.title.toLowerCase()
      || w.names.some((n) => pick.names.some((m) => m.toLowerCase() === n.toLowerCase()));
    for (const h of [...hits].sort((a, b) => b.len - a.len)) {
      if (h.w === pick || h.w.key === pick.key || others.some((o) => o.key === h.w.key)) continue;
      // тёзка главного («Защитники/The Defenders» — один сериал двумя названиями) — не второй фильм
      if (sameTitle(h.w)) continue;
      // второе название из одного слова — только в кавычках: «Женщины в кино», «Любовь Аксёнова»,
      // «Кристофера Нолана» — слова, а не фильмы; «"Реинкарнацией" и "Солнцестоянием"» — фильмы
      const word = !/\s/.test(v.title.slice(h.at, h.at + h.len).trim());
      if (word && !/[«"„]$/.test(v.title.slice(0, h.at))) continue;
      if (taken.some(([a, b]) => h.at < b && h.at + h.len > a)) continue;
      taken.push([h.at, h.at + h.len]);
      others.push({ key: h.w.key, work: h.w.work });
    }
    // перечень из трёх и больше названий — новости, подборка, «сцены из фильмов …»: это не разбор
    // ни одного из них (разметка владельца 02.10, вид «несколько фильмов»)
    if (Math.max(others.length + 1, listItems(v.title, mainHit)) >= 3) { if (options.stats) options.stats.lists += 1; continue; }
    if (others.length && options.stats) options.stats.pairs += 1;
    out.set(v.id, { key: pick.key, work: pick.work, len: max, ...(others.length ? { others } : {}) });
  }
  return out;
}

/** Догадка со сторожами — для таблицы разметки. */
export function matchVideos(videos: VideoLike[], ours: IndexedWork[], ordinary?: ReadonlySet<string>): Map<string, VideoGuess> {
  const byId = new Map(videos.map((v) => [v.id, v]));
  const out = new Map<string, VideoGuess>();
  const adIndex = adaptationIndex(ours);
  const bookCtx = { ad: adIndex, sources: sourceIndex(adIndex, ours) };
  const byKey = new Map(ours.map((w) => [w.key, w]));
  // сторожа одной привязки: сборник, книжный канал, экранизация, противоречие года, раньше выхода
  const judge = (v: VideoLike, key: string, work: IndexedWork['work']): VideoGuess | undefined => {
    const found = byKey.get(key)!;
    let pick = { key, work, names: namesFor(found, Boolean(v.book)) };
    const text = `${v.title}\n${v.description ?? ''}`;
    if (isDigest(v.title, pick.names)) return undefined;
    if (v.book) {
      // книжный канал (З6): сборник — нет; фильм без разговора о кино — к книге или мимо
      if (bookChannelList(v.title)) return undefined;
      const j = judgeInBookChannel(found, v.title, v.title, bookCtx, v.publishedAt);
      if (j.action === 'drop') return undefined;
      if (j.action === 'move') pick = { key: j.to!.key, work: j.to!.work, names: j.to!.bookNames ?? j.to!.names };
    } else if (isBookKey(pick.key)) {
      // разбор экранизации — к фильму по связям Ж1 (Ж4), без связей — прочь от книги
      const j = judgeBookMatch(adIndex, pick.key, v.title, v.publishedAt);
      if (j.action === 'drop') return undefined;
      if (j.action === 'move') pick = { key: j.to!.key, work: j.to!.work, names: j.to!.names };
    }
    const verdict = evidenceFor(pick.work, text);
    if (verdict === 'conflict' || tooEarly(pick.work, v.publishedAt)) return undefined;
    return { key: pick.key, work: pick.work, ...(verdict ? { evidence: verdict } : {}) };
  };
  for (const [id, { key, work, others }] of bestByTitle(videos, ours, { ordinary })) {
    const v = byId.get(id)!;
    const main = judge(v, key, work);
    if (!main) continue;
    // второй фильм ролика (OPS-8) — со своими сторожами; в таблице он идёт в «Ещё фильмы»
    const also = (others ?? []).map((o) => judge(v, o.key, o.work)?.key).filter((k): k is string => Boolean(k) && k !== main.key);
    out.set(v.id, { ...main, ...(also.length ? { also } : {}) });
  }
  return out;
}
