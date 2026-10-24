// EASE для обученного счёта ленты (24.10, опыт `ease` при learnedBlend): GET /api/ease → по фильму счёт EASE участника
// двух видов — «что посмотрит» (bin, матрица «оценил») и «что понравится» (like, «оценил выше своей середины»), ровно как
// столбцы easeBin/easeLike выгрузки замера (tools/dump-add-ease.mts: λ = EASE.lambda у обоих, порог EASE.minRaters): на них
// обучены веса LEARNED_E (src/lib/model/recommend.ts). Расчёт — src/lib/model/ease.ts; здесь — X, кэш и ответ.
//
// X — тот же набор, что у соседей (worker/neighbors.ts: опорные истории из NEIGHBOR_ANCHORS_FILE и участники с
// NEIGHBOR.minRated оценками, одна сборка на POOL_TTL), по строке на человека: из двойников (он же опорной историей и в
// приложении) — один, с большей историей, иначе он считался бы двумя оценившими (и порог minRaters — двумя людьми). Самого
// спрашивающего в X нет — как в выгрузке, где модель без человека: его строка и строка его двойника вынимаются из готовой
// модели (easeWithout), вход — его оценки. Наружу — только счёт по фильму, и лишь по фильмам, которые оценили не меньше
// EASE.minRaters других; оценённое им самим — мимо. Меньше EASE.minRated оценок (или X меньше EASE_SERVER.minPeople) —
// пусто: источника нет, лента — LEARNED_B.
//
// Цена: на набор — две матрицы X и обращение K (люди³ и Σ квадратов числа оценивших по фильмам) — доли секунды на сотнях
// людей, раз на сборку набора; ответ — вынуть строку из K⁻¹ (люди²) и пройти по ненулевым X — миллисекунды; кэш на
// участника, пока не изменились его оценки (число и время последней) и набор. Без EASE=1 в окружении ручка выключена: в
// ленте её зовёт только клиент с флагами learnedBlend и ease.
import { myFilms, neighborPool, ratedHead, type NeighborEnv } from './neighbors';
import { mineIn, twins, type Pool } from '../src/lib/model/neighbors';
import { EASE, easeData, easeFit, easeInput, easePack, easeScores, easeWithout, type EaseFilm, type EaseKind, type EaseModel } from '../src/lib/model/ease';

export interface EaseEnv extends NeighborEnv {
  /** «1» — ручка включена (опорные истории — те же, что у соседей: NEIGHBOR_ANCHORS) */
  EASE?: string;
}

/** ответ — строкой, повтор из кэша его не пересобирает. Замер 24.10 на настоящих историях (271 человек, 35 тыс. фильмов,
 *  13 тыс. оценены ≥ 3): ~12–13 тыс. фильмов в ответе, JSON ~250 КБ (сжатым ~75 КБ), на 540 людях — ~350 КБ (~105 КБ);
 *  сборка X и K⁻¹ обоих видов — 0,3 с на 271 человеке и 0,6 с на 540, ответ — 15–35 мс. Отсюда и предел кэша: 100 × 250 КБ */
const USER_CACHE = 100;

/** X меньше стольких людей (нет файла опорных — одни участники) — счёта нет: веса обучены на X из сотни с лишним историй, а
 *  на десятке почти всё «оценили меньше трёх» — у всего пула вес «нет значения», и порог 0.3 съеден. Поле — для проверок */
export const EASE_SERVER = { minPeople: 50 };

const send = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' } });

// ─── модель на набор ───────────────────────────────────────────────────────────

interface Built {
  version: number;
  /** строка X → номер человека в наборе соседей */
  rows: number[];
  bin: EaseModel; like: EaseModel;
}
let built: Built | undefined;

function modelOf(p: { version: number; value: Pool }): Built {
  if (built?.version === p.version) return built;
  const { people, filmKeys } = p.value;
  // по строке на группу двойников — с большей историей
  const best = new Map<number, number>();
  people.forEach((x, i) => { const b = best.get(x.group); if (b == null || x.z.size > people[b].z.size) best.set(x.group, i); });
  const rows = [...best.values()].sort((a, b) => a - b);
  const films = new Map<string, EaseFilm[]>(rows.map((i) => [String(i), [...people[i].z].map(([f, z]) => ({ keys: filmKeys[f], z }))]));
  const fit = (kind: EaseKind) => easeFit(easeData(films, kind), EASE.lambda);
  built = { version: p.version, rows, bin: fit('bin'), like: fit('like') };
  return built;
}

// ─── ответ участнику ───────────────────────────────────────────────────────────

const cache = new Map<string, { sig: string; body: string }>();

/** GET /api/ease → `{ rated, scale, keys, bin, like }` (EasePacked: счёт × scale целыми, фильма нет в keys — нет значения);
 *  оценок меньше EASE.minRated — пустые списки. */
export async function getEase(userId: string, env: EaseEnv): Promise<Response> {
  if (env.EASE !== '1') return send(JSON.stringify({ error: 'not_found' }), 404);
  const { rated, at } = await ratedHead(env, userId);
  if (rated < EASE.minRated) return send(JSON.stringify({ rated, scale: EASE.scale, keys: [], bin: [], like: [] }));
  const p = await neighborPool(env);
  const sig = `${rated}|${at}|${p.version}`;
  const hit = cache.get(userId);
  if (hit?.sig === sig) { cache.delete(userId); cache.set(userId, hit); return send(hit.body); }

  const m = modelOf(p);
  if (m.rows.length < EASE_SERVER.minPeople) return send(JSON.stringify({ rated, scale: EASE.scale, keys: [], bin: [], like: [] }));
  const films = await myFilms(env, userId);
  const mine = mineIn(p.value, films);
  const me = `u:${userId}`;
  // кого вынуть: свою строку (и строку своего двойника — та же группа) и двойника по нынешним оценкам (опорная история
  // того, кто ещё не в наборе участников)
  const groups = new Set(p.value.people.filter((x) => x.id === me).map((x) => x.group));
  const skip = m.rows.flatMap((i, r) => (groups.has(p.value.people[i].group) || twins(mine, p.value.people[i].z) ? [r] : []));
  const bin = easeWithout(m.bin, skip), like = easeWithout(m.like, skip);
  const xb = easeInput(bin.data, films);
  const sb = easeScores(bin, xb), sl = easeScores(like, easeInput(like.data, films));
  // оценённое им самим — мимо: оно уже не в ленте (у bin вход — все его фильмы из X)
  const body = JSON.stringify({ rated, ...easePack(bin.data, sb, sl, new Set(xb.keys())) });
  cache.set(userId, { sig, body });
  while (cache.size > USER_CACHE) cache.delete(cache.keys().next().value!);
  return send(body);
}

/** Забыть модель и кэш (проверки; набор соседей — forgetNeighbors). */
export function forgetEase(): void { built = undefined; cache.clear(); }
