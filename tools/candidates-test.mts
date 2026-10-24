// Подбор в два шага (23.10, опыт twoStage): проверки отбора кандидатов на синтетике — без vite и без справочника.
//   npx tsx tools/candidates-test.mts
import assert from 'node:assert/strict';
import { selectRows, twoStageOrder, twoStageSelect, TWO_STAGE, type CandidateRow, type TwoStageQuotas } from '../src/lib/model/candidates.ts';

const Q: TwoStageQuotas = { popular: 3, consensus: 2, anchor: 2, discovery: 1, quietFame: 0, quietPopular: 1 };

// 1. пул не больше суммы квот — все
assert.deepEqual([...selectRows(Array.from({ length: 8 }, (_, i) => ({ full: i })), Q)].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);

// 2. каждый источник берёт своё и только новое; открытия — лучшие по счёту среди тихих
// строки: 0–2 — самые оцениваемые; 3–4 — лучшие по оценке других; 5–6 — ближе к любимому; 7 — тихое с высоким счётом;
// 8 — громкое с высоким счётом (в открытия не идёт); 9–19 — шум
const rows: CandidateRow[] = Array.from({ length: 20 }, () => ({ popular: 0, consensus: null, anchor: null, fame: 0, full: 0.1 }));
[50, 40, 30].forEach((p, i) => { rows[i].popular = p; rows[i].consensus = 0.9; });   // 0–2 ещё и высоко у других: consensus возьмёт следующих
rows[3].consensus = 0.8; rows[4].consensus = 0.7; rows[10].consensus = 0.1;
rows[5].anchor = 0.9; rows[6].anchor = 0.6; rows[11].anchor = -0.5;
rows[7].full = 0.95;
rows[8] = { popular: 20, fame: 3, full: 0.99 };
rows[12].popular = 2;                                                            // не тихое по числу оценивших (> quietPopular)
rows[12].full = 0.97;
const keep = selectRows(rows, Q);
assert.deepEqual([...keep].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7], `отобрано ${[...keep]}`);
assert.equal(keep.size, Q.popular + Q.consensus + Q.anchor + Q.discovery);

// 3. порядок: отобранные по счёту, потом остальные по счёту
const order = twoStageOrder(rows, Q);
assert.equal(order.length, rows.length);
assert.equal(order[0], 7);                                   // в отборе лучший счёт — у открытия
assert.deepEqual(order.slice(8, 10), [8, 12]);               // громкое 8 (0.99) вне отбора — первое в хвосте
assert.deepEqual([...order].sort((a, b) => a - b), [...rows.keys()]);

// 4. числа оценивших нет ни у кого — «все смотрят» по уровню известности, равные — по счёту
const famed: CandidateRow[] = Array.from({ length: 12 }, (_, i) => ({ fame: i < 4 ? 2 : 0, full: i / 100 }));
const q4 = { ...Q, consensus: 0, anchor: 0, discovery: 0, popular: 2 };
assert.deepEqual([...selectRows(famed, q4)].sort((a, b) => a - b), [2, 3]);
// …и тихое при этом — без известности (число оценивших неизвестно — не мешает)
assert.deepEqual([...selectRows(famed, { ...q4, popular: 0, discovery: 2 })].sort((a, b) => a - b), [10, 11]);

// 5. NaN и null — «нет значения»: в источник не идут
const holes: CandidateRow[] = Array.from({ length: 10 }, (_, i) => ({ consensus: i === 4 ? 0.5 : i === 5 ? Number.NaN : null, full: 0 }));
assert.deepEqual([...selectRows(holes, { ...Q, popular: 0, anchor: 0, discovery: 0, consensus: 3 })], [4]);

// 6. форма ленты: числа берутся из опций recommend() (известность, consensus, якорь), twoStage — дополняет и меняет квоты
type W = { id: string };
const work = (id: string) => ({ id }) as unknown as import('../src/types/tmdf.ts').WorkCard;
const scored = Array.from({ length: 30 }, (_, i) => ({ c: { work: work(`w${i}`) }, score: i === 29 ? 0.9 : 0.5 - i / 100 }));
const idx = (w: W) => Number(w.id.slice(1));
const sel = twoStageSelect(scored, {
  fame: { level: (w) => (idx(w) < 5 ? 3 : undefined), mode: 'soft' },
  consensus: { of: (w) => (idx(w) === 20 ? 1 : undefined), weight: 0.3 },
  twoStage: { anchor: (w) => (idx(w) === 21 ? 1 : undefined), popular: (w) => (idx(w) === 22 ? 99 : 0), quotas: { popular: 1, consensus: 1, anchor: 1, discovery: 1 } },
});
assert.deepEqual([...sel].sort((a, b) => a - b), [20, 21, 22, 29]);

// 7. квоты по умолчанию — несколько сотен
const sum = TWO_STAGE.popular + TWO_STAGE.consensus + TWO_STAGE.anchor + TWO_STAGE.discovery;
assert.ok(sum >= 200 && sum <= 800, `сумма квот ${sum}`);
console.log(`candidates: ok (квоты по умолчанию ${JSON.stringify(TWO_STAGE)}, отбор ${sum})`);
