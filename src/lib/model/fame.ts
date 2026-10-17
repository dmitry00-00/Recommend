// Засветка топами (17.10, решение владельца). Самые громкие фильмы, сериалы и книги — как уличный свет города: из-за
// него ночное небо выглядит пустым и видны только самые яркие звёзды. Подбор их приглушает, чтобы стало видно
// остальное. Это не запрет: громкое по-прежнему находится в поиске, лежит в колоде новичка и проходит, если подходит
// заметно лучше прочего.
//
// Известность — 1…3 (src/mocks/fame.ts, tools/build-fame.mts): разделы Википедии и месяцы в топе русской Википедии.
// Сила — по настройке участника и по его насмотренности: новичку топы ещё полезны как опора, насмотренному почти нет.

export type DimFamous = 'off' | 'soft' | 'strong';
export const DIM_DEFAULT: DimFamous = 'soft';

/** Штраф к счёту кандидата (счёт — около 0…1, проходной порог 0,3) по уровню известности 0…3. */
const PENALTY: Record<DimFamous, readonly [number, number, number, number]> = {
  off: [0, 0, 0, 0],
  soft: [0, 0.02, 0.05, 0.1],
  strong: [0, 0.06, 0.14, 0.3],
};

/** Насмотренность 0…10 → множитель 0,5…1: новичку вполсилы. */
const literacyFactor = (mediaLiteracy: number): number => 0.5 + Math.min(10, Math.max(0, mediaLiteracy)) / 20;

export function famePenalty(level: number | undefined, mode: DimFamous, mediaLiteracy: number): number {
  if (!level) return 0;
  return PENALTY[mode][Math.min(3, Math.max(0, Math.round(level)))] * literacyFactor(mediaLiteracy);
}

/** «Убрать самые громкие»: третий уровень в подбор не идёт вовсе. */
export const fameExcluded = (level: number | undefined, mode: DimFamous): boolean => mode === 'strong' && level === 3;
