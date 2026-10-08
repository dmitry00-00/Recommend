// Доля большого справочника по id (07.10): описания карточек лежат 16 файлами (src/mocks/baseBlurbs/NN.ts), и «Сюжет»
// подгружает один — около 60 КБ, а не 0,9 МБ. Функция общая для генератора (tools/build-base-media.mts) и приложения.
export const BLURB_SHARDS = 16;
export function shardOf(id: string, n = BLURB_SHARDS): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(h % n).padStart(2, '0');
}
