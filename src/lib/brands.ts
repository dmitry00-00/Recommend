/** Латинские марки в русских названиях (15.10, находки ТВ-12а): «Дьявол носит Prada» в просьбах пишут «Дьявол носит
 *  прада», и ни поиск, ни опознаватель её не находили. Общая транслитерация тут вредна («Wall-E», «G.I. Joe», «XXX»),
 *  поэтому — короткий словарь слов, которые по-русски пишут кириллицей; вариант названия только для них. */
const BRANDS: Record<string, string> = {
  prada: 'прада', gucci: 'гуччи', ford: 'форд', ferrari: 'феррари', uber: 'убер', kingsman: 'кингсман',
  minecraft: 'майнкрафт', marvel: 'марвел', blackberry: 'блэкберри', angry: 'энгри', birds: 'бёрдз',
  tomb: 'томб', raider: 'райдер', duxless: 'духлесс', russia: 'раша', vought: 'воут', abba: 'абба',
  playmobil: 'плеймобил', uglydolls: 'аглидоллс', shortbus: 'шортбас',
};

/** «Дьявол носит Prada» → «Дьявол носит прада»; без марок или без кириллицы — undefined. */
export function cyrillicBrands(title: string): string | undefined {
  // только смешанные русские названия: у английского оригинала вышло бы «The Devil Wears прада»
  if (!/[а-яё]/i.test(title)) return undefined;
  let hit = false;
  const out = title.replace(/[A-Za-z]+/g, (w) => {
    const ru = BRANDS[w.toLowerCase()];
    if (ru) hit = true;
    return ru ?? w;
  });
  return hit ? out : undefined;
}
