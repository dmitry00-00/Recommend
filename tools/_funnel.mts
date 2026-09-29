import { existsSync, readFileSync } from 'node:fs';
import { nameMatch } from './title-match.mts';
import { worksIndex } from './works-index.mts';

const RICH = /(?:почему|зачем|как устроен|на самом деле|объясня|теори|подтекст|что не так|о ч[её]м (?:на самом деле )?(?:фильм|кино|эт|говор)|разбира|смысл|устро[ей]н|метафор|символ)/i;
const NEWS = /(?:трейлер|тизер|премьер|стартовали съ[её]мки|начались съ[её]мки|объявил|анонсир|номинир|кассов|сборы|выйдет|выходит в прокат|дата выхода|в прокате с|уже в кино|расписани|сеанс|билет|розыгрыш|конкурс|скидк|подписк|промокод|реклама|erid)/i;

const ours = worksIndex();
const firstLine = (t: string) => t.replace(/https?:\/\/\S+/g, ' ').split('\n').map((l) => l.trim()).find(Boolean) ?? '';

const channels = process.argv.slice(2);
console.log('ВАРИАНТ Б: без требования «разговор о смысле», порог 300 знаков');
console.log('канал                постов  ≥120  не новость  сейчас  весь текст: один фильм  много');
for (const h of channels) {
  const f = `.cache/telegram/${h}.json`;
  if (!existsSync(f)) continue;
  const posts = JSON.parse(readFileSync(f, 'utf8')).posts as { text: string }[];
  let long = 0, pass = 0, nowHit = 0, one = 0, many = 0;
  for (const p of posts) {
    const text = p.text ?? '';
    if (text.length < 120) continue;
    long += 1;
    const rich = RICH.test(text);
    if (NEWS.test(text) && !(rich && text.length >= 700)) continue;
    if (!(text.length >= 300)) continue;
    pass += 1;
    const head = firstLine(text);
    if (ours.some(({ names }) => names.some((n) => nameMatch(head, n, { marked: true })))) nowHit += 1;
    const hits = new Set<string>();
    for (const { key, names } of ours) {
      if (names.some((n) => nameMatch(text, n, { marked: true }))) hits.add(key);
      if (hits.size > 1) break;
    }
    if (hits.size === 1) one += 1; else if (hits.size > 1) many += 1;
  }
  console.log(`${h.padEnd(20)}${String(posts.length).padStart(6)}${String(long).padStart(6)}${String(pass).padStart(12)}${String(nowHit).padStart(8)}${String(one).padStart(24)}${String(many).padStart(7)}`);
}
