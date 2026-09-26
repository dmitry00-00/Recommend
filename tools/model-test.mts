// Прогон модели на истории участника без браузера: состояние и слейты по трём усилиям.
//   npx tsx tools/model-test.mts
import { userJournal } from '../src/mocks/userHistory.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { userRatings } from '../src/mocks/userRatings.ts';
import { candidateSeeds, seedToCard } from '../src/mocks/candidates.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { registerBase } from '../src/mocks/registerBase.ts';
import { deriveState } from '../src/lib/model/deriveState.ts';
import { recommend, scoreCandidate } from '../src/lib/model/recommend.ts';

const entries = userJournal.map((e) => {
  const a = userAnnotations[e.work.id];
  const work = a ? { ...e.work, primaryOperations: a.ops.map(([op, intensity]) => ({ op, intensity })), complexityLevel: a.level, isNicheMasterpiece: a.niche } : e.work;
  return { ...e, work, rating: userRatings[e.work.id]?.rating };
});
const reg = <T extends { id: string; registers?: string[] }>(w: T) => ({ ...w, registers: w.registers ?? workRegisters[w.id] });
const state = deriveState('u', entries.map((e) => ({ ...e, work: reg(e.work) })), '2026-09-22',
  { alsoSeen: watchedWorks.map(reg), base: registerBase })!;
console.log('comfort', state.complexityComfort, 'literacy', state.mediaLiteracy, state.overallConfidence);
for (const o of state.operations) console.log(' ', o.op.padEnd(22), o.level, o.range, o.confidence, o.trend);
const cands = candidateSeeds.map((s) => ({ work: reg(seedToCard(s)), what: s.what }));
for (const energy of ['low', 'normal', 'high'] as const) {
  console.log('\n==', energy);
  for (const r of recommend(state, cands, energy, 6)) {
    console.log(` ${r.slot.padEnd(9)} ${r.work.title} (${r.work.complexityLevel}) ${scoreCandidate(state, r.work, energy).toFixed(2)} → ${r.targetOperations.join(', ')}`);
    console.log(`   ${r.explanation.why}`);
  }
}
