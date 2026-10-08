// Хэштеги и теги ролика как подсказка, о каком он фильме (02.10, идея владельца). Каналы часто
// подписывают ролик хэштегом с названием слитно — «#хищникдобыча #prey2022», «#мег2», — и YouTube
// хранит у ролика теги (у двух третей выгрузки). Замер на ручной разметке (1 403 ролика; из них
// 635 сопоставитель по заголовку не нашёл):
//   · хэштег в заголовке или описании называет ровно один наш фильм — 59 верно, 0 ошибок;
//   · тег YouTube называет ровно один фильм — 240 верно, 32 мимо (теги ставят «для поиска»: у
//     «Ранго» — «Звонок»); с условием «слово названия есть и в заголовке» — 232 и 19, а без
//     сиквелов («ТЕРМИНАТОР 5 Генезис» с тегом «терминатор») ошибок почти не остаётся.
// Поэтому: хэштег — улика (`tag`, как год и оригинальное название), тег — только запасной путь,
// когда заголовок не дал ни одного совпадения, и без улики («не проверено»).
import type { IndexedWork } from './works-index.mts';
import { compared } from './title-match.mts';
import { universeSeeds } from './universe-seeds.mts';

export const compact = (s: string): string => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');

/** Хэштеги текста — слитно, в нижнем регистре: «#ХищникДобыча» → «хищникдобыча». */
export const hashtagsOf = (text: string): string[] =>
  [...new Set([...text.matchAll(/#([\p{L}\p{N}_]{2,40})/gu)].map((m) => compact(m[1])))];

/** Слитное название → произведения: «хищникдобыча», «prey», «prey2022». Короче пяти знаков не берём:
 *  «#кино», «#мег» — слишком общие. */
// имя франшизы — не фильм: «#starwars», «Star Wars Visions» — не «Новая надежда», хотя её оригинальное
// название — «Star Wars» (02.10)
const FRANCHISE = new Set(universeSeeds.flatMap((u) => [u.ru, u.en]).filter(Boolean).map((x) => compact(x)));

export function tagIndex(ours: IndexedWork[]): Map<string, IndexedWork[]> {
  const out = new Map<string, IndexedWork[]>();
  for (const w of ours) {
    for (const n of new Set([...w.names, w.work.title, w.work.originalTitle].filter((x): x is string => Boolean(x)))) {
      const c = compact(n);
      if (c.length < 5 || FRANCHISE.has(c)) continue;
      for (const k of [c, w.work.year ? `${c}${w.work.year}` : '']) {
        if (!k) continue;
        const list = out.get(k) ?? out.set(k, []).get(k)!;
        if (!list.includes(w)) list.push(w);
      }
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Заголовок сопоставитель отверг, а тег вернул бы фильм (ЗП-23, 07.10): имя дважды подряд — сиквел
 *  («Beetlejuice Beetlejuice»); латинское имя — подзаголовок другого нашего названия («Resident Evil:
 *  Retribution» — не «Возмездие» 1969 года, «GTA VI: Pulp Fiction»). Перед двоеточием должно стоять
 *  название из каталога: рубрика канала («Boots To ReBoots: Night Of The Living Dead») не в счёт, своё полное
 *  название («The Lord of the Rings: The Two Towers») — тоже; и фильм старше ролика лет на пять —
 *  «Star Wars: Andor» о самом «Андоре». */
function otherTitle(title: string, name: string, own: string[], known: (s: string) => boolean, year?: number, publishedAt?: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (new RegExp(`(?<![\\p{L}])${esc(n)}\\s+${esc(n)}(?![\\p{L}])`, 'iu').test(title)) return true;
  if (!/^[A-Za-z]/.test(n)) return false;
  const pub = publishedAt ? Number(publishedAt.slice(0, 4)) : NaN;
  if (!year || !Number.isFinite(pub) || pub - year < 5) return false;
  const lead = new RegExp(`((?:[A-Za-z0-9'’-]+\\s+){0,4}[A-Za-z0-9'’-]+)\\s*:\\s*${esc(n)}(?![\\p{L}])`, 'iu').exec(title)?.[1];
  if (!lead) return false;
  const words = lead.split(/\s+/);
  const before = (k: number) => words.slice(-k).join(' ');
  if (own.some((o) => o.toLowerCase().includes(`${words[words.length - 1].toLowerCase()}:`))) return false;
  for (let k = 1; k <= words.length; k++) if (known(before(k))) return true;
  return false;
}

/** Запасной путь, когда заголовок не назвал ни одного нашего фильма: хэштег в заголовке или описании
 *  с ровно одним фильмом, иначе тег YouTube с ровно одним фильмом, если слово его названия есть и в
 *  заголовке и в заголовке это не начало сиквела («Мстители: Финал», «Стражи галактики 3»). */
const norm = (s: string) => ` ${s.toLowerCase().replace(/ё/g, 'е').replace(/[-–—]/g, ' ').replace(/[^\p{L}\p{N}:.]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;

/** Название в заголовке — начало чужого, более длинного: «Мстители: Финал», «Стражи галактики 3»,
 *  «ЖЕНЩИНА-ХАЛК» при «Халке». Тогда ни хэштег, ни тег франшизы не говорят, о каком фильме ролик. */
function partOfLonger(title: string, names: string[]): boolean {
  const t = norm(title);
  for (const n of names) {
    const x = norm(n).trim();
    if (!x) continue;
    for (let i = t.indexOf(x); i >= 0; i = t.indexOf(x, i + 1)) {
      const before = t.slice(0, i), after = t.slice(i + x.length);
      // «DEADPOOL AND WOLVERINE», «Дэдпул и Росомаха» — тоже продолжение; скобка сразу после —
      // подпись к чужому названию («ДРУГОЙ ЧЕЛОВЕК (МУЖСКАЯ СУБСТАНЦИЯ)»)
      if (/\p{L}$/u.test(before) || /^\s*(?::|\.\s*\d|\d)/u.test(after) || /^\s*(?:and|и|&)\s+\p{L}/iu.test(after)) return true;
      // римская цифра — номер части: «Гладиатор II», «Creed III» (ЗП-23, 07.10)
      if (/^\s*(?:ii|iii|iv|vi|vii|viii|ix)(?!\p{L})/u.test(after)) return true;
    }
  }
  return false;
}

/** Запасной путь, когда заголовок не назвал ни одного нашего фильма: хэштег в заголовке или описании
 *  с ровно одним фильмом, иначе тег YouTube с ровно одним фильмом, если его название целиком есть и
 *  в заголовке. В обоих случаях — не начало сиквела или чужого названия («Мстители: Финал»). */
export function byTags(v: { title: string; description?: string; tags?: string[]; publishedAt?: string }, index: Map<string, IndexedWork[]>):
  { work: IndexedWork; via: 'hashtag' | 'tags' } | undefined {
  const one = (keys: string[]) => {
    const found = new Map<string, IndexedWork>();
    for (const k of keys) for (const w of index.get(k) ?? []) found.set(w.key, w);
    return found.size === 1 ? [...found.values()][0] : undefined;
  };
  const namesOf = (w: IndexedWork) => [w.work.title, w.work.originalTitle ?? '', ...w.names].filter(Boolean);
  const h = one(hashtagsOf(`${v.title}\n${v.description ?? ''}`));
  const off = (w: IndexedWork) => partOfLonger(v.title, namesOf(w)) || namesOf(w).some((n) => compared(v.title, n) || otherTitle(v.title, n, namesOf(w), (x) => (index.get(compact(x)) ?? []).some((o) => o.key !== w.key), w.work.year, v.publishedAt));
  // и хэштег, и тег — только подтверждение: название должно стоять и в заголовке, с большой буквы.
  // Без этого на всей выгрузке хэштег франшизы уводил чужие ролики: «#кирпич» — к «Кирпичу»,
  // «#starwars» — к «Новой надежде», «время» в обычной фразе — ко «Времени» (замер 02.10)
  const inTitle = (w: IndexedWork) => namesOf(w).some((n) => {
    const x = norm(n).trim();
    const i = norm(v.title).indexOf(` ${x}`);
    if (!x || i < 0) return false;
    if (/\s/.test(x)) return true;
    // одно слово — с большой буквы в самом заголовке
    const re = new RegExp(`(?:^|[^\\p{L}])(${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ё/gi, '[её]')})`, 'iu');
    const m = re.exec(v.title);
    // и не продолжается предлогом: «The Rigged Election of Jon Snow» — не «Выскочка» (Election) (OPS-9, 06.10)
    if (m && /^\s+(?:of|the|and|in|on|at|to|from|for|with)(?![\p{L}])/iu.test(v.title.slice(m.index + m[0].length))) return false;
    return Boolean(m && m[1][0] !== m[1][0].toLocaleLowerCase('ru'));
  });
  if (h && !off(h) && inTitle(h)) return { work: h, via: 'hashtag' };
  const t = one((v.tags ?? []).map(compact));
  if (!t || off(t) || !inTitle(t)) return undefined;
  return { work: t, via: 'tags' };
}
