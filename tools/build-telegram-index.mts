// Посты Telegram-каналов → src/mocks/postsAuto.ts.
//   npx tsx tools/build-telegram-index.mts <канал>=<папка|result.json> [ещё…]
//   пример: npx tsx tools/build-telegram-index.mts episodesfilm=~/Downloads/ChatExport_ЭПИЗОДЫ
// Вход — официальный экспорт Telegram Desktop (см. tools/telegram-export.mts). Имя канала
// задаётся явно; человеческое название («ЭПИЗОДЫ», а не «episodesfilm») берётся из шапки
// экспорта — оно там есть.
// Привязка к произведениям — по названию, теми же правилами, что у роликов
// (tools/title-match.mts), и с тем же результатом: помечено `unverified`, подтверждает человек
// заданием «тот ли это фильм».
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ADAPTATION, nameHits, nameMatch } from './title-match.mts';
import { parseArgs, readExport, type Post } from './telegram-export.mts';
import { oembed, videoId, videosApi, type VideoMeta } from './youtube.mts';
import { worksIndex } from './works-index.mts';
import { evidenceFor, pickNamesake, tooEarly, type Evidence } from './evidence.mts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import type { ExternalAnalysis } from '../src/types/tmdf.ts';

const args = parseArgs(process.argv.slice(2));

/** Первая строка поста — обычно заголовок разбора; остального в карточке не надо.
 *  Ссылки из неё вырезаем: канал часто начинает пост со ссылки на себя же. */
const firstLine = (text: string): string => {
  const line = text.replace(/https?:\/\/\S+/g, ' ').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return line.length > 90 ? `${line.slice(0, 88).trimEnd()}…` : line;
};

const ours = worksIndex();

// названия-ловушки этого корпуса (tools/build-ordinary.mts). Нет файла — работаем как раньше:
// сторож не обязателен, а молча подменять его пустым списком нечестно
const ordFile = new URL('../.cache/ordinary.json', import.meta.url);
const ordinary = existsSync(ordFile)
  ? new Set<string>(JSON.parse(readFileSync(ordFile, 'utf8')).names ?? []) : undefined;
console.error(ordinary ? `повседневных названий: ${ordinary.size}` : 'нет .cache/ordinary.json — без сторожа на повседневные названия');

/** Отбор по сути: канал пишет и анонсы («"Джокер: безумие на двоих"»), и разборы.
 *  `RICH` — слова разговора о смысле. Ярлык `LABEL` из title-match («фильм», «кино») для
 *  этого не годится: у новостного канала он стоит в каждом втором посте — с ним из
 *  «Кинопоиска» приходило 656 привязок, почти все новости и анонсы (замер 22.09). */
const RICH = /(?:почему|зачем|как устроен|на самом деле|объясня|теори|подтекст|что не так|о ч[её]м (?:на самом деле )?(?:фильм|кино|эт|говор)|разбира|смысл|устро[ей]н|метафор|символ)/i;
/** Новость, анонс, реклама — не разбор, чем бы ни выглядели. Длинный текст это перебивает
 *  только вместе с `RICH`: у «Кинопоиска» новость на тысячу знаков — обычное дело. */
const NEWS = /(?:трейлер|тизер|премьер|стартовали съ[её]мки|начались съ[её]мки|объявил|анонсир|номинир|кассов|сборы|выйдет|выходит в прокат|дата выхода|в прокате с|уже в кино|расписани|сеанс|билет|розыгрыш|конкурс|скидк|подписк|промокод|реклама|erid)/i;

/** Рубрика становится рубрикой не раньше пятого поста: по трём постам медиана врёт. */
const RUBRIC_MIN = 5;

/** Статистика рубрик канала: сколько постов, медиана длины, доля «про смысл». Отсюда два
 *  вывода: рубрика-картинка (текста под ней нет — «#постердня», «#обложкадня») и
 *  рубрика-разбор (текст длинный или почти всегда про смысл — «#спгс», «#тревожныйсмотр»).
 *  Хэштеги у каналов — это рубрики, и канал ими сам говорит, что за пост. */
interface Rubric { tag: string; n: number; median: number; rich: number; kind: 'picture' | 'essay' | 'mixed' }
function rubrics(posts: Post[]): Map<string, Rubric> {
  const lensByTag = new Map<string, number[]>();
  const richByTag = new Map<string, number>();
  for (const p of posts) {
    const rich = RICH.test(p.text);
    for (const t of p.tags) {
      (lensByTag.get(t) ?? lensByTag.set(t, []).get(t)!).push(p.text.length);
      if (rich) richByTag.set(t, (richByTag.get(t) ?? 0) + 1);
    }
  }
  const out = new Map<string, Rubric>();
  for (const [tag, lens] of lensByTag) {
    if (lens.length < RUBRIC_MIN) continue;
    const median = [...lens].sort((a, b) => a - b)[Math.floor(lens.length / 2)];
    const rich = (richByTag.get(tag) ?? 0) / lens.length;
    const kind = median < 200 ? 'picture' : median >= 700 || rich >= 0.5 ? 'essay' : 'mixed';
    out.set(tag, { tag, n: lens.length, median, rich, kind });
  }
  return out;
}

