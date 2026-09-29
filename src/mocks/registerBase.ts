// Сгенерировано tools/build-register-base.mts (2026-09-22): доля регистров
// в широкой выборке TMDb (400 фильмов, популярное с 1960-го, без фильтра по жанру) — то,
// относительно чего считается вкус участника. Не править руками — перегенерировать.
import type { Register } from '@/types/tmdf';

export const registerBase: Record<Register, number> = {
  "folk_gothic": 0.156,
  "body_visceral": 0.03,
  "cold_clinical": 0.024,
  "genre_idea": 0.127,
  "puzzle_noir": 0.175,
  "absurd_satire": 0.058,
  "quiet_realism": 0.127,
  "myth_adventure": 0.302
};
