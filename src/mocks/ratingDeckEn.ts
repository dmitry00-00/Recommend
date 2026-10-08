// Колода первых оценок для английского интерфейса (ЗП-20). Собирает tools/profile-deck.mts --deck-en
// (2026-10-07), не руками: размеченные фильмы по числу смотрящих на Trakt, без
// фильмов с русским оригинальным названием и без английского названия, не больше 2 из одной франшизы;
// потолок на уровень (1: 4, 2: 8, 3: 10, 4: 10, 5: 8);
// в конце — самые смотримые уровня 7+. Русская колода — ratingDeck.ts.

export const ratingDeckEn: string[] = [
  'f-tmdb293660', // Deadpool · 2 · trakt 391k
  'f-tmdb157336', // Interstellar · 4 · trakt 370k
  'f-tmdb118340', // Guardians of the Galaxy · 2 · trakt 361k
  'f-tmdb299536', // Avengers: Infinity War · 2 · trakt 336k
  'f-tmdb19995', // Avatar · 2 · trakt 327k
  'w08', // Inception · 5 · trakt 325k
  'f-tmdb155', // The Dark Knight · 4 · trakt 324k
  'f-tmdb671', // Harry Potter and the Philosopher's Stone · 2 · trakt 323k
  'f-tmdb603', // The Matrix · 4 · trakt 295k
  'f-tmdb672', // Harry Potter and the Chamber of Secrets · 2 · trakt 294k
  'f-wd127367', // The Lord of the Rings: The Fellowship of the Ring · 3 · trakt 292k
  'l-tmdb475557', // Joker · 5 · trakt 275k
  'f-wd15732802', // John Wick · 2 · trakt 272k
  'f-tmdb106646', // The Wolf of Wall Street · 3 · trakt 248k
  'f-wd131074', // The Lord of the Rings: The Return of the King · 3 · trakt 246k
  'f-wd25431158', // Deadpool 2 · 3 · trakt 240k
  'f-wd6144664', // Inside Out · 3 · trakt 236k
  'f-wd246283', // Frozen · 2 · trakt 233k
  'f-wd212965', // The Hunger Games · 3 · trakt 233k
  'f-tmdb286217', // The Martian · 3 · trakt 226k
  'f-tmdb324857', // Spider-Man: Into the Spider-Verse · 3 · trakt 226k
  'f-tmdb693134', // Dune: Part Two · 4 · trakt 223k
  'f-wd171048', // Toy Story · 1 · trakt 222k
  'f-wd57982486', // Knives Out · 3 · trakt 222k
  'f-wd132863', // Finding Nemo · 1 · trakt 222k
  'w04', // Arrival · 5 · trakt 220k
  'f-tmdb269149', // Zootopia · 3 · trakt 218k
  'f-tmdb414906', // The Batman · 4 · trakt 216k
  'f-tmdb680', // Pulp Fiction · 5 · trakt 202k
  'f-tmdb585', // Monsters, Inc. · 1 · trakt 197k
  'w09', // Parasite · 4 · trakt 197k
  'f-tmdb68718', // Django Unchained · 4 · trakt 193k
  'f-tmdb16869', // Inglourious Basterds · 5 · trakt 186k
  'f-tmdb37165', // The Truman Show · 4 · trakt 183k
  'f-tmdb20352', // Despicable Me · 1 · trakt 177k
  'u-kp505851', // Edge of Tomorrow · 4 · trakt 176k
  'f-tmdb545611', // Everything Everywhere All at Once · 5 · trakt 166k
  'u-kp944708', // Get Out · 5 · trakt 162k
  'f-wd165325', // Kill Bill: Volume 1 · 4 · trakt 150k
  'f-tmdb466272', // Once Upon a Time... in Hollywood · 5 · trakt 150k
  'u-kp195334', // The Prestige · 7 · trakt 145k
  'f-tmdb62', // 2001: A Space Odyssey · 7 · trakt 76k
  'u-kp679924', // Predestination · 7 · trakt 65k
  'f-tmdb508883', // The Boy and the Heron · 7 · trakt 40k
  'u-kp819846', // The Lobster · 7 · trakt 40k
  'c-mulholland', // Mulholland Drive · 9 · trakt 37k
  'f-tmdb559907', // The Green Knight · 7 · trakt 34k
];
