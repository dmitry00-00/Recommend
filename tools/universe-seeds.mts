// Список популярных вселенных (Ж3, 30.09) — заложен заранее, а не ждёт, пока связи Ж1 соберут их
// из нашего справочника по кусочкам. Для каждой — как найти её в Wikidata и где о ней есть
// данные: вики фандома (MediaWiki API — `<вики>/api.php`) и открытые API. Всё это проверяет
// tools/seed-universes.mts при прогоне: элемент Wikidata ищется по английской метке, вики и API
// пингуются — адреса здесь не догма, а подсказка.
//
// Правило источников (решение 23.09): без NC-оговорки. Вики Fandom — CC BY-SA (с атрибуцией,
// «share-alike» касается их текста, не наших данных); Wikidata — CC0. Marvel API закрыт (2025) —
// у Marvel только вики.

export interface UniverseSeed {
  id: string;
  ru: string;
  /** английская метка элемента Wikidata: франшиза, киносерия или цикл */
  en: string;
  /** вики фандома и независимые вики на MediaWiki */
  wiki?: string[];
  /** открытые API с данными вселенной: персонажи, места, книги — пригодятся трекам И (персонажи) */
  api?: { url: string; what: string; key?: boolean }[];
}

export const universeSeeds: UniverseSeed[] = [
  { id: 'star-wars', ru: 'Звёздные войны', en: 'Star Wars', wiki: ['https://starwars.fandom.com', 'https://starwars.fandom.com/ru'],
    api: [{ url: 'https://www.swapi.tech/api/', what: 'персонажи, планеты, корабли, фильмы' }] },
  { id: 'middle-earth', ru: 'Средиземье', en: 'Middle-earth', wiki: ['https://lotr.fandom.com', 'https://tolkiengateway.net', 'https://lotr.fandom.com/ru'],
    api: [{ url: 'https://the-one-api.dev/v2/', what: 'книги, фильмы, персонажи, цитаты', key: true }] },
  { id: 'wizarding-world', ru: 'Волшебный мир Гарри Поттера', en: 'Wizarding World', wiki: ['https://harrypotter.fandom.com', 'https://harrypotter.fandom.com/ru'],
    api: [{ url: 'https://hp-api.onrender.com/api/', what: 'персонажи, заклинания' }] },
  { id: 'a-song-of-ice-and-fire', ru: 'Песнь льда и огня', en: 'A Song of Ice and Fire', wiki: ['https://gameofthrones.fandom.com', 'https://awoiaf.westeros.org', 'https://gameofthrones.fandom.com/ru'],
    api: [{ url: 'https://anapioficeandfire.com/api/', what: 'книги, персонажи, дома' }] },
  { id: 'mcu', ru: 'Кинематографическая вселенная Marvel', en: 'Marvel Cinematic Universe', wiki: ['https://marvelcinematicuniverse.fandom.com', 'https://marvel.fandom.com'] },
  { id: 'dc', ru: 'Вселенная DC', en: 'DC Universe', wiki: ['https://dc.fandom.com', 'https://dcextendeduniverse.fandom.com'] },
  { id: 'dune', ru: 'Дюна', en: 'Dune', wiki: ['https://dune.fandom.com'] },
  { id: 'witcher', ru: 'Ведьмак', en: 'The Witcher', wiki: ['https://witcher.fandom.com', 'https://witcher.fandom.com/ru'] },
  { id: 'alien', ru: 'Чужой', en: 'Alien', wiki: ['https://avp.fandom.com'] },
  { id: 'terminator', ru: 'Терминатор', en: 'Terminator', wiki: ['https://terminator.fandom.com'] },
  { id: 'matrix', ru: 'Матрица', en: 'The Matrix', wiki: ['https://matrix.fandom.com'] },
  { id: 'blade-runner', ru: 'Бегущий по лезвию', en: 'Blade Runner', wiki: ['https://bladerunner.fandom.com'] },
  { id: 'star-trek', ru: 'Звёздный путь', en: 'Star Trek', wiki: ['https://memory-alpha.fandom.com', 'https://memory-alpha.fandom.com/ru'] },
  { id: 'james-bond', ru: 'Джеймс Бонд', en: 'James Bond', wiki: ['https://jamesbond.fandom.com'] },
  { id: 'mission-impossible', ru: 'Миссия невыполнима', en: 'Mission: Impossible', wiki: ['https://missionimpossible.fandom.com'] },
  { id: 'fast-and-furious', ru: 'Форсаж', en: 'Fast & Furious', wiki: ['https://fastandfurious.fandom.com'] },
  { id: 'pirates-of-the-caribbean', ru: 'Пираты Карибского моря', en: 'Pirates of the Caribbean', wiki: ['https://pirates.fandom.com'] },
  { id: 'jurassic-park', ru: 'Парк юрского периода', en: 'Jurassic Park', wiki: ['https://jurassicpark.fandom.com'] },
  { id: 'monsterverse', ru: 'Вселенная монстров', en: 'Monsterverse', wiki: ['https://godzilla.fandom.com'] },
  { id: 'planet-of-the-apes', ru: 'Планета обезьян', en: 'Planet of the Apes', wiki: ['https://planetoftheapes.fandom.com'] },
  { id: 'mad-max', ru: 'Безумный Макс', en: 'Mad Max', wiki: ['https://madmax.fandom.com'] },
  { id: 'john-wick', ru: 'Джон Уик', en: 'John Wick', wiki: ['https://johnwick.fandom.com'] },
  { id: 'hunger-games', ru: 'Голодные игры', en: 'The Hunger Games', wiki: ['https://thehungergames.fandom.com'] },
  { id: 'indiana-jones', ru: 'Индиана Джонс', en: 'Indiana Jones', wiki: ['https://indianajones.fandom.com'] },
  { id: 'back-to-the-future', ru: 'Назад в будущее', en: 'Back to the Future', wiki: ['https://backtothefuture.fandom.com'] },
  { id: 'men-in-black', ru: 'Люди в чёрном', en: 'Men in Black', wiki: ['https://meninblack.fandom.com'] },
  { id: 'resident-evil', ru: 'Обитель зла', en: 'Resident Evil', wiki: ['https://residentevil.fandom.com'] },
  { id: 'silent-hill', ru: 'Сайлент Хилл', en: 'Silent Hill', wiki: ['https://silenthill.fandom.com'] },
  { id: 'fallout', ru: 'Fallout', en: 'Fallout', wiki: ['https://fallout.fandom.com', 'https://fallout.fandom.com/ru'] },
  { id: 'the-last-of-us', ru: 'Одни из нас', en: 'The Last of Us', wiki: ['https://thelastofus.fandom.com'] },
  { id: 'metro-2033', ru: 'Метро 2033', en: 'Metro 2033', wiki: ['https://metro.fandom.com', 'https://metro.fandom.com/ru'] },
  { id: 'stalker', ru: 'Сталкер и «Пикник на обочине»', en: 'S.T.A.L.K.E.R.', wiki: ['https://stalker.fandom.com', 'https://stalker.fandom.com/ru'] },
  { id: 'sherlock-holmes', ru: 'Шерлок Холмс', en: 'Sherlock Holmes', wiki: ['https://bakerstreet.fandom.com'] },
  { id: 'rick-and-morty', ru: 'Рик и Морти', en: 'Rick and Morty', wiki: ['https://rickandmorty.fandom.com'],
    api: [{ url: 'https://rickandmortyapi.com/api/', what: 'персонажи, места, эпизоды' }] },
  { id: 'pokemon', ru: 'Покемоны', en: 'Pokémon', wiki: ['https://bulbapedia.bulbagarden.net/w', 'https://pokemon.fandom.com'],
    api: [{ url: 'https://pokeapi.co/api/v2/', what: 'покемоны, виды, регионы' }] },
  { id: 'the-boys', ru: 'Пацаны', en: 'The Boys', wiki: ['https://the-boys.fandom.com'] },
  { id: 'twin-peaks', ru: 'Твин Пикс', en: 'Twin Peaks', wiki: ['https://twinpeaks.fandom.com'] },
  { id: 'fargo', ru: 'Фарго', en: 'Fargo', wiki: ['https://fargo.fandom.com'] },
  { id: 'breaking-bad', ru: 'Во все тяжкие', en: 'Breaking Bad', wiki: ['https://breakingbad.fandom.com'] },
];
