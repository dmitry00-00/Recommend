// «Уже есть в справочнике» для сборщиков пополнения (волна В, 17.10). worksIndex (tools/works-index.mts) — всё, что мы
// знаем, вместе с историей владельца (userHistory, userWatched) и демо-каталогом (src/mocks/index.ts): так сборщики
// считали «есть» 134 фильма, которых у сервера и нового человека нет («Субстанция», «Джентльмены», «Носферату») —
// freshStart и сервер историю не видят (src/api/index.ts), а демо-каталог — 17 карточек с моками, 11 из них только там
// («Паразиты», «Мастер и Маргарита»). Здесь — только модули справочника, что уходят на сервер, и пул кандидатов.
// Ключи — те же, что у worksIndex (главный и запасные), плюс TMDb/IMDb карточки и элемент Wikidata (`Q…` и `wd:Q…`) из
// id `f-wd…`/`b-wd…` и externalIds.wikidata: у фильма без TMDb ключ — `wd:` (решение владельца 17.10).
//   import { baseWorks, baseHave } from './base-have.mts';
//   baseHave({ except: ['filmBasePopular'] }) — свой модуль не в счёт: его сборщик перегенерирует
import { analysisKeys, idsOf } from './works-index.mts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { candidateMedia } from '../src/mocks/candidateMedia.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { seriesBaseWiki } from '../src/mocks/seriesBaseWiki.ts';
import { filmBaseLinks } from '../src/mocks/filmBaseLinks.ts';
import { filmBaseTail } from '../src/mocks/filmBaseTail.ts';
// пополнение волны В (18.10): ленивый модуль, как filmBaseLinks и filmBaseTail
import { filmBaseMore } from '../src/mocks/filmBaseMore.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseChannels } from '../src/mocks/filmBaseChannels.ts';
import { seriesBase } from '../src/mocks/seriesBase.ts';
import { bookBase } from '../src/mocks/bookBase.ts';
import { withheldWorks } from '../src/mocks/withheldWorks.ts';
import { isAlias } from '../src/lib/canon.ts';
import { applyWorkFixes } from '../src/lib/workFixesTable.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

export const BASE_MODULES = {
  candidates: candidateSeeds.map((s) => ({ ...seedToCard(s), ...candidateMedia[s.id] }) as WorkCard),
  filmBase, filmBaseWiki, filmBaseMarkup, filmBaseCurated, seriesBase, filmBasePopular, seriesBaseWiki,
  filmBaseLinks, filmBaseTail, filmBaseMore, filmBaseWorld, filmBaseChannels, bookBase,
} as const;
export type BaseModule = keyof typeof BASE_MODULES;

/** Элемент Wikidata карточки: externalIds.wikidata или id `f-wd<N>`/`b-wd<N>`. */
export const qidOfCard = (w: WorkCard): string | undefined =>
  idsOf(w)?.wikidata ?? (/^[fb]-wd(\d+)$/.exec(w.id)?.[1] ? `Q${/^[fb]-wd(\d+)$/.exec(w.id)![1]}` : undefined);

/** Карточки справочника (без истории и демо-каталога), с модулем; убранное владельцем — мимо. Лишние копии (канон
 *  копий, src/mocks/workAliases.ts, волна А 17.10) — мимо, если не попросить `aliases`: для «уже есть» их ключи нужны —
 *  у лишней копии бывает ключ, которого у главной нет, и без него сборщик завёл бы третью копию. */
export function baseWorks({ except = [], aliases = false }: { except?: BaseModule[]; aliases?: boolean } = {}): { module: BaseModule; work: WorkCard; keys: string[] }[] {
  const out: { module: BaseModule; work: WorkCard; keys: string[] }[] = [];
  for (const [module, list] of Object.entries(BASE_MODULES) as [BaseModule, readonly WorkCard[]][]) {
    if (except.includes(module)) continue;
    for (const work of list) {
      if (!aliases && isAlias(work.id)) continue;
      const keys = analysisKeys(work);
      if (keys.some((k) => withheldWorks[k])) continue;
      // правки справочника (волна Б): исправленные название и год — для альтернативных названий и замеров
      out.push({ module, work: applyWorkFixes(work, idsOf(work)), keys });
    }
  }
  return out;
}

/** Все ключи справочника одним множеством: `tmdb:`, `imdb:`, `wd:Q…`, `olw:`, `isbn:` и голый `Q…`. */
export function baseHave(opts: { except?: BaseModule[] } = {}): Set<string> {
  const have = new Set<string>();
  for (const { work, keys } of baseWorks({ ...opts, aliases: true })) {
    for (const k of keys) have.add(k);
    const ids = idsOf(work);
    if (ids?.tmdb != null && work.type !== 'series') have.add(`tmdb:${ids.tmdb}`);
    if (ids?.imdb) have.add(`imdb:${ids.imdb}`);
    const q = qidOfCard(work);
    if (q) { have.add(q); have.add(`wd:${q}`); }
  }
  return have;
}
