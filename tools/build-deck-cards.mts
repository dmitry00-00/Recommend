// Снимок колоды первых оценок (РР-5, этап 1, 14.10): новый человек видит /rate сразу, не дожидаясь справочника
// фильмов (2,7 МБ) и ядра с индексами разборов, — полная колода приходит следом и подменяет снимок (src/api/index.ts,
// getQuickDeck). Карточки — те же, что собирает deckCard в приложении: история владельца, пул, каталог сценария,
// справочник, просмотренное владельца; к ним — кадр или обложка, операции (цвет миниатюры) и авторы (строка под
// названием). Порядок — partsInOrder, как у полной колоды. Только то, что нужно строке колоды.
//   npx tsx tools/build-deck-cards.mts
// Перезапускать, когда меняется колода (ratingDeck.ts / ratingDeckEn.ts) или справочник под ней. Пишет
// src/mocks/deckCards.ts.
import { writeFileSync } from 'node:fs';
import type { WorkCard } from '../src/types/tmdf.ts';
import { ratingDeck } from '../src/mocks/ratingDeck.ts';
import { ratingDeckEn } from '../src/mocks/ratingDeckEn.ts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { candidateMedia } from '../src/mocks/candidateMedia.ts';
import { works } from '../src/mocks/index.ts';
import { catalogMedia } from '../src/mocks/catalogMedia.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseCurated } from '../src/mocks/filmBaseCurated.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { baseMedia } from '../src/mocks/baseMedia.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { workCredits } from '../src/mocks/workCredits.ts';
import { people } from '../src/mocks/people.ts';
import { decodeCredits, workKey } from '../src/lib/credits.ts';
import { partsInOrder } from '../src/lib/deckOrder.ts';

const OUT = 'src/mocks/deckCards.ts';
const wiki = [...filmBaseWiki, ...filmBaseMarkup, ...filmBaseCurated, ...filmBasePopular, ...filmBaseWorld];
const ownByTmdb = new Map(userWorks.flatMap((w) => (w.externalIds?.tmdb != null && userAnnotations[w.id] ? [[w.externalIds.tmdb, userAnnotations[w.id]] as const] : [])));

/** Как deckCard в приложении: история владельца → пул → каталог сценария → справочник → просмотренное. */
function find(id: string): WorkCard | undefined {
  const own = userWorks.find((w) => w.id === id);
  if (own) return own;
  const seed = candidateSeeds.find((s) => s.id === id);
  if (seed) return { ...seedToCard(seed), ...candidateMedia[id] } as WorkCard;
  if (works[id]) return { ...works[id], ...catalogMedia[id] } as WorkCard;
  const base = filmBase.find((w) => w.id === id) ?? wiki.find((w) => w.id === id) ?? watchedWorks.find((w) => w.id === id);
  return base && { ...base, ...baseMedia[id] } as WorkCard;
}

/** Строка колоды: название, год, авторы, картинка, операции, ключи — остальное колоде не нужно. */
function slim(w: WorkCard): WorkCard {
  const tmdb = w.externalIds?.tmdb;
  const a = userAnnotations[w.id] ?? (tmdb != null ? ownByTmdb.get(tmdb) ?? draftAnnotations[`tmdb:${tmdb}`] : undefined);
  const ops = w.primaryOperations.length ? w.primaryOperations : (a?.ops ?? []).map(([op, intensity]) => ({ op, intensity }));
  const credits = w.credits?.length ? w.credits : decodeCredits(workCredits[workKey(w) ?? ''], people);
  return {
    id: w.id, type: w.type, title: w.title,
    ...(w.originalTitle ? { originalTitle: w.originalTitle } : {}),
    ...(w.year ? { year: w.year } : {}),
    creators: w.creators ?? [],
    ...(credits.length ? { credits: credits.filter((c) => c.role === 'director' || c.role === 'creator' || c.role === 'author') } : {}),
    ...(w.stillUrl ? { stillUrl: w.stillUrl } : {}),
    ...(w.coverUrl ? { coverUrl: w.coverUrl } : {}),
    ...(w.imageSource ? { imageSource: w.imageSource } : {}),
    primaryOperations: ops, complexityLevel: w.complexityLevel || a?.level || 0,
    warnings: [], barriers: [], isNicheMasterpiece: false,
    ...(w.externalIds ? { externalIds: w.externalIds } : {}),
  } as WorkCard;
}

const deck = (ids: string[]) => {
  const missing = ids.filter((id) => !find(id));
  if (missing.length) console.log(`  не нашлось: ${missing.join(', ')}`);
  return partsInOrder(ids.map(find).filter((w): w is WorkCard => Boolean(w))).map(slim);
};
const ru = deck(ratingDeck);
const en = deck(ratingDeckEn);
const text = `// Сгенерировано tools/build-deck-cards.mts (РР-5) — руками не править. Снимок колоды первых оценок: строка /rate
// у нового человека — сразу, полная колода (своё просмотренное, полки вкуса, сериалы, книги) — следом.
import type { WorkCard } from '@/types/tmdf';

/** колода, с которой снят снимок: разошлась с ratingDeck.ts / ratingDeckEn.ts — снимок не показывается (сразу полная) */
export const deckSource: { ru: string; en: string } = ${JSON.stringify({ ru: ratingDeck.join(','), en: ratingDeckEn.join(',') })};

export const deckCards: { ru: WorkCard[]; en: WorkCard[] } = ${JSON.stringify({ ru, en })};
`;
writeFileSync(OUT, text);
console.log(`ru ${ru.length}, en ${en.length}; ${OUT} — ${Math.round(text.length / 1024)} КБ`);
