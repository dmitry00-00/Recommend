// LiveLib → книжная история (23.10): файлы закладки tools/livelib-helper.js (livelib-<ник>.json в «Загрузках») →
// seeds/books/livelib-<ник>.json в формате tools/book-profile-seed.mts (source / watched / ratings / unmatched).
// LiveLib сами не запрашиваем (соглашение, п. 3.2.11): только то, что владелец собрал закладкой на открытых им страницах.
//   npx tsx tools/import-livelib.mts                   — все livelib-*.json из ~/Downloads (или TM_LIVELIB_DIR)
//   npx tsx tools/import-livelib.mts <файлы или папки…> [--dry]
//   npx tsx tools/import-livelib.mts --install         — страница со ссылкой-закладкой: .cache/livelib-install.html
// Сопоставление — без сети, по каталогу bookBase (`b-wd<Q>`): ISBN по src/mocks/bookWorks.ts, иначе название (или
// оригинальное) совпало после нормализации и фамилия автора — с одним из creators; без автора — только длинное (≥ 6
// знаков) и единственное в каталоге, как запасной путь Goodreads. book-profile-seed.mts не импортируем: экспортов у него
// нет, а при импорте он сразу запускает сбор, — нормализация названия повторена здесь буква в букву (norm).
// Оценка LiveLib 1–5 с половинками → raw = звёзды × 2 (1–10, шкала Goodreads/Фантлаба), rating = round(raw / 2).
// Повторный импорт дописывает к прошлой истории (свежая запись главнее) — как book-profile-seed. seeds/ — в git не уходит.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = 'seeds/books';
const DOWNLOADS = process.env.TM_LIVELIB_DIR ?? join(homedir(), 'Downloads');

/** запись закладки (llParse в tools/livelib-helper.js) */
export interface LlBook { id: string; title: string; author?: string; authorIds?: string[]; stars?: number; rateFrom?: string; at?: string; atMonth?: boolean; isbn?: string; url?: string }
interface LlFile { format: 'livelib-helper'; version: number; nick: string; savedAt: string; pages: Record<string, { page: number; books: number }>; books: LlBook[] }
interface Unmatched { title: string; author?: string; year?: number; wd?: string; ref: string; raw?: number; at?: string }
interface BookSeed {
  source: { site: 'livelib'; user: string }; resolvedAt: string;
  watched: { workId: string }[]; ratings: { workId: string; rating: 1 | 2 | 3 | 4 | 5; raw: number; at?: string }[];
  unmatched: Unmatched[];
}
interface Card { id: string; title: string; originalTitle?: string; creators?: string[] }

