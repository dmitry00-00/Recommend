// Лента по профилю без браузера (09.10): что приложение предложит человеку с этой историей. Профиль —
// seeds/<имя>.json (присланный список, импорт Кинопоиска или профиль канала из tools/channel-seed.mts).
// Приложение грузится в Node через vite (ssrLoadModule) в режиме «чистый новичок» (`?fresh`): справочник тот же,
// истории владельца нет; «видел» — setWatched, оценки — rateWork, дальше getSlate — как в Telegram.
// В расчёт идут только фильмы справочника: чего в нём нет, модель не знает (у таких нет разметки).
//   npx tsx tools/seed-slate.mts tg-episodesfilm [normal|low|high|normal,low,high]
//   EXP=learnedBlend,fullPool npx tsx tools/seed-slate.mts … — с опытами (23.10, src/lib/model/experiments.ts); таблицы
//   «как оценили другие» и сходства берутся целиком, с самим человеком, — шестёрка чуть лучше настоящей. EXP=twoStage (23.10) —
//   подбор в два шага, как в ленте: getSlate → slateFor ждёт известность и src/mocks/consensusCount.ts → recommend → twoStageSort
// Несколько сил через запятую — за один прогон (11.10): профиль из импорта Кинопоиска — это две тысячи отметок, и
// грузить их заново на каждую силу незачем. Паузы-имитации сети у api (`delay`, до 300 мс) здесь проходят сразу:
// с ними две тысячи отметок шли минут семь на каждую ленту.
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const name = process.argv[2];
const energies = (process.argv[3] ?? 'normal').split(',') as ('low' | 'normal' | 'high')[];
if (!name) { console.error('какой профиль? npx tsx tools/seed-slate.mts tg-episodesfilm'); process.exit(2); }
const seed = JSON.parse(readFileSync(`seeds/${name}.json`, 'utf8')) as {
  watched: { workId: string; work?: unknown }[]; ratings?: { workId: string; rating: 1 | 2 | 3 | 4 | 5; raw?: number; work?: unknown }[];
};

// заглушки браузера: приложению нужны localStorage, location и немного document
const mem = new Map([['tm.fresh', '1']]);
const g = globalThis as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, String(v)), removeItem: (k: string) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
g.sessionStorage = g.localStorage;
g.location = new URL('http://localhost/?fresh');
g.window = globalThis; g.addEventListener = () => {}; g.removeEventListener = () => {};
// короткие таймеры — сразу; длинные (ожидания сети, повторы) — как есть
const realTimeout = globalThis.setTimeout;
g.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => realTimeout(fn, (ms ?? 0) <= 300 ? 0 : ms, ...rest)) as typeof setTimeout;
g.document = { documentElement: { lang: 'ru', dataset: {}, style: { setProperty() {} } }, addEventListener() {}, querySelector: () => null, createElement: () => ({ style: {} }) };

// сид импорта Кинопоиска несёт свои карточки (`l-tmdb…`), которых в справочнике нет: такой сид приложение получает с
// сервера состоянием (`hydrate`) — им же его и кладём; внутренняя функция открывается только этому процессу
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{ name: 'seed-slate', enforce: 'post', transform(code, id) { if (id.endsWith('/src/api/index.ts')) return `${code}\nexport const __hydrate = hydrate;\nimport { setExperiments as __se } from '@/lib/model/experiments'; __se(${JSON.stringify((process.env.EXP ?? '').split(',').filter(Boolean))});`; } }] });
try {
  const api = await vite.ssrLoadModule('/src/api/index.ts');
  await api.getRatingDeck();
  let rated = 0;
  if (seed.watched.some((w) => w.work) || seed.ratings?.some((r) => r.work)) {
    const at = new Date().toISOString();
    api.__hydrate({ settings: {}, predictions: [], verdicts: [],
      watched: seed.watched.map((w) => ({ workId: w.workId, watched: true, ...(w.work ? { work: w.work } : {}) })),
      ratings: (seed.ratings ?? []).map((r) => ({ workId: r.workId, rating: r.rating, ...(r.raw != null ? { raw: r.raw } : {}), ...(r.work ? { work: r.work } : {}), at })) });
    rated = (await api.getTasteProgress()).rated;
  } else {
    for (const w of seed.watched) await api.setWatched(w.workId, true);
    for (const r of seed.ratings ?? []) rated = (await api.rateWork(r.workId, r.rating)).rated;
  }
  console.log(`${name}: видел ${seed.watched.length}, оценок ${seed.ratings?.length ?? 0}, из них в справочнике ${rated}`);
  for (const energy of energies) {
    const slate = await api.getSlate(energy);
    if (slate.coldStart) { console.log(`лента не собирается: оценок в справочнике ${slate.coldStart.rated} из ${slate.coldStart.needed}`); break; }
    console.log(`лента (${energy}):`);
    slate.items.forEach((r: { work: { title: string; year: number; type: string; complexityLevel: number; countries?: string[] }; slot: string; analyses?: unknown[] }, i: number) =>
      console.log(`  ${i + 1}. ${r.work.title} (${r.work.year}${r.work.type === 'film' ? '' : `, ${r.work.type}`}) · ${r.slot} · ур.${r.work.complexityLevel} · разборов ${r.analyses?.length ?? 0} · ${(r.work.countries ?? []).join(', ')}`));
  }
} finally {
  await vite.close();
}
