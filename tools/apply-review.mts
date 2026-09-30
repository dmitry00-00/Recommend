// Решения кураторской по черновой разметке → src/mocks/draftReview.ts (трек Г3).
//   npx tsx tools/apply-review.mts ~/Downloads/annotation-review-2026-09-30.json [ещё файлы…]
// Файл — кнопка «Скачать решения» в очереди кураторской. Решения копятся: новый файл
// дополняет прежние, по одному id побеждает более позднее решение. Отклонённый черновик
// приложение и tools/profile-deck.mts не используют — фильм считается неразмеченным.
import { readFileSync, writeFileSync } from 'node:fs';
import { draftReview, type ReviewMark } from '../src/mocks/draftReview.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { seriesAnnotations } from '../src/mocks/seriesAnnotations.ts';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!files.length) { console.error('нужен файл решений из кураторской (кнопка «Скачать решения»)'); process.exit(1); }

const merged: Record<string, ReviewMark> = { ...draftReview };
let added = 0;
let unknown = 0;
for (const f of files) {
  const { decisions } = JSON.parse(readFileSync(f, 'utf8')) as { decisions?: Record<string, ReviewMark> };
  for (const [id, m] of Object.entries(decisions ?? {})) {
    // сериал (Е2): `draft:imdb:<id>`, сезон антологии — `draft:imdb:<id>#s<N>`
    const [draftKey, season] = id.slice(6).split('#s');
    const series = seriesAnnotations[draftKey];
    const known = id.startsWith('draft:') ? Boolean(draftAnnotations[draftKey] || (series && (!season || series.seasons?.[Number(season)])))
      : id.startsWith('own:') ? Boolean(userAnnotations[id.slice(4)]) : false;
    if (!known) { unknown += 1; continue; }
    if (m.status !== 'approved' && m.status !== 'rejected') continue;
    if (!merged[id] || merged[id].at < m.at) { if (merged[id]?.status !== m.status) added += 1; merged[id] = { status: m.status, at: m.at }; }
  }
}
const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
const values = Object.values(sorted);
writeFileSync(new URL('../src/mocks/draftReview.ts', import.meta.url),
  `// Решения куратора по черновой разметке (трек Г3): id аннотации → утверждена / отклонена.
// Собирает tools/apply-review.mts из файла «Скачать решения» кураторской — так решения,
// принятые на одном устройстве, едут со сборкой ко всем. Не править руками.
// id: \`draft:tmdb:<id>\` — черновик фильма (draftAnnotations.ts), \`draft:imdb:<id>\` — сериала и
// \`draft:imdb:<id>#s<N>\` — сезона антологии (seriesAnnotations.ts), \`own:<id карточки>\` — первичная
// разметка истории владельца (userAnnotations.ts).

export interface ReviewMark { status: 'approved' | 'rejected'; at: string }

export const draftReview: Record<string, ReviewMark> = ${JSON.stringify(sorted, null, 1)};
`);
console.error(`решений: ${values.length} (утверждено ${values.filter((m) => m.status === 'approved').length}, отклонено ${values.filter((m) => m.status === 'rejected').length}); новых или изменённых ${added}${unknown ? `, не опознано ${unknown}` : ''}`);
console.error('→ src/mocks/draftReview.ts');
