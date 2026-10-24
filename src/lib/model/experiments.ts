// Опыты над подбором (23.10, решение владельца — браться за правки модели по разбору .cache/eval/why-2026-10-22.md).
// Каждая правка счёта — за своим флагом: по умолчанию всё выключено, лента ровно прежняя. Замер (tools/taste-eval.mts
// --exp a,b) включает флаги в своём процессе и сравнивает с выключенными; в ленту правка идёт, только когда замер показал
// прирост и владелец сказал «включать» — тогда флаг становится true здесь (или уходит вместе с прежним кодом).
export const EXPERIMENTS = {
  /** «как фильм оценили другие»: средняя z-оценка фильма по чужим историям (src/lib/model/consensus.ts) */
  consensus: false,
  /** «похожие фильмы» (23.10): кто высоко оценил X, высоко оценивает Y — по таблице пар (src/lib/model/itemSim.ts) */
  itemSim: false,
  /** засветка топами — не штрафом в счёте, а пределом в шестёрке: не больше FAME_CAP громких */
  fameCap: false,
  /** вкус к регистрам — по оценкам, а не по частоте просмотра (deriveState.ts) */
  registerByRating: false,
  /** якорь вкуса не гаснет у длинной истории (taste.ts) */
  anchorKeep: false,
  /** якорь видит жанры и страны пула (23.10, решение владельца: Wikidata, TMDb — для новинок): src/mocks/filmGenresFill.ts
   *  поверх filmGenres — жанры ~98% пула подбора вместо ~18%, страны ~100% вместо ~15% (genresOf/countriesOf, src/api) */
  anchorFill: false,
  /** уровень сложности — монотонная кривая с потолком, у операций меньше веса (recommend.ts) */
  levelCurve: false,
  /** соседи по вкусу (23.10): итог по фильму с сервера (GET /api/neighbors, worker/neighbors.ts; src/lib/model/neighbors.ts) */
  neighbors: false,
  /** подбор в два шага: отбор нескольких сотен из «все смотрят», оценки других, якоря и квоты открытий — порядок fullScore (candidates.ts);
   *  в ленте (23.10, решение владельца) — квоты TWO_STAGE_FEED: 100 «все смотрят» (src/mocks/consensusCount.ts) + 6 открытий, отобранные вперёд */
  twoStage: false,
  /** полный пул в ленте (23.10): ленивые карточки и разметка (loadFilmLinks, loadSeriesWiki, ~3,5 тыс. фильмов) приходили
   *  в пул, только если человек до ленты открывал справочник (`catalog()`), — с флагом лента у истории ждёт их сама */
  fullPool: false,
  /** обученный счёт (23.10, решение владельца): веса taste-tune, цель b — «найти любимое во всём пуле» (LEARNED_B,
   *  recommend.ts) вместо прежней суммы, плюс предел громких в шестёрке, как у fameCap (не больше двух при «мягко») */
  learnedBlend: false,
  /** EASE в обученном счёте (24.10, решение владельца; .cache/eval/tune-2026-10-24-learned-ease.md): счёт фильма «что посмотрит»
   *  и «что понравится» с сервера (GET /api/ease, worker/ease.ts; src/lib/model/ease.ts) — части easeBin/easeLike и веса
   *  LEARNED_E (recommend.ts) вместо LEARNED_B: на чужих частях hit@150 30% против 18%. Только вместе с learnedBlend (EASE —
   *  часть обученного счёта, без него флаг ничего не меняет и ручку не зовёт); таблица не пришла — прежний LEARNED_B */
  ease: false,
  /** короткая история (23.10, .cache/eval/cold-start-2310.md): в learnedScore вес itemSim × r(n) по числу оценок (SHORT_HISTORY, recommend.ts) */
  shortHistory: false,
  /** порядок колоды первых оценок (23.10): «сначала известное, о чём мнения расходятся» — HELF по историям зрителей
   *  (src/lib/deckOrder.ts, таблица src/mocks/deckOrder.ts); состав колоды прежний, ленты не касается */
  deckOrder: false,
  /** известность по просмотрам Википедии (23.10, tools/build-fame-views.mts → src/mocks/fameViews.ts): уровни 0–3 из
   *  просмотров статей за 24 месяца (max(ru, en/k)) вместо нынешнего fame, доли уровней те же, приглушение то же;
   *  нет фильма в таблице — прежний уровень. fameViewsRu — то же по одной русской статье */
  fameViews: false,
  fameViewsRu: false,
};
export type Experiment = keyof typeof EXPERIMENTS;

/** Включить опыты (только замер и тесты): неизвестное имя — ошибка, чтобы опечатка не мерила «ничего». */
export function setExperiments(on: readonly string[]): void {
  for (const k of Object.keys(EXPERIMENTS) as Experiment[]) EXPERIMENTS[k] = false;
  for (const name of on) {
    if (!(name in EXPERIMENTS)) throw new Error(`нет такого опыта: ${name} (есть: ${Object.keys(EXPERIMENTS).join(', ')})`);
    EXPERIMENTS[name as Experiment] = true;
  }
}