/** Куда ведёт разбор: пост-ссылка на статью или ролик — это разбор на той площадке, а
 *  t.me тут только конверт. Пост без ссылки остаётся постом. */
function target(p: Post, username: string): Pick<ExternalAnalysis, 'platform' | 'url' | 'previewUrl'> {
  const url = p.preview?.url ?? '';
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(url);
  if (yt) return { platform: 'youtube', url: `https://www.youtube.com/watch?v=${yt[1]}`, previewUrl: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };
  if (/\/(?:media\/article|article|articles|longread|stati)\//.test(url)) return { platform: 'article', url };
  return { platform: 'telegram', url: `https://t.me/${username}/${p.id}` };
}

/** Ролики, которые уже нашлись перебором загрузок каналов (essaysAuto): второй раз
 *  в карточку они не нужны. */
const knownVideos = new Set(Object.values(essaysAuto).flat()
  .map((a) => videoId(a.url)).filter((x): x is string => Boolean(x)));

/** Больше трёх разборов одного произведения в карточке не нужно: берём самые содержательные. */
const PER_WORK = 3;

const found: { key: string; analysis: ExternalAnalysis; row: string; weight: number }[] = [];
const stats = { posts: 0, picture: 0, news: 0, thin: 0, crowded: 0, passing: 0, matched: 0, seen: 0, early: 0, namesake: 0 };
const evidenceStats: Record<Evidence, number> = { link: 0, year: 0, original: 0 };
const conflicts: string[] = [];
const rubricReport: string[] = [];
for (const { username, path, role } of args) {
  const { title, posts } = readExport(path);
  const channel = title ?? username;
  // Площадка пишет новости сотнями, и для неё порог остаётся высоким. Авторскому каналу
  // высокий порог стоил почти всего: у @ugolokhorror через него проходил один пост из 280
  // (замер 24.09), хотя фильмы он называет в каждом втором.
  const platform = role === 'platform';
  const rub = rubrics(posts);
  const kinds = [...rub.values()].sort((a, b) => b.n - a.n);
  rubricReport.push(`${channel} (@${username}): постов ${posts.length}, рубрик ${rub.size}`
    + ` — картинок ${kinds.filter((r) => r.kind === 'picture').length}, разборных ${kinds.filter((r) => r.kind === 'essay').length}`
    + (kinds.length ? `\n    ${kinds.slice(0, 8).map((r) => `#${r.tag}·${r.n}·${r.kind}`).join(' ')}` : ''));
  for (const p of posts) {
    if (p.text.length < 120) continue; // короткая заметка — не разбор
    stats.posts += 1;
    const tags = p.tags.filter((t) => rub.has(t));
    if (tags.some((t) => rub.get(t)!.kind === 'picture')) { stats.picture += 1; continue; }
    const rich = RICH.test(p.text);
    const essayTag = tags.some((t) => rub.get(t)!.kind === 'essay');
    if (NEWS.test(p.text) && !(rich && p.text.length >= 700) && !essayTag) { stats.news += 1; continue; }
    const thin = platform
      ? !(essayTag || p.text.length >= 700 || (rich && p.text.length >= 300))
      : !(essayTag || p.text.length >= 300);
    if (thin) { stats.thin += 1; continue; }
    // один пост — одно произведение: побеждает самое длинное совпадение названия.
    // Сначала первая строка — она у поста за заголовок, и совпадение там самое надёжное.
    let best: { work: typeof ours[number]['work']; key: string; len: number } | undefined;
    const head = firstLine(p.text);
    const links = p.links.map((l) => l.url);
    // одинаково длинное совпадение у нескольких — тёзки («Пацаны» 1983-го и сериал 2019-го):
    // выбирает pickNamesake (tools/evidence.mts), а не порядок справочников
    let headLen = 0;
    let heads: { work: typeof ours[number]['work']; key: string }[] = [];
    for (const { key, work, names } of ours) {
      // только выделенное кавычками или капсом — иначе «Помните, я обещал…» уходит в «Помнить»
      const len = Math.max(0, ...names.map((n) => nameMatch(head, n, { marked: true, ordinary })));
      if (!len || len < headLen) continue;
      if (len > headLen) { headLen = len; heads = []; }
      heads.push({ work, key });
    }
    if (heads.length) {
      const pick = pickNamesake(heads, p.text, p.date, links);
      if (!pick) { stats.early += 1; continue; }
      if (pick !== heads[0]) stats.namesake += 1;
      best = { ...pick, len: headLen };
    }
    // Не нашлось в заголовке — ищем по всему тексту, но привязываем, только если названо
    // ровно одно наше произведение. Пост, где названы три фильма, — это список, а не разбор
    // одного из них, и раньше такие отсекались вместе с полезными: правило «только первая
    // строка» стоило @ugolokhorror 36 привязок из 37, @horrorreview — 40 из 41 (замер 24.09).
    let fromBody = false;
    if (!best && !platform) {
      // У площадки в теле новости перечислены полдюжины чужих фильмов, и привязка по телу
      // даёт ровно то, от чего уходили 22.09. У автора — наоборот, название часто во втором
      // абзаце. Поэтому по телу ищем только у авторов.
      const hits = new Map<string, { work: typeof ours[number]['work']; key: string; len: number; name: string }>();
      for (const { key, work, names } of ours) {
        let len = 0;
        let hit = '';
        for (const n of names) {
          const m = nameMatch(p.text, n, { marked: true, ordinary });
          if (m > len) { len = m; hit = n; }
        }
        if (len) hits.set(key, { work, key, len, name: hit });
        // тёзки называются одним и тем же словом — это одно названное произведение, а не два
        if (hits.size > 1 && new Set([...hits.values()].map((h) => h.name.toLowerCase())).size > 1) break;
      }
      const named = new Set([...hits.values()].map((h) => h.name.toLowerCase()));
      if (named.size !== 1) { if (named.size > 1) stats.crowded += 1; continue; }
      const group = [...hits.values()];
      const only = pickNamesake(group, p.text, p.date, links);
      if (!only) { stats.early += 1; continue; }
      if (only !== group[0]) stats.namesake += 1;
      // Пост про фильм называет его не один раз; одиночное упоминание в перечислении —
      // не разбор. Исключение — если рядом улика (ссылка, год, оригинальное название).
      const repeated = nameHits(p.text, only.name) >= 2;
      if (!repeated && !evidenceFor(only.work, p.text, p.links.map((l) => l.url))) { stats.passing += 1; continue; }
      best = only;
      fromBody = true;
    }
    if (!best) continue;
    // к книге не привязываем разговор об экранизации: это про фильм, а фильма у нас нет
    if (best.key.startsWith('isbn:') && ADAPTATION.test(head)) continue;
    const where = target(p, username);
    const vid = where.platform === 'youtube' ? videoId(where.url) : undefined;
    if (vid && knownVideos.has(vid)) { stats.seen += 1; continue; }
    // улика: ссылка на страницу фильма, год рядом с названием, оригинальное название (В3);
    // противоречие (рядом чужой год — ремейк или тёзка) снимает привязку совсем
    const verdict = evidenceFor(best.work, p.text, p.links.map((l) => l.url));
    if (verdict === 'conflict') { conflicts.push(`${best.work.title} (${best.work.year}) ✗ ${channel}: ${firstLine(p.text)}`); continue; }
    // пост вышел раньше фильма больше чем на год — не про него (tools/evidence.mts tooEarly)
    if (tooEarly(best.work, p.date)) { stats.early += 1; continue; }
    const evidence = verdict;
    stats.matched += 1;
    if (evidence) evidenceStats[evidence] += 1;
    // у ролика автор — его канал, а не тот, кто принёс ссылку; имя спросим ниже у YouTube
    const author = p.forwardedFrom ?? (where.platform === 'article' ? (p.preview?.site || channel) : channel);
    found.push({
      key: best.key,
      // самые содержательные вперёд: длина плюс премия за разговор о смысле и за рубрику
      weight: p.text.length + (rich ? 800 : 0) + (essayTag ? 400 : 0) - (fromBody ? 600 : 0),
      analysis: {
        id: `tg-${username}-${p.id}`,
        title: firstLine(p.preview?.title || p.text),
        author,
        language: 'ru',
        spoilerLevel: 2,
        ...(evidence ? { evidence } : { unverified: true }),
        ...where,
        ...(tags.length ? { tags: tags.slice(0, 2) } : {}),
        ...(p.date ? { publishedAt: p.date.slice(0, 10) } : {}),
      },
      row: `${evidence ? `[${evidence}] ` : ''}${best.work.title} (${best.work.year}) ← ${channel}: ${firstLine(p.preview?.title || p.text)}`,
    });
  }
}

// Ролики: название, канал, длительность и дата — у YouTube (ключ `YT_API_KEY`, 50 штук за
// запрос; без ключа — открытый oEmbed, без длительности). Спрашиваем только про те ролики,
// что уже привязались к произведению, — это несколько десятков запросов, а не тысячи.
const videoIds = [...new Set(found.map((f) => (f.analysis.platform === 'youtube' ? videoId(f.analysis.url) : undefined))
  .filter((x): x is string => Boolean(x)))];
if (videoIds.length) {
  const key = process.env.YT_API_KEY;
  const meta = key ? await videosApi(videoIds, key) : new Map<string, VideoMeta>();
  for (const id of videoIds) if (!meta.has(id)) { const m = await oembed(id); if (m) meta.set(id, m); }
  console.error(`роликов по ссылкам из постов: ${videoIds.length}, узнали про ${meta.size}`);
  for (const f of found) {
    const id = f.analysis.platform === 'youtube' ? videoId(f.analysis.url) : undefined;
    const m = id ? meta.get(id) : undefined;
    if (!m) continue;
    f.analysis.title = m.title;
    f.analysis.author = m.author || f.analysis.author;
    if (m.durationMinutes) f.analysis.durationMinutes = m.durationMinutes;
    if (m.publishedAt) f.analysis.publishedAt = m.publishedAt;
  }
  // ролик короче пяти минут — шортс, а не разбор: то же правило, что у индекса роликов
  const shorts = found.filter((f) => (f.analysis.durationMinutes ?? 99) < 5);
  for (const f of shorts) found.splice(found.indexOf(f), 1);
  if (shorts.length) console.error(`выброшено шортсов (короче пяти минут): ${shorts.length}`);
}

// Одно и то же издание подписано по-разному в разные годы («КиноПоиск» и «Кинопоиск»):
// в мете разбора это выглядит как два источника. Оставляем самое частое написание.
const spelling = new Map<string, Map<string, number>>();
for (const f of found) {
  const byName = spelling.get(f.analysis.author.toLowerCase())
    ?? spelling.set(f.analysis.author.toLowerCase(), new Map()).get(f.analysis.author.toLowerCase())!;
  byName.set(f.analysis.author, (byName.get(f.analysis.author) ?? 0) + 1);
}
for (const f of found) {
  f.analysis.author = [...spelling.get(f.analysis.author.toLowerCase())!].sort((a, b) => b[1] - a[1])[0][0];
}

// самые содержательные, без повторов заголовка, не больше трёх на произведение
const out: Record<string, ExternalAnalysis[]> = {};
const rows: string[] = [];
for (const key of [...new Set(found.map((f) => f.key))]) {
  const seenTitle = new Set<string>();
  for (const f of found.filter((x) => x.key === key).sort((a, b) => b.weight - a.weight)) {
    const title = f.analysis.title.toLowerCase().replace(/[^a-zа-я0-9]+/g, ' ').trim();
    if (seenTitle.has(title)) continue;
    seenTitle.add(title);
    (out[key] ??= []).push(f.analysis);
    rows.push(f.row);
    if ((out[key]?.length ?? 0) >= PER_WORK) break;
  }
}

const file = process.env.OUT_FILE ? new URL(`file://${process.env.OUT_FILE}`) : new URL('../src/mocks/postsAuto.ts', import.meta.url);
writeFileSync(file,
  `// Сгенерировано tools/build-telegram-index.mts (${new Date().toISOString().slice(0, 10)}) из экспорта
// Telegram Desktop и свежей выемки по MTProto (tools/telegram-fetch.py), каналы — в
// tools/telegram-channels.json. Привязка к произведениям — по названию, человеком не подтверждена
// (см. задания «тот ли это фильм»). Не править руками — перегенерировать.
import type { ExternalAnalysis } from '@/types/tmdf';

export const postsAuto: Record<string, ExternalAnalysis[]> = ${JSON.stringify(out, null, 2)};
`);
console.error(rubricReport.join('\n'));
console.error(`постов длиннее 120 знаков: ${stats.posts}`);
console.error(`отсеяно: рубрика-картинка ${stats.picture}, новость и анонс ${stats.news},`
  + ` слишком коротко ${stats.thin}, названо несколько фильмов ${stats.crowded},`
  + ` названо мельком ${stats.passing}, ролик уже известен ${stats.seen}, раньше фильма ${stats.early}`);
console.error(`тёзки: выбран не первый по справочнику — ${stats.namesake}`);
console.error(`→ ${file.pathname}: ${rows.length} совпадений к ${Object.keys(out).length} произведениям (найдено ${stats.matched})`);
const kept = Object.values(out).flat();
console.error(`улики в индексе: ${kept.filter((a) => a.evidence).length} из ${kept.length}`
  + ` (ссылка ${kept.filter((a) => a.evidence === 'link').length}, год ${kept.filter((a) => a.evidence === 'year').length},`
  + ` оригинал ${kept.filter((a) => a.evidence === 'original').length}); по всем найденным — ${JSON.stringify(evidenceStats)}`);
console.error(`снято противоречием года (ремейк или тёзка): ${conflicts.length}`);
if (conflicts.length) console.error(conflicts.sort().join('\n'));
console.error(rows.sort().join('\n'));
