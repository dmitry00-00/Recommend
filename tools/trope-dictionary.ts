// Словарь приёмов: что из TV Tropes вообще стоит показывать в карточке — и как это
// называется по-русски. Составлен руками, и это осознанное решение.
//
// Замер 23.09 показал, что отбирать приёмы по частоте или по редкости бессмысленно: в голове
// списка у фильмов стоит производственная и прокатная мелочь («Oscar Bait», «Career
// Resurrection», «Director's Cut», «Tom Hanks Syndrome»), а приёмы повествования тонут.
// Никакая сортировка это не чинит — так устроены сами страницы вики. Поэтому не стоп-лист,
// а белый список: мы решаем, что считается приёмом, о котором стоит сказать зрителю,
// а TV Tropes отвечает, есть ли он в фильме.
//
// Тексты здесь свои. Описания с TV Tropes (CC BY-NC-SA) не копируются: ShareAlike потянул бы
// то же условие на нашу разметку. Наружу из датасета идут только идентификатор, английское
// имя приёма и ссылка на его страницу.
import type { SpoilerLevel } from '../src/types/tmdf.ts';

export interface TropeEntry {
  /** имя приёма в датасете и в адресе вики */
  slug: string;
  /** как называем по-русски */
  name: string;
  /** одна фраза своими словами: что это за приём вообще, не про конкретный фильм */
  explanation: string;
  /** 0 — знать не вредно, 1 — намекает на устройство, 2 — портит развязку */
  spoilerLevel: SpoilerLevel;
}