// та же нормализация, что в book-profile-seed.mts (запасной путь Goodreads)
const norm = (s?: string) => (s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\(.*?\)|[«»"'.,:;!?…–—-]/g, ' ').replace(/\s+/g, ' ').trim();
/** фамилия — последнее слово имени; «Булгаков Михаил» тоже бывает — поэтому сверяем и первое */
const nameEnds = (name: string) => { const w = norm(name).split(' ').filter((x) => x.length >= 2); return w.length ? [w[0], w[w.length - 1]] : []; };

export function makeMatcher(catalog: Card[], isbnToWd: Record<string, { wd?: string }> = {}) {
  const ids = new Set(catalog.map((w) => w.id));
  const byTitle = new Map<string, Card[]>();
  for (const w of catalog) for (const t of new Set([norm(w.title), norm(w.originalTitle)])) if (t) byTitle.set(t, [...(byTitle.get(t) ?? []), w]);
  const authorFits = (author: string, w: Card) => {
    const mine = author.split(/\s*,\s*|\s+и\s+/).map((n) => norm(n).split(' ').filter((x) => x.length >= 2).pop()).filter(Boolean) as string[];
    return (w.creators ?? []).some((c) => nameEnds(c).some((x) => mine.includes(x)));
  };
  /** → `b-wd<Q>` или причина, почему нет */
  return (b: LlBook): { workId: string } | { miss: string } => {
    const wd = b.isbn ? isbnToWd[b.isbn]?.wd : undefined;
    if (wd && ids.has(`b-wd${wd.slice(1)}`)) return { workId: `b-wd${wd.slice(1)}` };
    const t = norm(b.title);
    // «Название: подзаголовок» / «Название. Книга 1» — пробуем и без хвоста
    let cands = byTitle.get(t) ?? [];
    if (!cands.length) { const head = norm(b.title.split(/[:.]\s/)[0]); if (head !== t) cands = byTitle.get(head) ?? []; }
    if (!cands.length) return { miss: 'нет в каталоге' };
    if (b.author) {
      const fit = cands.filter((w) => authorFits(b.author!, w));
      if (fit.length === 1) return { workId: fit[0].id };
      if (fit.length > 1) return { miss: 'несколько книг с таким названием и автором' };
      if (cands.length === 1 && !cands[0].creators?.length && t.length >= 6) return { workId: cands[0].id };
      return { miss: 'название есть, автор другой' };
    }
    if (cands.length === 1 && t.length >= 6) return { workId: cands[0].id };
    return { miss: cands.length > 1 ? 'несколько книг с таким названием' : 'короткое название без автора' };
  };
}

/** звёзды 0,5–5 → raw 1–10 и оценка 1–5 (как у Goodreads в book-profile-seed: round(raw / 2)) */
export const scale = (stars: number) => {
  const raw = Math.min(10, Math.max(1, Math.round(stars * 2)));
  return { raw, rating: Math.min(5, Math.max(1, Math.round(raw / 2))) as 1 | 2 | 3 | 4 | 5 };
};

const read = <T,>(f: string, d: T): T => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as T : d; } catch { return d; } };
/** ник LiveLib — в имя файла: латиница, кириллица, цифры, «_.-» */
const fileNick = (nick: string) => nick.replace(/[^\p{L}\p{N}_.-]/gu, '_').slice(0, 64);

