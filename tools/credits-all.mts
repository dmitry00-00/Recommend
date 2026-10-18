// Авторы целиком — для инструментов (15.10): people.ts / workCredits.ts (первая загрузка приложения) и peopleMore.ts /
// workCreditsMore.ts (авторы роста справочника, приложение грузит их лениво). Почерку, страницам авторов и справкам
// граница загрузки не важна.
import { people as base } from '../src/mocks/people.ts';
import { peopleMore } from '../src/mocks/peopleMore.ts';
import { workCredits as baseCredits } from '../src/mocks/workCredits.ts';
import { workCreditsMore } from '../src/mocks/workCreditsMore.ts';
import type { Person, PersonId } from '../src/types/tmdf.ts';
import { fixCreditRows } from '../src/lib/workFixesTable.ts';

export const people: Record<PersonId, Person> = { ...peopleMore, ...base };
// без людей, снятых правками справочника (волна Б, 17.10, src/mocks/workFixes.ts): почерк и справки о людях не должны
// опираться на ошибочно приписанного режиссёра или автора. Только чтение — сюда не пишут (resolve-credits пишет свои)
export const workCredits: Record<string, string> = fixCreditRows({ ...baseCredits, ...workCreditsMore });
