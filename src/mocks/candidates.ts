// Пул кандидатов для подбора на истории участника (22.09): тридцать фильмов, которых нет в
// его истории, размеченных первично тем же способом, что userAnnotations.ts (черновик
// модели, needs_review). Половина — рядом с его вкусом (триллеры, хорроры с идеей,
// головоломки), половина — шаг в сторону и вверх (артхаус, медленное, условное). Картинки,
// описания и «где посмотреть» — в candidateMedia.ts (генератор по TMDb). Своих ID нет:
// ключ — слаг, внешние ID подтягивает генератор.
import type { CognitiveOperation, WorkCard } from '@/types/tmdf';

export interface CandidateSeed {
  id: string;
  title: string;
  originalTitle: string;
  year: number;
  creators: string[];
  ops: [CognitiveOperation, number][];
  level: number;
  barriers: string[];
  warnings: string[];
  niche: boolean;
  what: string;
}

const c = (
  id: string, title: string, originalTitle: string, year: number, creators: string[], ops: [CognitiveOperation, number][],
  level: number, barriers: string[], warnings: string[], niche: boolean, what: string,
): CandidateSeed => ({ id, title, originalTitle, year, creators, ops, level, barriers, warnings, niche, what });

export const candidateSeeds: CandidateSeed[] = [
  c('c-coherence', 'Связь', 'Coherence', 2013, ['Джеймс Уорд Биркит'],
    [['pattern_recognition', 0.9], ['causal_reasoning', 0.8], ['metacognition', 0.5]], 6, ['Разговорная форма'], [], false,
    'Ужин на восьмерых и комета за окном: ветвящиеся реальности, которые придётся держать в голове самому.'),
  c('c-primer', 'Детонатор', 'Primer', 2004, ['Шейн Каррут'],
    [['causal_reasoning', 0.95], ['pattern_recognition', 0.9], ['abstraction', 0.7]], 9, ['Технический жаргон', 'Нелинейное время'], [], true,
    'Два инженера в гараже и машина времени без объяснений: фильм, который смотрят со схемой.'),
  c('c-handmaiden', 'Служанка', 'The Handmaiden', 2016, ['Пак Чхан-ук'],
    [['perspective_taking', 0.9], ['critical_analysis', 0.7], ['pattern_recognition', 0.6]], 6, [], ['Сексуальные сцены', 'Насилие'], false,
    'Одна афера в трёх частях с трёх точек зрения: каждая следующая отменяет предыдущую.'),
  c('c-burning', 'Пылающий', 'Burning', 2018, ['Ли Чхан-дон'],
    [['critical_analysis', 0.8], ['abstraction', 0.7], ['perspective_taking', 0.6]], 7, ['Медленный темп', 'Открытый финал'], [], false,
    'Триллер, который не подтверждает ни одной догадки: улики есть, разгадки нет — и это тема.'),
  c('c-enemy', 'Враг', 'Enemy', 2013, ['Дени Вильнёв'],
    [['abstraction', 0.9], ['metacognition', 0.7], ['pattern_recognition', 0.6]], 7, ['Размытая граница реальности'], ['Сексуальные сцены'], false,
    'Человек находит своего двойника: фильм-загадка, где ответ — не «кто», а «что это значит».'),
  c('c-invitation', 'Приглашение', 'The Invitation', 2015, ['Карин Кусама'],
    [['perspective_taking', 0.7], ['critical_analysis', 0.7]], 4, [], ['Насилие'], false,
    'Ужин у бывшей жены: паранойя героя против вежливости остальных — кто здесь неадекватен.'),
  c('c-spoorloos', 'Исчезновение', 'Spoorloos', 1988, ['Джордж Слёйзер'],
    [['causal_reasoning', 0.7], ['perspective_taking', 0.7], ['critical_analysis', 0.5]], 5, ['Медленный темп'], ['Насилие'], false,
    'Похититель показан с первой трети: саспенс не в том, кто, а в том, зачем — и до чего доведёт любопытство.'),
  c('c-memories', 'Воспоминания об убийстве', 'Salinui chueok', 2003, ['Пон Джун-хо'],
    [['critical_analysis', 0.7], ['perspective_taking', 0.6], ['causal_reasoning', 0.6]], 5, [], ['Насилие', 'Сексуальное насилие'], false,
    'Провинциальные следователи против первого серийного убийцы страны: расследование как портрет эпохи.'),
  c('c-wailing', 'Вопли', 'Gokseong', 2016, ['На Хон-джин'],
    [['critical_analysis', 0.8], ['pattern_recognition', 0.7], ['abstraction', 0.5]], 6, ['Хоррор-образы'], ['Насилие', 'Жестокость'], false,
    'Деревня, чужак и болезнь: фильм подсовывает три объяснения и проверяет, какому вы поверите.'),
  c('c-under-the-skin', 'Побудь в моей шкуре', 'Under the Skin', 2013, ['Джонатан Глейзер'],
    [['abstraction', 0.9], ['perspective_taking', 0.7], ['synthesis', 0.5]], 8, ['Без сюжета в привычном смысле', 'Медленный темп'], ['Сексуальные сцены'], true,
    'Взгляд нечеловека на людей: почти без слов, смысл собирается из повторов и пауз.'),
  c('c-anatomy', 'Анатомия падения', 'Anatomie d’une chute', 2023, ['Жюстин Трие'],
    [['critical_analysis', 0.9], ['perspective_taking', 0.7], ['causal_reasoning', 0.5]], 6, ['Разговорная форма', 'Открытый финал'], [], false,
    'Судебный процесс, где судят брак: каждая версия правдоподобна, и выбирать придётся зрителю.'),
  c('c-nightcrawler', 'Стрингер', 'Nightcrawler', 2014, ['Дэн Гилрой'],
    [['critical_analysis', 0.7], ['perspective_taking', 0.6]], 4, [], ['Насилие'], false,
    'Ночной оператор криминальной хроники: карьерная история, рассказанная языком мотивационных книг.'),
  c('c-lighthouse', 'Маяк', 'The Lighthouse', 2019, ['Роберт Эггерс'],
    [['abstraction', 0.8], ['metacognition', 0.6], ['pattern_recognition', 0.5]], 7, ['Условная актёрская манера', 'Архаичная речь'], ['Насилие', 'Сексуальные сцены'], true,
    'Двое на маяке и один язык XIX века: безумие как форма, а не как сюжетный поворот.'),
  c('c-blue-ruin', 'Катастрофа', 'Blue Ruin', 2013, ['Джереми Солнье'],
    [['causal_reasoning', 0.6], ['perspective_taking', 0.5]], 4, [], ['Насилие', 'Жестокость'], false,
    'Месть человека, который не умеет мстить: каждое действие порождает следующее, и никто не контролирует.'),
  c('c-timecrimes', 'Временная петля', 'Los cronocrímenes', 2007, ['Начо Вигалондо'],
    [['causal_reasoning', 0.9], ['pattern_recognition', 0.7]], 5, [], ['Насилие'], false,
    'Час назад в лесу: петля времени на одном участке, где каждую странность придётся объяснить самому.'),
  c('c-mulholland', 'Малхолланд Драйв', 'Mulholland Drive', 2001, ['Дэвид Линч'],
    [['synthesis', 0.9], ['pattern_recognition', 0.8], ['abstraction', 0.8]], 9, ['Размытая граница реальности', 'Без сюжета в привычном смысле'], ['Сексуальные сцены'], true,
    'Голливудская мечта, рассказанная дважды: части не складываются, пока не сменить вопрос.'),
  c('c-guilty', 'Виновный', 'Den skyldige', 2018, ['Густав Мёллер'],
    [['perspective_taking', 0.7], ['critical_analysis', 0.6], ['causal_reasoning', 0.5]], 4, ['Одна комната'], ['Насилие'], false,
    'Диспетчер, телефон и голос в трубке: всё преступление — в голове зрителя, и она ошибается.'),
  c('c-zodiac', 'Зодиак', 'Zodiac', 2007, ['Дэвид Финчер'],
    [['pattern_recognition', 0.7], ['critical_analysis', 0.7], ['causal_reasoning', 0.6]], 5, ['Медленный темп', 'Открытый финал'], ['Насилие'], false,
    'Расследование, которое не заканчивается: фильм о людях, которых съедает нерешённая задача.'),
  c('c-hereditary', 'Реинкарнация', 'Hereditary', 2018, ['Ари Астер'],
    [['pattern_recognition', 0.7], ['perspective_taking', 0.6], ['abstraction', 0.5]], 6, ['Хоррор-образы', 'Медленный темп'], ['Насилие', 'Жестокость'], false,
    'Семейное горе как заранее построенный механизм: знаки расставлены с первого кадра.'),
  c('c-perfect-blue', 'Идеальная грусть', 'Perfect Blue', 1997, ['Сатоси Кон'],
    [['metacognition', 0.8], ['critical_analysis', 0.7], ['pattern_recognition', 0.6]], 7, ['Размытая граница реальности'], ['Насилие', 'Сексуальное насилие'], true,
    'Поп-идол становится актрисой, и монтаж перестаёт отличать съёмку от жизни — вместе со зрителем.'),
  c('c-incendies', 'Пожары', 'Incendies', 2010, ['Дени Вильнёв'],
    [['causal_reasoning', 0.8], ['perspective_taking', 0.8], ['pattern_recognition', 0.6]], 6, [], ['Насилие', 'Сексуальное насилие'], false,
    'Два завещания и поездка на родину матери: две линии времени сходятся в одну арифметику.'),
  c('c-others', 'Другие', 'The Others', 2001, ['Алехандро Аменабар'],
    [['critical_analysis', 0.6], ['pattern_recognition', 0.6], ['perspective_taking', 0.5]], 4, [], [], false,
    'Дом с задёрнутыми шторами: классическая история с привидениями, которая честно играет по правилам.'),
  c('c-sleuth', 'Сыщик', 'Sleuth', 1972, ['Джозеф Лео Манкевич'],
    [['critical_analysis', 0.8], ['metacognition', 0.6]], 5, ['Театральная манера', 'Разговорная форма'], [], false,
    'Двое мужчин и дом, полный игр: детектив, который спорит с самим жанром детектива.'),
  c('c-calibre', 'Калибр', 'Calibre', 2018, ['Мэтт Палмер'],
    [['perspective_taking', 0.6], ['causal_reasoning', 0.6], ['critical_analysis', 0.5]], 4, [], ['Насилие'], false,
    'Охота в шотландской деревне и одна ошибка: фильм о том, как ложь растёт быстрее вины.'),
  c('c-sicario', 'Убийца', 'Sicario', 2015, ['Дени Вильнёв'],
    [['perspective_taking', 0.6], ['critical_analysis', 0.6]], 4, [], ['Насилие', 'Жестокость'], false,
    'Агент ФБР среди тех, кто не объясняет правил: зритель знает столько же, сколько героиня.'),
  c('c-barbarian', 'Варвар', 'Barbarian', 2022, ['Зак Креггер'],
    [['pattern_recognition', 0.6], ['critical_analysis', 0.6]], 4, ['Хоррор-образы'], ['Насилие', 'Сексуальное насилие'], false,
    'Дом на двоих по ошибке бронирования: хоррор, который трижды меняет, о чём он.'),
  c('c-kill-list', 'Список смертников', 'Kill List', 2011, ['Бен Уитли'],
    [['abstraction', 0.6], ['critical_analysis', 0.6], ['pattern_recognition', 0.5]], 6, ['Смена жанра', 'Открытый финал'], ['Насилие', 'Жестокость'], true,
    'Семейная драма, потом криминал, потом что-то третье: жанр — часть загадки.'),
  c('c-platform', 'Платформа', 'El hoyo', 2019, ['Гальдер Гастелу-Уррутия'],
    [['abstraction', 0.8], ['analogical_thinking', 0.7], ['critical_analysis', 0.6]], 5, ['Сатирическая условность'], ['Насилие', 'Жестокость', 'Физиологические сцены'], false,
    'Тюрьма-вертикаль с одним столом на всех: аллегория, которая не прячется, и это её сила.'),
  c('c-talk-to-me', 'Два, три, демон, приди!', 'Talk to Me', 2022, ['Дэнни Филиппу', 'Майкл Филиппу'],
    [['perspective_taking', 0.6], ['causal_reasoning', 0.5]], 4, ['Хоррор-образы'], ['Насилие', 'Самоповреждение'], false,
    'Одержимость как вечеринка: подростки играют с рукой мертвеца, и цена растёт на глазах.'),
  c('c-blow-up', 'Фотоувеличение', 'Blow-Up', 1966, ['Микеланджело Антониони'],
    [['critical_analysis', 0.8], ['metacognition', 0.8], ['abstraction', 0.7]], 8, ['Медленный темп', 'Открытый финал', 'Без сюжета в привычном смысле'], ['Сексуальные сцены'], true,
    'Фотограф, кажется, снял убийство: чем ближе увеличение, тем меньше видно — фильм о самом смотрении.'),
];

/** Карточка из зерна: ID нет, картинки нет — их подкладывает генератор через candidateMedia. */
export function seedToCard(s: CandidateSeed): WorkCard {
  return {
    id: s.id,
    type: 'film',
    title: s.title,
    originalTitle: s.originalTitle,
    year: s.year,
    creators: s.creators,
    primaryOperations: s.ops.map(([op, intensity]) => ({ op, intensity })),
    complexityLevel: s.level,
    warnings: s.warnings,
    barriers: s.barriers,
    isNicheMasterpiece: s.niche,
  };
}
