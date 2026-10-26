/** Справочник «лицо и пара слов» о людях (src/mocks/peopleInfo/<nn>.ts) — частями по номеру элемента Wikidata
 *  (25.10): странице человека нужна одна строка, а целиком он весил 486 КБ сжатым. Общее для генератора
 *  (tools/resolve-people-info.mts) и приложения. */
export const PEOPLE_SHARDS = 64;
export const peopleShard = (q: string): string => (Number(q.replace(/^Q/, '')) % PEOPLE_SHARDS).toString().padStart(2, '0');
