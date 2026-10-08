// У каких каналов включены комментарии (ТВ-5б, 06.10) → src/mocks/telegramComments.ts.
//   npx tsx tools/telegram-comments.mts
//
// Кнопка «Обсуждение» у поста ведёт в ветку комментариев под ним — только если она есть.
// Признак — у канала, а не у поста: шлюз (tg-gateway, :8710) отдаёт у поста, забранного через
// MTProto, поле `replies` — число комментариев, а у канала без обсуждения там null. Посты из
// старого импорта (`source: import`) этого поля не несут — по ним канал не судим.
// Канал без единого MTProto-поста в выходе не появляется: не знаем — кнопку не показываем.
import { writeFileSync } from 'node:fs';

const GW = (process.env.TG_GATEWAY_URL ?? 'http://127.0.0.1:8710').replace(/\/+$/, '');
interface GwPost { channel: string; source?: string; replies?: number | null }

const seen = new Map<string, { mt: number; withComments: number }>();
let after = 0;
for (;;) {
  let r: Response;
  try { r = await fetch(`${GW}/posts?consumer=recomend&after=${after}&limit=2000`); } catch { console.error(`tg-gateway не отвечает (${GW})`); process.exit(2); }
  if (!r.ok) { console.error(`tg-gateway: HTTP ${r.status}`); process.exit(2); }
  const page = (await r.json()) as { posts: GwPost[]; cursor: number; more: boolean };
  for (const p of page.posts) {
    if (p.source !== 'mtproto') continue;
    const ch = p.channel.toLowerCase();
    const s = seen.get(ch) ?? { mt: 0, withComments: 0 };
    s.mt += 1;
    if (p.replies != null) s.withComments += 1;
    seen.set(ch, s);
  }
  if (!page.more || page.cursor === after) break;
  after = page.cursor;
}

const out = Object.fromEntries([...seen].sort(([a], [b]) => a.localeCompare(b)).map(([ch, s]) => [ch, s.withComments > 0]));
const yes = Object.values(out).filter(Boolean).length;
writeFileSync(new URL('../src/mocks/telegramComments.ts', import.meta.url), `// Сгенерировано tools/telegram-comments.mts (${new Date().toISOString().slice(0, 10)}) по постам tg-gateway.
// Канал (в нижнем регистре) → включены ли у него комментарии. Нет канала — неизвестно. Не править руками.
export const telegramComments: Record<string, boolean> = ${JSON.stringify(out, null, 1)};
`);
console.log(`комментарии: каналов ${seen.size}, с обсуждением ${yes}, без ${seen.size - yes}`);