export const tropeDictionary: TropeEntry[] = [
  // финал и развязка
  { slug: 'AmbiguousEnding', name: 'Открытый финал', explanation: 'Чем всё кончилось, фильм не сообщает: ответ остаётся за зрителем.', spoilerLevel: 2 },
  { slug: 'BolivianArmyEnding', name: 'Обрыв на последнем кадре', explanation: 'Развязка обрывается за миг до исхода — он очевиден, но не показан.', spoilerLevel: 2 },
  { slug: 'TwistEnding', name: 'Поворот в финале', explanation: 'В конце выясняется то, что переворачивает всё предыдущее.', spoilerLevel: 2 },
  { slug: 'GainaxEnding', name: 'Финал без объяснений', explanation: 'Концовка уходит в образ и логике происходящего не подчиняется.', spoilerLevel: 2 },
  { slug: 'NoEnding', name: 'Без развязки', explanation: 'История прекращается, а не завершается.', spoilerLevel: 2 },
  { slug: 'LeftHanging', name: 'Оборванная линия', explanation: 'Заявленную линию не доводят до конца.', spoilerLevel: 1 },
  { slug: 'DownerEnding', name: 'Мрачный финал', explanation: 'Кончается плохо, и утешения не предлагается.', spoilerLevel: 2 },
  { slug: 'BittersweetEnding', name: 'Горько-сладкий финал', explanation: 'Цель достигнута ценой, которая её не окупает.', spoilerLevel: 2 },
  { slug: 'EarnYourHappyEnding', name: 'Счастье оплачено', explanation: 'Хороший исход достаётся через тяжёлую дорогу.', spoilerLevel: 2 },
  { slug: 'YankTheDogsChain', name: 'Надежду отнимают', explanation: 'Просвет дают затем, чтобы его отобрать.', spoilerLevel: 2 },
  { slug: 'TheReveal', name: 'Раскрытие', explanation: 'Момент, когда зрителю сообщают то, что меняет всю картину.', spoilerLevel: 2 },
  { slug: 'DeadAllAlong', name: 'Он был мёртв', explanation: 'Выясняется, что персонаж всё это время был мёртв.', spoilerLevel: 2 },
  { slug: 'TomatoSurprise', name: 'Зритель узнаёт последним', explanation: 'Герои знали то, что от зрителя скрывали.', spoilerLevel: 2 },
  { slug: 'WhamLine', name: 'Фраза-удар', explanation: 'Одна реплика переворачивает сцену.', spoilerLevel: 2 },
  { slug: 'WhamShot', name: 'Кадр-удар', explanation: 'Один кадр переворачивает сцену.', spoilerLevel: 2 },

  // непрозрачность и ненадёжность
  { slug: 'AmbiguousSituation', name: 'Неразрешённая двусмысленность', explanation: 'Что именно произошло, остаётся спорным — по замыслу.', spoilerLevel: 1 },
  { slug: 'MaybeMagicMaybeMundane', name: 'Чудо или совпадение', explanation: 'У сверхъестественного всегда есть бытовое объяснение, и выбор не сделан.', spoilerLevel: 1 },
  { slug: 'MindScrew', name: 'Ломает голову', explanation: 'Устройство фильма намеренно сопротивляется связной расшифровке.', spoilerLevel: 0 },
  { slug: 'MindScrewdriver', name: 'Ключ к разгадке', explanation: 'В какой-то момент даётся ключ, после которого путаница собирается в систему.', spoilerLevel: 2 },
  { slug: 'ThroughTheEyesOfMadness', name: 'Глазами помрачения', explanation: 'Мы видим происходящее так, как его видит помутившееся сознание.', spoilerLevel: 1 },
  { slug: 'UnreliableNarrator', name: 'Ненадёжный рассказчик', explanation: 'Тот, кто ведёт рассказ, искажает его — по незнанию или намеренно.', spoilerLevel: 1 },
  { slug: 'UnreliableExpositor', name: 'Ненадёжный свидетель', explanation: 'Персонаж, объясняющий происходящее, ошибается или лжёт.', spoilerLevel: 1 },
  { slug: 'FirstPersonPeripheralNarrator', name: 'Рассказчик со стороны', explanation: 'Историю ведёт не главный герой, а свидетель.', spoilerLevel: 0 },
  { slug: 'NarratorAllAlong', name: 'Рассказчик оказался героем', explanation: 'Голос за кадром принадлежит тому, о ком идёт речь.', spoilerLevel: 2 },
  { slug: 'RedHerring', name: 'Ложный след', explanation: 'Внимание намеренно уводят не туда.', spoilerLevel: 1 },
  { slug: 'DecoyProtagonist', name: 'Ложный герой', explanation: 'Тот, кого приняли за главного, им не оказывается.', spoilerLevel: 2 },

  // как собрано время и рассказ
  { slug: 'AnachronicOrder', name: 'Порядок сбит', explanation: 'События показаны не в том порядке, в каком произошли.', spoilerLevel: 0 },
  { slug: 'InMediasRes', name: 'С середины', explanation: 'Фильм начинается посреди событий, начало достраивается позже.', spoilerLevel: 0 },
  { slug: 'HowWeGotHere', name: 'Как мы сюда попали', explanation: 'Первая сцена — из будущего, остальное объясняет, как к ней пришли.', spoilerLevel: 1 },
  { slug: 'FramingDevice', name: 'Рамка', explanation: 'Основная история вставлена в другую: рассказ, допрос, воспоминание.', spoilerLevel: 0 },
  { slug: 'StoryWithinAStory', name: 'История внутри истории', explanation: 'Внутри фильма рассказывается ещё одна история.', spoilerLevel: 0 },
  { slug: 'NestedStoryReveal', name: 'Рамка оказалась не рамкой', explanation: 'Выясняется, что внешняя история сама была частью внутренней.', spoilerLevel: 2 },
  { slug: 'RashomonStyle', name: 'По-разному об одном', explanation: 'Одно событие показано несколькими несовместимыми версиями.', spoilerLevel: 0 },
  { slug: 'JigsawPuzzlePlot', name: 'Сюжет-головоломка', explanation: 'Картина складывается из разрозненных кусков, и собирать её должен зритель.', spoilerLevel: 0 },
  { slug: 'HalfwayPlotSwitch', name: 'Разворот на середине', explanation: 'К середине фильм становится другим фильмом.', spoilerLevel: 1 },
  { slug: 'GenreShift', name: 'Смена жанра', explanation: 'По ходу дела фильм меняет жанр.', spoilerLevel: 1 },
  { slug: 'BaitAndSwitch', name: 'Подмена ожидания', explanation: 'Сцена ведёт к одному, а оборачивается другим.', spoilerLevel: 0 },
  { slug: 'DreamSequence', name: 'Сон', explanation: 'Отдельный эпизод происходит во сне.', spoilerLevel: 1 },
  { slug: 'DreamWithinADream', name: 'Сон во сне', explanation: 'Пробуждение оказывается ещё одним сном.', spoilerLevel: 2 },
  { slug: 'AllJustADream', name: 'Всё оказалось сном', explanation: 'Происходившее объявляется сном.', spoilerLevel: 2 },

  // что расставлено заранее
  { slug: 'Foreshadowing', name: 'Предвестие', explanation: 'Ранние детали заранее указывают на то, что случится.', spoilerLevel: 1 },
  { slug: 'ChekhovsGun', name: 'Ружьё на стене', explanation: 'Показанная мелочь позже оказывается нужной.', spoilerLevel: 1 },
  { slug: 'ChekhovsGunman', name: 'Проходной персонаж возвращается', explanation: 'Фигура из ранней сцены оказывается важной.', spoilerLevel: 2 },
  { slug: 'ChekhovsSkill', name: 'Умение пригодится', explanation: 'Навык, показанный мимоходом, решает дело в финале.', spoilerLevel: 1 },
  { slug: 'ChekhovsBoomerang', name: 'Ружьё стреляет дважды', explanation: 'Одна и та же деталь срабатывает несколько раз.', spoilerLevel: 1 },
  { slug: 'Bookends', name: 'Кольцо', explanation: 'Финал повторяет начало.', spoilerLevel: 1 },
  { slug: 'ArcWords', name: 'Сквозная фраза', explanation: 'Одна фраза возвращается через весь фильм, меняя смысл.', spoilerLevel: 0 },
  { slug: 'ArcSymbol', name: 'Сквозной знак', explanation: 'Один предмет или образ проходит через весь фильм.', spoilerLevel: 0 },
  { slug: 'RecurringElement', name: 'Повторяющийся мотив', explanation: 'Один и тот же элемент возвращается из сцены в сцену.', spoilerLevel: 0 },
  { slug: 'Leitmotif', name: 'Лейтмотив', explanation: 'У героя или темы есть своя музыкальная фраза.', spoilerLevel: 0 },
  { slug: 'TitleDrop', name: 'Название вслух', explanation: 'Название фильма произносится в реплике.', spoilerLevel: 0 },

  // как это снято
  { slug: 'LongTake', name: 'Длинный план', explanation: 'Сцена снята одним долгим движением без склеек.', spoilerLevel: 0 },
  { slug: 'Oner', name: 'Эпизод одним кадром', explanation: 'Целый эпизод снят без единой склейки.', spoilerLevel: 0 },
  { slug: 'LeaveTheCameraRunning', name: 'Камера не выключается', explanation: 'План длится заметно дольше, чем нужно для действия.', spoilerLevel: 0 },
  { slug: 'MatchCut', name: 'Склейка по форме', explanation: 'Два кадра сшиты совпадением очертаний или движения.', spoilerLevel: 0 },
  { slug: 'SmashCut', name: 'Резкая склейка', explanation: 'Сцена обрывается ударом монтажа.', spoilerLevel: 0 },
  { slug: 'JumpCut', name: 'Скачок', explanation: 'Склейка внутри одного плана: время дёргается.', spoilerLevel: 0 },
  { slug: 'SplitScreen', name: 'Разделённый экран', explanation: 'Экран поделён между несколькими изображениями.', spoilerLevel: 0 },
  { slug: 'BulletTime', name: 'Время почти стоит', explanation: 'Действие замедлено до предела, а камера продолжает двигаться.', spoilerLevel: 0 },
  { slug: 'DeliberatelyMonochrome', name: 'Намеренно без цвета', explanation: 'Чёрно-белое изображение выбрано как приём, а не по эпохе.', spoilerLevel: 0 },
  { slug: 'ColourWash', name: 'Единый цветовой фильтр', explanation: 'Всё изображение подчинено одному оттенку.', spoilerLevel: 0 },
  { slug: 'SceneryPorn', name: 'Красота ради красоты', explanation: 'Изображение любуется собой дольше, чем требует сюжет.', spoilerLevel: 0 },
  { slug: 'SceneryGorn', name: 'Красота разрушения', explanation: 'Камера подробно рассматривает разруху.', spoilerLevel: 0 },
  { slug: 'SilentFilm', name: 'Немое кино', explanation: 'Фильм обходится без звучащей речи.', spoilerLevel: 0 },
  { slug: 'SilentMovie', name: 'Немое кино', explanation: 'Фильм обходится без звучащей речи.', spoilerLevel: 0 },

  // из чего сделан мир и разговор
  { slug: 'Minimalism', name: 'Минимализм', explanation: 'Обстановка и средства намеренно сведены к минимуму.', spoilerLevel: 0 },
  { slug: 'MinimalistCast', name: 'Мало действующих лиц', explanation: 'Персонажей считанные единицы.', spoilerLevel: 0 },
  { slug: 'GeniusLoci', name: 'Место как персонаж', explanation: 'Место действия ведёт себя как живое.', spoilerLevel: 1 },
  { slug: 'SpeechCentricWork', name: 'Держится на разговоре', explanation: 'Действие почти целиком состоит из речи.', spoilerLevel: 0 },
  { slug: 'SeinfeldianConversation', name: 'Разговор ни о чём', explanation: 'Герои подолгу говорят о пустяках.', spoilerLevel: 0 },
  { slug: 'TheReasonYouSuckSpeech', name: 'Речь-приговор', explanation: 'Персонаж разносит другого длинной обвинительной репликой.', spoilerLevel: 1 },
  { slug: 'PurpleProse', name: 'Избыточный слог', explanation: 'Язык намеренно перегружен.', spoilerLevel: 0 },
  { slug: 'BreakingTheFourthWall', name: 'Обращение к зрителю', explanation: 'Фильм признаёт, что его смотрят.', spoilerLevel: 0 },
  { slug: 'NoFourthWall', name: 'Четвёртой стены нет', explanation: 'Обращение к зрителю здесь — норма.', spoilerLevel: 0 },
  { slug: 'MediumAwareness', name: 'Герои знают, что они в фильме', explanation: 'Персонажи замечают, что находятся внутри произведения.', spoilerLevel: 0 },
  { slug: 'SlidingScaleOfRealisticVersusFantastic', name: 'Мера условности', explanation: 'Насколько мир фильма подчиняется законам нашего.', spoilerLevel: 0 },
  { slug: 'NonIndicativeName', name: 'Название обманывает', explanation: 'Название говорит не о том, что в фильме.', spoilerLevel: 0 },
  { slug: 'UntranslatedTitle', name: 'Название не переведено', explanation: 'Название оставлено на чужом языке.', spoilerLevel: 0 },
];
