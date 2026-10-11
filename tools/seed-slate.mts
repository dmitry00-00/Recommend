// Лента по профилю без браузера (09.10): что приложение предложит человеку с этой историей. Профиль —
// seeds/<имя>.json (присланный список, импорт Кинопоиска или профиль канала из tools/channel-seed.mts).
// Приложение грузится в Node через vite (ssrLoadModule) в режиме «чистый новичок» (`?fresh`): справочник тот же,
// истории владельца нет; «видел» — setWatched, оценки — rateWork, дальше getSlate — как в Telegram.
// В расчёт идут только фильмы справочника: чего в нём нет, модель не знает (у таких нет разметки).
//   npx tsx tools/seed-slate.mts tg-episodesfilm [normal|low|high]
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const name = process.argv[2];
const energy = (process.argv[3] ?? 'normal') as 'low' | 'normal' | 'high';
if (!name) { console.error('какой профиль? npx tsx tools/seed-slate.mts tg-episodesfilm'); process.exit(2); }
const seed = JSON.parse(readFileSync(`seeds/${name}.json`, 'utf8')) as {
  watched: { workId: string }[]; ratings?: { workId: string; rating: 1 | 2 | 3 | 4 | 5 }[];
};

// заглушки браузера: приложению нужны localStorage, location и немного document
const mem = new Map([['tm.fresh', '1']]);
const g = globalThis as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, String(v)), removeItem: (k: string) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
g.sessionStorage = g.localStorage;
g.location = new URL('http://localhost/?fresh');
g.window = globalThis; g.addEventListener = () => {}; g.removeEventListener = () => {};
g.document = { documentElement: { lang: 'ru', dataset: {}, style: { setProperty() {} } }, addEventListener() {}, querySelector: () => null, createElement: () => ({ style: {} }) };

const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const api = await vite.ssrLoadModule('/src/api/index.ts');
  await api.getRatingDeck();
  for (const w of seed.watched) await api.setWatched(w.workId, true);
  let rated = 0;
  for (const r of seed.ratings ?? []) rated = (await api.rateWork(r.workId, r.rating)).rated;
  console.log(`${name}: видел ${seed.watched.length}, оценок ${seed.ratings?.length ?? 0}, из них в справочнике ${rated}`);
  const slate = await api.getSlate(energy);
  if (slate.coldStart) { console.log(`лента не собирается: оценок в справочнике ${slate.coldStart.rated} из ${slate.coldStart.needed}`); }
  else {
    console.log(`лента (${energy}):`);
    slate.items.forEach((r: { work: { title: string; year: number; complexityLevel: number; countries?: string[] }; slot: string; analyses?: unknown[] }, i: number) =>
      console.log(`  ${i + 1}. ${r.work.title} (${r.work.year}) · ${r.slot} · ур.${r.work.complexityLevel} · разборов ${r.analyses?.length ?? 0} · ${(r.work.countries ?? []).join(', ')}`));
  }
} finally {
  await vite.close();
}
