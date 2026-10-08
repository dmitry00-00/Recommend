import { language } from '@/i18n';

/** Страны по-русски (ТВ-10, 06.10). TMDb отдаёт у фильма английские названия («United States of
 *  America»), у сериала — коды ISO («US»); Wikidata и Кинопоиск — уже по-русски. Код переводит
 *  сам браузер (`Intl.DisplayNames`), английское название — через код из таблицы; исторические
 *  страны, которых нет в ISO, — отдельно. Незнакомое оставляем как есть: лучше по-английски,
 *  чем пусто. */
const HISTORIC: Record<string, string> = {
  'Soviet Union': 'СССР', 'East Germany': 'ГДР', 'West Germany': 'ФРГ', Czechoslovakia: 'Чехословакия',
  Yugoslavia: 'Югославия', 'Serbia and Montenegro': 'Сербия и Черногория', 'Netherlands Antilles': 'Нидерландские Антилы',
  SU: 'СССР', XC: 'Чехословакия', YU: 'Югославия', XG: 'ГДР',
};
const ISO: Record<string, string> = {
  'United States of America': 'US', 'United States': 'US', Russia: 'RU', 'United Kingdom': 'GB', France: 'FR', Germany: 'DE',
  Italy: 'IT', Canada: 'CA', Japan: 'JP', China: 'CN', Belgium: 'BE', Australia: 'AU', Spain: 'ES', Switzerland: 'CH',
  Poland: 'PL', Ireland: 'IE', 'Hong Kong': 'HK', India: 'IN', 'New Zealand': 'NZ', Bulgaria: 'BG', Sweden: 'SE',
  Finland: 'FI', 'Czech Republic': 'CZ', Czechia: 'CZ', Denmark: 'DK', Netherlands: 'NL', Norway: 'NO', Austria: 'AT',
  Ukraine: 'UA', Mexico: 'MX', 'United Arab Emirates': 'AE', Luxembourg: 'LU', 'South Korea': 'KR', Latvia: 'LV',
  'South Africa': 'ZA', Brazil: 'BR', Greece: 'GR', Hungary: 'HU', Romania: 'RO', Serbia: 'RS', Belarus: 'BY',
  Kazakhstan: 'KZ', Turkey: 'TR', Chile: 'CL', Iceland: 'IS', Georgia: 'GE', Thailand: 'TH', Cuba: 'CU',
  Lithuania: 'LT', Cambodia: 'KH', Cyprus: 'CY', Singapore: 'SG', Guadaloupe: 'GP', Guadeloupe: 'GP', 'Saudi Arabia': 'SA',
  Taiwan: 'TW', Botswana: 'BW', Mongolia: 'MN', Jordan: 'JO', Tajikistan: 'TJ', Uzbekistan: 'UZ', Albania: 'AL',
  Armenia: 'AM', Algeria: 'DZ', Iran: 'IR', Venezuela: 'VE', 'Puerto Rico': 'PR', Argentina: 'AR', Portugal: 'PT',
  Peru: 'PE', Lebanon: 'LB', Israel: 'IL', Estonia: 'EE', Azerbaijan: 'AZ', Kyrgyzstan: 'KG', Moldova: 'MD',
  Slovakia: 'SK', Slovenia: 'SI', Croatia: 'HR', Egypt: 'EG', Morocco: 'MA', Tunisia: 'TN', Indonesia: 'ID',
  Philippines: 'PH', Malaysia: 'MY', Vietnam: 'VN', Colombia: 'CO', Uruguay: 'UY', 'North Korea': 'KP',
};
let names: Intl.DisplayNames | undefined;
const region = (code: string): string | undefined => {
  try {
    names ??= new Intl.DisplayNames(['ru'], { type: 'region' });
    const n = names.of(code);
    return n && n !== code ? n : undefined;
  } catch { return undefined; }
};
/** Самые длинные официальные названия — короче: «Соединённые Штаты» в строке шапки громоздко. */
const SHORT: Record<string, string> = {
  'Соединенные Штаты': 'США', 'Соединённые Штаты': 'США', 'Республика Корея': 'Южная Корея', 'КНДР': 'Северная Корея',
};

export function countryRu(name: string): string {
  const t = name.trim();
  if (/[а-яё]/i.test(t)) return t;
  if (HISTORIC[t]) return HISTORIC[t];
  const code = /^[A-Z]{2}$/.test(t) ? t : ISO[t];
  const ru = code ? region(code) : undefined;
  return ru ? SHORT[ru] ?? ru.replace(/\s*\(САР\)$/, '') : t;
}

// Страна на языке интерфейса — для показа (ЗП-20, 07.10). По-русски — `countryRu`; по-английски — из
// кода через `Intl.DisplayNames`, русское название (Кинопоиск, Wikidata) — обратно в код по той же таблице.
const HISTORIC_EN: Record<string, string> = {
  СССР: 'USSR', ГДР: 'East Germany', ФРГ: 'West Germany', Чехословакия: 'Czechoslovakia', Югославия: 'Yugoslavia',
  'Сербия и Черногория': 'Serbia and Montenegro', 'Нидерландские Антилы': 'Netherlands Antilles',
};
const SHORT_EN: Record<string, string> = { 'United States of America': 'USA', 'United States': 'USA', 'United Kingdom': 'UK' };
let enNames: Intl.DisplayNames | undefined;
let fromRu: Map<string, string> | undefined;
const regionEn = (code: string): string | undefined => {
  try {
    enNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    const n = enNames.of(code);
    return n && n !== code ? SHORT_EN[n] ?? n : undefined;
  } catch { return undefined; }
};
/** Русское название страны → код: по всем кодам таблицы и коротким формам («США», «Южная Корея»). */
const codeOfRu = (name: string): string | undefined => {
  if (!fromRu) {
    fromRu = new Map();
    for (const code of new Set(Object.values(ISO))) {
      const ru = region(code);
      if (ru) { fromRu.set(ru.toLowerCase(), code); if (SHORT[ru]) fromRu.set(SHORT[ru].toLowerCase(), code); }
    }
  }
  return fromRu.get(name.toLowerCase().replace(/ё/g, 'е')) ?? fromRu.get(name.toLowerCase());
};

export function countryName(name: string): string {
  if (language === 'ru') return countryRu(name);
  const t = name.trim();
  if (/[а-яё]/i.test(t)) {
    if (HISTORIC_EN[t]) return HISTORIC_EN[t];
    const code = codeOfRu(t);
    return (code && regionEn(code)) || t;
  }
  if (/^[A-Z]{2}$/.test(t)) return regionEn(t) ?? t;
  return SHORT_EN[t] ?? t;
}
