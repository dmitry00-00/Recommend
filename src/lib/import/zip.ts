// Архив выгрузки (ЗП-25, 07.10): Letterboxd и Trakt отдают zip — читаем его прямо в браузере, без
// библиотеки: центральный каталог архива + `DecompressionStream('deflate-raw')` (Chrome 103+, Safari
// 16.4+ — те же движки, что у Telegram). Берём только текстовые файлы выгрузок; zip64 и шифрование не
// поддерживаем — у этих сервисов их нет.
const TEXT = /\.(?:csv|json|txt|md|html?)$/i;
const MAX = 50 << 20;   // распакованный файл больше 50 МБ — не выгрузка истории
/** Что в архиве не история. Letterboxd: deleted/ (удалённые записи дневника), orphaned/, lists/ (списки — не
 *  просмотры), profile.csv, comments.csv. Trakt: из JSON — только watched-*, ratings-*, watchlist-*,
 *  history-*; collection-* (что есть на полке), списки, подписки и прочее — мимо. */
const notHistory = (path: string, name: string): boolean =>
  /(?:^|\/)(?:deleted|orphaned|lists)\//i.test(path) || /^(?:profile|comments)\.csv$/i.test(name)
  || (/\.json$/i.test(name) && !/^(?:watched|ratings|watchlist|history)[-_.]/i.test(name));

export const isZip = (bytes: Uint8Array): boolean => bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Текстовые файлы архива: имя (без папок) и текст. Не архив или битый — пустой список. */
export async function unzipTexts(bytes: Uint8Array): Promise<{ name: string; text: string }[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // конец центрального каталога — сигнатура 0x06054b50 в последних 64 КБ
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return [];
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const out: { name: string; text: string }[] = [];
  const decoder = new TextDecoder('utf-8');
  for (let n = 0; n < count && at + 46 <= bytes.length; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) break;
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const plain = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const path = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    const name = path.split('/').pop() ?? path;
    if (!TEXT.test(name) || name.startsWith('.') || path.includes('__MACOSX') || notHistory(path, name) || plain > MAX) continue;
    if (view.getUint32(local, true) !== 0x04034b50) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    try {
      const data = method === 0 ? raw : method === 8 ? await inflate(raw) : undefined;
      if (data) out.push({ name, text: decoder.decode(data) });
    } catch { /* битый файл архива — пропускаем, остальные читаем */ }
  }
  return out;
}
