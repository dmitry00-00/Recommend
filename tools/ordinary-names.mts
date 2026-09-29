// Названия-ловушки: «Спасибо», «Продюсеры», «Сестра», «Ещё по одной» — это и фильмы, и
// повседневные слова, и в чужом тексте они ловятся не как название («ВСЕМ СПАСИБО» ушло в
// «Спасибо» 2003 года, замер 24.09).
//
// Отличаем их не длиной — короткий «Олдбой» ни с чем не спутать, а «Телохранитель» длинный и
// путается, — и не рукописным списком, который придётся вечно дополнять. Отличает сам корпус:
// слово, которое сотни постов пишут со строчной буквы, — повседневное. Названия так не пишут,
// у них счёт со строчной близок к нулю.

/** Слово целиком, не хвост чужого: «Спасибо» не должно попадать сюда как «пасибо». */
const WORD = /(?<!\p{L})[а-яёa-z]{3,}(?!\p{L})/gu;

/** Короткая основа: пяти букв хватает, чтобы свести склонения в одно. Морфологии мы не
 *  обещаем, и огрубление тут заведомо слипает чужое: «сталкер» с «сталкивается», «престиж»
 *  с «преступлением», «прибытие» с «прибылью» (замер 26.09). Поэтому счёт по основам — не
 *  приговор, а только первое сито: решает потом точная фраза, без всяких основ
 *  (tools/build-ordinary.mts). Сито нарочно широкое: пропустить кандидата дороже. */
const stem = (w: string): string => {
  const s = w.toLowerCase().replace(/ё/g, 'е');
  return s.length > 5 ? s.slice(0, 5) : s;
};

/** Сколько постов пишут слово со строчной буквы. Считаем постами, а не вхождениями: пост,
 *  двадцать раз повторивший слово, — это одно наблюдение, а не двадцать.
 *  Вход — поток, а не массив: корпус в сорок с лишним тысяч постов держать в памяти целиком
 *  незачем, и первая попытка замера на этом и упала (24.09). */
export function lowercaseCounts(texts: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const text of texts) addText(counts, text);
  return counts;
}

/** Один пост в счётчик — для обхода каналов по одному. */
export function addText(counts: Map<string, number>, text: string): void {
  const seen = new Set<string>();
  for (const m of text.matchAll(WORD)) seen.add(stem(m[0]));
  for (const s of seen) counts.set(s, (counts.get(s) ?? 0) + 1);
}

/** Доля постов, после которой слово (или фраза) считается повседневным. Замер 26.09 на 65 949
 *  постах: при 0.002 (порог 132 поста) сито по словам оставляет 380 названий, а проверка
 *  фразой — 36, и это ровно повседневные слова («Спасибо», «Другие», «Правда», «Завтра»).
 *  «Солярис», «Олдбой», «Сталкер», «Прибытие», «Один дома», «Назад в будущее» не попадают. */
export const ORDINARY_SHARE = 0.002;

/** Названия, целиком состоящие из повседневных слов. Целиком — потому что одного редкого
 *  слова хватает, чтобы название стало узнаваемым: «Треугольник печали» ловится на «печали»,
 *  а «Ещё по одной» не ловится ни на чём. */
export function ordinarySet(texts: Iterable<string>, names: Iterable<string>, share = ORDINARY_SHARE): Set<string> {
  let n = 0;
  const counts = new Map<string, number>();
  for (const t of texts) { addText(counts, t); n += 1; }
  return ordinaryFrom(counts, n, names, share);
}

/** То же по готовому счётчику: корпус обошли один раз, а порогов пробуем несколько. */
export function ordinaryFrom(counts: Map<string, number>, posts: number, names: Iterable<string>, share = ORDINARY_SHARE): Set<string> {
  const threshold = Math.max(20, Math.round(posts * share));
  const out = new Set<string>();
  for (const name of names) {
    const words = [...name.matchAll(/\p{L}{3,}/gu)].map((m) => m[0]);
    if (words.length && words.every((w) => (counts.get(stem(w)) ?? 0) >= threshold)) out.add(name);
  }
  return out;
}
