/** Цены подписок онлайн-кинотеатров (15.10) для «Какая подписка подходит»: самый дешёвый месячный тариф с доступом к
 *  каталогу (не аренда, не покупка), полная цена без акции первого месяца. В TMDb цен нет — таблица ведётся вручную,
 *  с датой проверки и страницей тарифа; перепроверять раз в месяц. Ключ — `cinemaSlug`. Нет цены — экран пишет
 *  покрытие без стоимости. */
/** confidence: high — видели страницу тарифа самого кинотеатра; medium — новости и витрины партнёров (своя страница
 *  цену не отдала: грузит её скриптом) */
export interface CinemaPrice { price: number; plan: string; bundle?: string; source: string; checked: string; confidence: 'high' | 'medium' }

export const CINEMA_PRICES: Record<string, Record<string, CinemaPrice>> = {
  RU: {
    kinopoisk: { price: 449, plan: 'Яндекс Плюс', bundle: 'Кинопоиск, Музыка, Книги; семья до 4 человек', source: 'https://plus.yandex.ru/', checked: '2026-10-15', confidence: 'high' },
    okko: { price: 399, plan: 'СберПрайм', bundle: 'Okko, Звук, Самокат и др.', source: 'https://www.vbr.ru/novosti/banki/2026/01/14/podpiski-sbera-i-gazprombank-podorozhali/', checked: '2026-10-15', confidence: 'medium' },
    ivi: { price: 399, plan: 'Иви, 1 месяц', source: 'https://www.ivi.ru/subscribe', checked: '2026-10-15', confidence: 'high' },
    wink: { price: 429, plan: 'Wink «Всё в одном»', bundle: 'кино, ТВ-каналы, спорт', source: 'https://wink.ru/services', checked: '2026-10-15', confidence: 'high' },
    // more.tv с 2026 года перенаправляет на Wink: каталог — там, подписка — Wink
    moretv: { price: 429, plan: 'через Wink', bundle: 'more.tv открывается в Wink', source: 'https://wink.ru/services', checked: '2026-10-15', confidence: 'high' },
    start: { price: 499, plan: 'START, 1 месяц', source: 'https://start.ru/legal/subscription_price', checked: '2026-10-15', confidence: 'high' },
    premier: { price: 399, plan: 'PREMIER × RUTUBE × Газпром Бонус', bundle: 'RUTUBE без рекламы', source: 'https://premier.one/subscriptions', checked: '2026-10-15', confidence: 'high' },
    amediateka: { price: 599, plan: 'Амедиатека, 1 месяц', source: 'https://www.ivi.ru/subscribe', checked: '2026-10-15', confidence: 'medium' },
    kion: { price: 349, plan: 'МТС Premium', bundle: 'KION, музыка, книги; семья до 3 человек', source: 'https://www.vbr.ru/novosti/banki/2026/07/30/podpiska-mts-premium-s-1-avgysta-2026/', checked: '2026-10-15', confidence: 'medium' },
  },
};

export const CURRENCY: Record<string, string> = { RU: '₽', US: '$', GB: '£', IN: '₹' };