function install() {
  const code = readFileSync(new URL('./livelib-helper.js', import.meta.url), 'utf8');
  const href = `javascript:${encodeURIComponent(code)}`.replace(/"/g, '%22');
  mkdirSync('.cache', { recursive: true });
  writeFileSync('.cache/livelib-install.html', `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Закладка LiveLib</title>
<style>
  :root { --bg: #f6f5f2; --panel: #fff; --ink: #1d1c1a; --muted: #6d6a64; --line: #e3e0da; }
  @media (prefers-color-scheme: dark) { :root { --bg: #151514; --panel: #1f1e1c; --ink: #ecebe7; --muted: #9c988f; --line: #33312d; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin: 12px 0; }
  .muted { color: var(--muted); } code { font: 13px ui-monospace, Menlo, monospace; }
  a.bm { display: inline-block; padding: 3px 10px; border-radius: 8px; background: #e6a23c; color: #1c1a17; font-weight: 600; text-decoration: none; }
</style></head><body><main>
<h1>Закладка LiveLib → история книг</h1>
<p class="muted">Закладка ничего не скачивает с LiveLib сама и страниц не листает: она читает только ту страницу, которую вы открыли, и копит книги в вашем браузере.</p>
<div class="card"><ol>
  <li>Один раз: включите панель закладок (⌘⇧B) и перетащите туда кнопку → <a class="bm" href="${href}">LiveLib → книги</a></li>
  <li>Откройте на LiveLib читателя → вкладку «Прочитанное» (адрес вида <code>livelib.ru/reader/&lt;ник&gt;/read</code>) и нажмите закладку. В углу появится окошко: сколько книг на странице и сколько собрано всего.</li>
  <li>Перейдите на следующую страницу списка сами и снова нажмите закладку. «Показать ещё» на той же странице подхватывается без нажатия.</li>
  <li>В конце — «Скачать JSON»: в «Загрузках» появится <code>livelib-&lt;ник&gt;.json</code>. Затем в терминале: <code>npx tsx tools/import-livelib.mts</code>.</li>
</ol></div>
<p class="muted">Если окошко пишет «Не нашёл список» или «Оценок не нашёл» — нажмите «Сохранить HTML страницы» и пришлите файл <code>livelib-&lt;ник&gt;-page&lt;N&gt;.html</code>: по нему поправим разбор.</p>
</main></body></html>
`);
  console.log('→ .cache/livelib-install.html — открыть: open .cache/livelib-install.html');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--install')) return install();
  const dry = args.includes('--dry');
  const inputs = args.filter((a) => !a.startsWith('--'));
  const files = (inputs.length ? inputs : [DOWNLOADS]).flatMap((p) => {
    if (!existsSync(p)) { console.error(`нет файла: ${p}`); process.exit(1); }
    return statSync(p).isDirectory() ? readdirSync(p).filter((f) => /^livelib-.+\.json$/i.test(f)).sort().map((f) => join(p, f)) : [p];
  });
  // по нику — все файлы (браузер дописывает « (1)» ко второму скачиванию); по книге главнее более поздний файл
  const people = new Map<string, { nick: string; savedAt: string; books: Map<string, LlBook> }>();
  for (const f of files) {
    const d = read<LlFile | undefined>(f, undefined);
    if (d?.format !== 'livelib-helper' || !Array.isArray(d.books) || !d.nick) { console.error(`  не файл закладки LiveLib, пропускаю: ${f}`); continue; }
    const key = d.nick.toLowerCase();
    const p = people.get(key) ?? { nick: d.nick, savedAt: '', books: new Map() };
    const fresh = d.savedAt >= p.savedAt;
    for (const b of d.books) if (b?.id && b.title) p.books.set(b.id, fresh ? { ...p.books.get(b.id), ...b } : { ...b, ...p.books.get(b.id) });
    if (fresh) p.savedAt = d.savedAt;
    people.set(key, p);
  }
  if (!people.size) { console.error(`файлов закладки нет (livelib-*.json в ${inputs.length ? inputs.join(', ') : DOWNLOADS})`); process.exit(2); }

  const { bookBase } = await import('../src/mocks/bookBase.ts');
  const { bookWorks } = await import('../src/mocks/bookWorks.ts');
  const match = makeMatcher(bookBase, bookWorks);
  for (const p of people.values()) {
    const file = `${DIR}/livelib-${fileNick(p.nick)}.json`;
    const prev = read<BookSeed | undefined>(file, undefined);
    const rated = new Map((prev?.ratings ?? []).map((r) => [r.workId, r]));
    const seen = new Set((prev?.watched ?? []).map((w) => w.workId));
    const unmatched = new Map((prev?.unmatched ?? []).map((u) => [u.ref, u]));
    const why = new Map<string, number>();
    let matched = 0;
    const books = [...p.books.values()];
    for (const b of books) {
      const ref = `livelib:${b.id}`;
      const s = b.stars ? scale(b.stars) : undefined;
      const r = match(b);
      if ('miss' in r) {
        why.set(r.miss, (why.get(r.miss) ?? 0) + 1);
        unmatched.set(ref, { title: b.title, ...(b.author ? { author: b.author } : {}), ref, ...(s ? { raw: s.raw } : {}), ...(b.at ? { at: b.at } : {}) });
        continue;
      }
      matched++;
      unmatched.delete(ref);
      seen.add(r.workId);
      if (s) rated.set(r.workId, { workId: r.workId, rating: s.rating, raw: s.raw, ...(b.at ? { at: b.at } : {}) });
    }
    const seed: BookSeed = { source: { site: 'livelib', user: p.nick }, resolvedAt: new Date().toISOString(),
      watched: [...seen].map((workId) => ({ workId })), ratings: [...rated.values()], unmatched: [...unmatched.values()] };
    const guessed = books.filter((b) => b.rateFrom === 'guess').length;
    console.log(`${dry ? '(--dry) ' : ''}→ ${file}: книг ${books.length}, с оценкой ${books.filter((b) => b.stars).length}${guessed ? ` (по догадке ${guessed})` : ''}, с датой ${books.filter((b) => b.at).length}; в каталоге ${matched}, оценок в истории ${seed.ratings.length}; вне каталога ${seed.unmatched.length}`);
    if (why.size) console.log(`  мимо: ${[...why].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    if (dry) continue;
    mkdirSync(DIR, { recursive: true });
    writeFileSync(`${file}.tmp`, `${JSON.stringify(seed, null, 1)}\n`);
    renameSync(`${file}.tmp`, file);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
