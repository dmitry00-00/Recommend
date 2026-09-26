// Сгенерировано tools/build-tag-neighbours.mts (2026-09-23): кому
// зрители MovieLens приписывают те же теги. Близость — косинус в пространстве 1084 тегов
// Tag Genome 2021 после приведения тегов к общему масштабу; в списке до 5 соседей
// с близостью не ниже 0.25.
// Источник: Tag Genome 2021, GroupLens — Kotkov, Maslov, Neovius (SIGIR 2021) и
// Vig, Sen, Riedl (TiiS 2012), лицензия CC BY-NC 3.0. Некоммерческое использование.
// Не править руками — перегенерировать.
import type { TagNeighbour } from '@/types/tmdf';

export const tagNeighbours: Record<string, TagNeighbour[]> = {
 "tmdb:10098": [
  {
   "key": "tmdb:962",
   "workId": "f-tmdb962",
   "title": "Золотая лихорадка",
   "year": 1925,
   "similarity": 0.48
  },
  {
   "key": "tmdb:3082",
   "workId": "f-tmdb3082",
   "title": "Новые времена",
   "year": 1936,
   "similarity": 0.45
  },
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.384
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.37
  },
  {
   "key": "tmdb:284",
   "workId": "f-tmdb284",
   "title": "Квартира",
   "year": 1960,
   "similarity": 0.353
  }
 ],
 "tmdb:1018": [
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.55
  },
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.475
  },
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.426
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.419
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.417
  }
 ],
 "tmdb:10212": [
  {
   "key": "tmdb:26517",
   "workId": "f-tmdb26517",
   "title": "Мартин",
   "year": 1978,
   "similarity": 0.596
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.579
  },
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.519
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.453
  },
  {
   "key": "tmdb:10331",
   "workId": "f-tmdb10331",
   "title": "Ночь живых мертвецов",
   "year": 1968,
   "similarity": 0.419
  }
 ],
 "tmdb:10218": [
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.363
  },
  {
   "key": "tmdb:161",
   "workId": "f-tmdb161",
   "title": "Одиннадцать друзей Оушена",
   "year": 2001,
   "similarity": 0.344
  },
  {
   "key": "tmdb:8052",
   "workId": "f-tmdb8052",
   "title": "Роковая восьмерка",
   "year": 1997,
   "similarity": 0.314
  },
  {
   "key": "tmdb:9571",
   "workId": "f-tmdb9571",
   "title": "Под кайфом и в смятении",
   "year": 1993,
   "similarity": 0.267
  },
  {
   "key": "tmdb:2255",
   "workId": "f-tmdb2255",
   "title": "В погоне за Эми",
   "year": 1997,
   "similarity": 0.259
  }
 ],
 "tmdb:10226": [
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.531
  },
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.515
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.514
  },
  {
   "key": "tmdb:82507",
   "workId": "l-tmdb82507",
   "title": "Синистер",
   "year": 2012,
   "similarity": 0.514
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.51
  }
 ],
 "tmdb:10227": [
  {
   "key": "tmdb:427",
   "workId": "f-tmdb427",
   "title": "Мой дядюшка",
   "year": 1958,
   "similarity": 0.514
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.442
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.438
  },
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.427
  },
  {
   "key": "tmdb:7857",
   "workId": "f-tmdb7857",
   "title": "Амаркорд",
   "year": 1973,
   "similarity": 0.423
  }
 ],
 "tmdb:103": [
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.519
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.511
  },
  {
   "key": "tmdb:274",
   "workId": "u-kp345",
   "title": "Молчание ягнят",
   "year": 1990,
   "similarity": 0.478
  },
  {
   "key": "tmdb:694",
   "workId": "f-tmdb694",
   "title": "Сияние",
   "year": 1980,
   "similarity": 0.463
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.451
  }
 ],
 "tmdb:10322": [
  {
   "key": "tmdb:25468",
   "workId": "f-tmdb25468",
   "title": "Мой ужин с Андре",
   "year": 1981,
   "similarity": 0.275
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.272
  }
 ],
 "tmdb:10331": [
  {
   "key": "tmdb:923",
   "workId": "f-tmdb923",
   "title": "Рассвет мертвецов",
   "year": 1978,
   "similarity": 0.803
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.599
  },
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.523
  },
  {
   "key": "tmdb:17814",
   "workId": "f-tmdb17814",
   "title": "Нападение на 13-й участок",
   "year": 1976,
   "similarity": 0.489
  },
  {
   "key": "tmdb:948",
   "workId": "f-tmdb948",
   "title": "Хэллоуин",
   "year": 1978,
   "similarity": 0.45
  }
 ],
 "tmdb:103328": [
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.531
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.529
  },
  {
   "key": "tmdb:9081",
   "workId": "f-tmdb9081",
   "title": "Пробуждение жизни",
   "year": 2001,
   "similarity": 0.527
  },
  {
   "key": "tmdb:8066",
   "workId": "l-tmdb8066",
   "title": "Останься",
   "year": 2005,
   "similarity": 0.497
  },
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.452
  }
 ],
 "tmdb:104": [
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.463
  },
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.404
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.389
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.387
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.374
  }
 ],
 "tmdb:10403": [
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.407
  },
  {
   "key": "tmdb:2757",
   "workId": "f-tmdb2757",
   "title": "Адаптация",
   "year": 2002,
   "similarity": 0.365
  },
  {
   "key": "tmdb:1018",
   "workId": "c-mulholland",
   "title": "Малхолланд Драйв",
   "year": 2001,
   "similarity": 0.338
  },
  {
   "key": "tmdb:11644",
   "workId": "f-tmdb11644",
   "title": "Прокол",
   "year": 1981,
   "similarity": 0.333
  },
  {
   "key": "tmdb:4995",
   "workId": "f-tmdb4995",
   "title": "Ночи в стиле буги",
   "year": 1997,
   "similarity": 0.3
  }
 ],
 "tmdb:10404": [
  {
   "key": "tmdb:843",
   "workId": "f-tmdb843",
   "title": "Любовное настроение",
   "year": 2000,
   "similarity": 0.37
  },
  {
   "key": "tmdb:10997",
   "workId": "f-tmdb10997",
   "title": "Прощай, моя наложница",
   "year": 1993,
   "similarity": 0.336
  },
  {
   "key": "tmdb:16642",
   "workId": "f-tmdb16642",
   "title": "Дни жатвы",
   "year": 1978,
   "similarity": 0.334
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.324
  },
  {
   "key": "tmdb:10436",
   "workId": "f-tmdb10436",
   "title": "Эпоха невинности",
   "year": 1993,
   "similarity": 0.289
  }
 ],
 "tmdb:10436": [
  {
   "key": "tmdb:37080",
   "workId": "f-tmdb37080",
   "title": "Мать и дитя",
   "year": 2009,
   "similarity": 0.425
  },
  {
   "key": "tmdb:8619",
   "workId": "f-tmdb8619",
   "title": "Хозяин морей: На краю Земли",
   "year": 2003,
   "similarity": 0.4
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.39
  },
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.381
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.381
  }
 ],
 "tmdb:10494": [
  {
   "key": "tmdb:3509",
   "workId": "f-tmdb3509",
   "title": "Помутнение",
   "year": 2006,
   "similarity": 0.44
  },
  {
   "key": "tmdb:64720",
   "workId": "f-tmdb64720",
   "title": "Укрытие",
   "year": 2011,
   "similarity": 0.407
  },
  {
   "key": "tmdb:4689",
   "workId": "f-tmdb4689",
   "title": "Сочувствие господину Месть",
   "year": 2002,
   "similarity": 0.391
  },
  {
   "key": "tmdb:1018",
   "workId": "c-mulholland",
   "title": "Малхолланд Драйв",
   "year": 2001,
   "similarity": 0.379
  },
  {
   "key": "tmdb:8740",
   "workId": "c-spoorloos",
   "title": "Исчезновение",
   "year": 1988,
   "similarity": 0.375
  }
 ],
 "tmdb:105": [
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.528
  },
  {
   "key": "tmdb:620",
   "workId": "f-tmdb620",
   "title": "Охотники за привидениями",
   "year": 1984,
   "similarity": 0.523
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.466
  },
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.466
  },
  {
   "key": "tmdb:562",
   "workId": "f-tmdb562",
   "title": "Крепкий орешек",
   "year": 1988,
   "similarity": 0.45
  }
 ],
 "tmdb:1051": [
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.437
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.418
  },
  {
   "key": "tmdb:949",
   "workId": "f-tmdb949",
   "title": "Схватка",
   "year": 1995,
   "similarity": 0.411
  },
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.41
  },
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.406
  }
 ],
 "tmdb:1052": [
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.358
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.352
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.349
  },
  {
   "key": "tmdb:18333",
   "workId": "f-tmdb18333",
   "title": "Час волка",
   "year": 1968,
   "similarity": 0.34
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.33
  }
 ],
 "tmdb:106": [
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.639
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.593
  },
  {
   "key": "tmdb:562",
   "workId": "f-tmdb562",
   "title": "Крепкий орешек",
   "year": 1988,
   "similarity": 0.533
  },
  {
   "key": "tmdb:1091",
   "workId": "f-tmdb1091",
   "title": "Нечто",
   "year": 1982,
   "similarity": 0.531
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.528
  }
 ],
 "tmdb:10633": [
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.457
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.438
  },
  {
   "key": "tmdb:37257",
   "workId": "f-tmdb37257",
   "title": "Свидетель обвинения",
   "year": 1957,
   "similarity": 0.415
  },
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.406
  },
  {
   "key": "tmdb:595",
   "workId": "f-tmdb595",
   "title": "Убить пересмешника",
   "year": 1962,
   "similarity": 0.402
  }
 ],
 "tmdb:106646": [
  {
   "key": "tmdb:9388",
   "workId": "f-tmdb9388",
   "title": "Здесь курят",
   "year": 2005,
   "similarity": 0.369
  },
  {
   "key": "tmdb:10673",
   "workId": "f-tmdb10673",
   "title": "Уолл-стрит",
   "year": 1987,
   "similarity": 0.333
  },
  {
   "key": "tmdb:168672",
   "workId": "f-tmdb168672",
   "title": "Афера по-американски",
   "year": 2013,
   "similarity": 0.324
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.322
  },
  {
   "key": "tmdb:37799",
   "workId": "f-tmdb37799",
   "title": "Социальная сеть",
   "year": 2010,
   "similarity": 0.321
  }
 ],
 "tmdb:10669": [
  {
   "key": "tmdb:2000",
   "workId": "f-tmdb2000",
   "title": "Агирре, гнев божий",
   "year": 1972,
   "similarity": 0.306
  },
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.306
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.291
  },
  {
   "key": "tmdb:10331",
   "workId": "f-tmdb10331",
   "title": "Ночь живых мертвецов",
   "year": 1968,
   "similarity": 0.285
  },
  {
   "key": "tmdb:9764",
   "workId": "f-tmdb9764",
   "title": "Дерсу Узала",
   "year": 1975,
   "similarity": 0.263
  }
 ],
 "tmdb:10673": [
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.467
  },
  {
   "key": "tmdb:881",
   "workId": "f-tmdb881",
   "title": "Несколько хороших парней",
   "year": 1992,
   "similarity": 0.463
  },
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.439
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.423
  },
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.395
  }
 ],
 "tmdb:10683": [
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.427
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.395
  },
  {
   "key": "tmdb:1443",
   "workId": "f-tmdb1443",
   "title": "Девственницы-самоубийцы",
   "year": 2000,
   "similarity": 0.381
  },
  {
   "key": "tmdb:14",
   "workId": "f-tmdb14",
   "title": "Красота по-американски",
   "year": 1999,
   "similarity": 0.348
  },
  {
   "key": "tmdb:38810",
   "workId": "f-tmdb38810",
   "title": "Клык",
   "year": 2009,
   "similarity": 0.338
  }
 ],
 "tmdb:10707": [
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.526
  },
  {
   "key": "tmdb:68924",
   "workId": "f-tmdb68924",
   "title": "Ледяной ветер",
   "year": 1997,
   "similarity": 0.51
  },
  {
   "key": "tmdb:9451",
   "workId": "f-tmdb9451",
   "title": "Выскочка",
   "year": 1999,
   "similarity": 0.502
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.45
  },
  {
   "key": "tmdb:1443",
   "workId": "f-tmdb1443",
   "title": "Девственницы-самоубийцы",
   "year": 2000,
   "similarity": 0.43
  }
 ],
 "tmdb:10758": [
  {
   "key": "tmdb:37080",
   "workId": "f-tmdb37080",
   "title": "Мать и дитя",
   "year": 2009,
   "similarity": 0.396
  },
  {
   "key": "tmdb:13891",
   "workId": "f-tmdb13891",
   "title": "Гражданка Рут",
   "year": 1996,
   "similarity": 0.385
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.381
  },
  {
   "key": "tmdb:9576",
   "workId": "f-tmdb9576",
   "title": "Тутси",
   "year": 1982,
   "similarity": 0.379
  },
  {
   "key": "tmdb:82693",
   "workId": "f-tmdb82693",
   "title": "Мой парень – псих",
   "year": 2012,
   "similarity": 0.377
  }
 ],
 "tmdb:10774": [
  {
   "key": "tmdb:25364",
   "workId": "f-tmdb25364",
   "title": "Туз в рукаве",
   "year": 1951,
   "similarity": 0.507
  },
  {
   "key": "tmdb:935",
   "workId": "f-tmdb935",
   "title": "Доктор Стрейнджлав, или Как я научился не волноваться и полюбил атомную бомбу",
   "year": 1964,
   "similarity": 0.424
  },
  {
   "key": "tmdb:17365",
   "workId": "f-tmdb17365",
   "title": "Заговор «Параллакс»",
   "year": 1974,
   "similarity": 0.411
  },
  {
   "key": "tmdb:262",
   "workId": "f-tmdb262",
   "title": "Король комедии",
   "year": 1982,
   "similarity": 0.386
  },
  {
   "key": "tmdb:9388",
   "workId": "f-tmdb9388",
   "title": "Здесь курят",
   "year": 2005,
   "similarity": 0.382
  }
 ],
 "tmdb:10775": [
  {
   "key": "tmdb:1422",
   "workId": "f-tmdb1422",
   "title": "Отступники",
   "year": 2006,
   "similarity": 0.416
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.394
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.393
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.364
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.357
  }
 ],
 "tmdb:10778": [
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.543
  },
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.467
  },
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.444
  },
  {
   "key": "tmdb:4944",
   "workId": "f-tmdb4944",
   "title": "После прочтения сжечь",
   "year": 2008,
   "similarity": 0.442
  },
  {
   "key": "tmdb:9270",
   "workId": "f-tmdb9270",
   "title": "Кирпич",
   "year": 2006,
   "similarity": 0.373
  }
 ],
 "tmdb:10795": [
  {
   "key": "tmdb:70670",
   "workId": "u-kp526812",
   "title": "Охотники за головами",
   "year": 2011,
   "similarity": 0.521
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.416
  },
  {
   "key": "tmdb:11439",
   "workId": "f-tmdb11439",
   "title": "Призрак",
   "year": 2010,
   "similarity": 0.398
  },
  {
   "key": "tmdb:2118",
   "workId": "f-tmdb2118",
   "title": "Секреты Лос-Анджелеса",
   "year": 1997,
   "similarity": 0.389
  },
  {
   "key": "tmdb:2649",
   "workId": "u-kp12198",
   "title": "Игра",
   "year": 1997,
   "similarity": 0.372
  }
 ],
 "tmdb:10843": [
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.29
  },
  {
   "key": "tmdb:262",
   "workId": "f-tmdb262",
   "title": "Король комедии",
   "year": 1982,
   "similarity": 0.27
  },
  {
   "key": "tmdb:492",
   "workId": "f-tmdb492",
   "title": "Быть Джоном Малковичем",
   "year": 1999,
   "similarity": 0.262
  },
  {
   "key": "tmdb:8051",
   "workId": "f-tmdb8051",
   "title": "Любовь, сбивающая с ног",
   "year": 2002,
   "similarity": 0.26
  }
 ],
 "tmdb:10858": [
  {
   "key": "tmdb:22954",
   "workId": "f-tmdb22954",
   "title": "Непокорённый",
   "year": 2009,
   "similarity": 0.477
  },
  {
   "key": "tmdb:820",
   "workId": "f-tmdb820",
   "title": "Джон Ф. Кеннеди: Выстрелы в Далласе",
   "year": 1991,
   "similarity": 0.427
  },
  {
   "key": "tmdb:2604",
   "workId": "f-tmdb2604",
   "title": "Рождённый четвёртого июля",
   "year": 1989,
   "similarity": 0.378
  },
  {
   "key": "tmdb:72976",
   "workId": "f-tmdb72976",
   "title": "Линкольн",
   "year": 2012,
   "similarity": 0.367
  },
  {
   "key": "tmdb:11323",
   "workId": "f-tmdb11323",
   "title": "Информатор!",
   "year": 2009,
   "similarity": 0.312
  }
 ],
 "tmdb:1089": [
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.361
  },
  {
   "key": "tmdb:754",
   "workId": "f-tmdb754",
   "title": "Без лица",
   "year": 1997,
   "similarity": 0.353
  },
  {
   "key": "tmdb:744",
   "workId": "f-tmdb744",
   "title": "Лучший стрелок",
   "year": 1986,
   "similarity": 0.351
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.344
  },
  {
   "key": "tmdb:90",
   "workId": "f-tmdb90",
   "title": "Полицейский из Беверли-Хиллз",
   "year": 1984,
   "similarity": 0.342
  }
 ],
 "tmdb:1091": [
  {
   "key": "tmdb:9426",
   "workId": "f-tmdb9426",
   "title": "Муха",
   "year": 1986,
   "similarity": 0.631
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.534
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.531
  },
  {
   "key": "tmdb:11549",
   "workId": "f-tmdb11549",
   "title": "Вторжение похитителей тел",
   "year": 1956,
   "similarity": 0.49
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.435
  }
 ],
 "tmdb:1092": [
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.614
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.583
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.581
  },
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.549
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.548
  }
 ],
 "tmdb:10935": [
  {
   "key": "tmdb:29005",
   "workId": "f-tmdb29005",
   "title": "МакКейб и миссис Миллер",
   "year": 1971,
   "similarity": 0.34
  },
  {
   "key": "tmdb:618",
   "workId": "f-tmdb618",
   "title": "Рождение нации",
   "year": 1915,
   "similarity": 0.334
  },
  {
   "key": "tmdb:3059",
   "workId": "f-tmdb3059",
   "title": "Нетерпимость",
   "year": 1916,
   "similarity": 0.323
  },
  {
   "key": "tmdb:27236",
   "workId": "f-tmdb27236",
   "title": "Двухполосное шоссе",
   "year": 1971,
   "similarity": 0.303
  },
  {
   "key": "tmdb:11951",
   "workId": "f-tmdb11951",
   "title": "Исчезающая точка",
   "year": 1971,
   "similarity": 0.294
  }
 ],
 "tmdb:10997": [
  {
   "key": "tmdb:10404",
   "workId": "f-tmdb10404",
   "title": "Подними красный фонарь",
   "year": 1991,
   "similarity": 0.336
  },
  {
   "key": "tmdb:11703",
   "workId": "f-tmdb11703",
   "title": "Поцелуй женщины-паука",
   "year": 1985,
   "similarity": 0.327
  },
  {
   "key": "tmdb:31225",
   "workId": "f-tmdb31225",
   "title": "Париж в огне",
   "year": 1991,
   "similarity": 0.302
  },
  {
   "key": "tmdb:10436",
   "workId": "f-tmdb10436",
   "title": "Эпоха невинности",
   "year": 1993,
   "similarity": 0.291
  },
  {
   "key": "tmdb:79120",
   "workId": "f-tmdb79120",
   "title": "Уикенд",
   "year": 2011,
   "similarity": 0.286
  }
 ],
 "tmdb:10998": [
  {
   "key": "tmdb:402",
   "workId": "f-tmdb402",
   "title": "Основной инстинкт",
   "year": 1992,
   "similarity": 0.521
  },
  {
   "key": "tmdb:37080",
   "workId": "f-tmdb37080",
   "title": "Мать и дитя",
   "year": 2009,
   "similarity": 0.421
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.403
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.4
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.399
  }
 ],
 "tmdb:11": [
  {
   "key": "tmdb:85",
   "workId": "f-tmdb85",
   "title": "Индиана Джонс: В поисках утраченного ковчега",
   "year": 1981,
   "similarity": 0.52
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.518
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.459
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.432
  },
  {
   "key": "tmdb:620",
   "workId": "f-tmdb620",
   "title": "Охотники за привидениями",
   "year": 1984,
   "similarity": 0.418
  }
 ],
 "tmdb:11009": [
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.554
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.507
  },
  {
   "key": "tmdb:621",
   "workId": "f-tmdb621",
   "title": "Бриолин",
   "year": 1978,
   "similarity": 0.492
  },
  {
   "key": "tmdb:20325",
   "workId": "f-tmdb20325",
   "title": "Время свинга",
   "year": 1936,
   "similarity": 0.457
  },
  {
   "key": "tmdb:27327",
   "workId": "f-tmdb27327",
   "title": "Призрак рая",
   "year": 1974,
   "similarity": 0.44
  }
 ],
 "tmdb:11020": [
  {
   "key": "tmdb:37903",
   "workId": "f-tmdb37903",
   "title": "Белая лента",
   "year": 2009,
   "similarity": 0.414
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.377
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.376
  },
  {
   "key": "tmdb:4495",
   "workId": "f-tmdb4495",
   "title": "Дух улья",
   "year": 1973,
   "similarity": 0.376
  },
  {
   "key": "tmdb:9764",
   "workId": "f-tmdb9764",
   "title": "Дерсу Узала",
   "year": 1975,
   "similarity": 0.371
  }
 ],
 "tmdb:1103": [
  {
   "key": "tmdb:5548",
   "workId": "l-tmdb5548",
   "title": "Робокоп",
   "year": 1987,
   "similarity": 0.531
  },
  {
   "key": "tmdb:8810",
   "workId": "f-tmdb8810",
   "title": "Безумный Макс 2: Воин дороги",
   "year": 1981,
   "similarity": 0.511
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.495
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.458
  },
  {
   "key": "tmdb:17814",
   "workId": "f-tmdb17814",
   "title": "Нападение на 13-й участок",
   "year": 1976,
   "similarity": 0.446
  }
 ],
 "tmdb:11033": [
  {
   "key": "tmdb:402",
   "workId": "f-tmdb402",
   "title": "Основной инстинкт",
   "year": 1992,
   "similarity": 0.481
  },
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.459
  },
  {
   "key": "tmdb:11167",
   "workId": "f-tmdb11167",
   "title": "Подглядывающий",
   "year": 1960,
   "similarity": 0.419
  },
  {
   "key": "tmdb:11644",
   "workId": "f-tmdb11644",
   "title": "Прокол",
   "year": 1981,
   "similarity": 0.399
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.398
  }
 ],
 "tmdb:11050": [
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.528
  },
  {
   "key": "tmdb:462",
   "workId": "f-tmdb462",
   "title": "Эрин Брокович",
   "year": 2000,
   "similarity": 0.467
  },
  {
   "key": "tmdb:16619",
   "workId": "f-tmdb16619",
   "title": "Обыкновенные люди",
   "year": 1980,
   "similarity": 0.464
  },
  {
   "key": "tmdb:9800",
   "workId": "f-tmdb9800",
   "title": "Филадельфия",
   "year": 1993,
   "similarity": 0.405
  },
  {
   "key": "tmdb:380",
   "workId": "f-tmdb380",
   "title": "Человек дождя",
   "year": 1988,
   "similarity": 0.358
  }
 ],
 "tmdb:11051": [
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.493
  },
  {
   "key": "tmdb:9552",
   "workId": "f-tmdb9552",
   "title": "Изгоняющий дьявола",
   "year": 1973,
   "similarity": 0.405
  },
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.352
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.337
  },
  {
   "key": "tmdb:490",
   "workId": "f-tmdb490",
   "title": "Седьмая печать",
   "year": 1957,
   "similarity": 0.33
  }
 ],
 "tmdb:11096": [
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.601
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.583
  },
  {
   "key": "tmdb:29917",
   "workId": "u-kp418762",
   "title": "Экзамен",
   "year": 2009,
   "similarity": 0.558
  },
  {
   "key": "tmdb:22825",
   "workId": "u-kp1762",
   "title": "Посылка",
   "year": 2009,
   "similarity": 0.536
  },
  {
   "key": "tmdb:82507",
   "workId": "l-tmdb82507",
   "title": "Синистер",
   "year": 2012,
   "similarity": 0.534
  }
 ],
 "tmdb:11104": [
  {
   "key": "tmdb:655",
   "workId": "f-tmdb655",
   "title": "Париж, Техас",
   "year": 1984,
   "similarity": 0.429
  },
  {
   "key": "tmdb:843",
   "workId": "f-tmdb843",
   "title": "Любовное настроение",
   "year": 2000,
   "similarity": 0.394
  },
  {
   "key": "tmdb:76",
   "workId": "f-tmdb76",
   "title": "Перед рассветом",
   "year": 1995,
   "similarity": 0.373
  },
  {
   "key": "tmdb:1887",
   "workId": "f-tmdb1887",
   "title": "Мария-Антуанетта",
   "year": 2006,
   "similarity": 0.357
  },
  {
   "key": "tmdb:132344",
   "workId": "f-tmdb132344",
   "title": "Перед полуночью",
   "year": 2013,
   "similarity": 0.318
  }
 ],
 "tmdb:11159": [
  {
   "key": "tmdb:37080",
   "workId": "f-tmdb37080",
   "title": "Мать и дитя",
   "year": 2009,
   "similarity": 0.435
  },
  {
   "key": "tmdb:10436",
   "workId": "f-tmdb10436",
   "title": "Эпоха невинности",
   "year": 1993,
   "similarity": 0.378
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.345
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.322
  },
  {
   "key": "tmdb:21450",
   "workId": "f-tmdb21450",
   "title": "Обнаженная",
   "year": 1993,
   "similarity": 0.31
  }
 ],
 "tmdb:11167": [
  {
   "key": "tmdb:931",
   "workId": "u-kp6268",
   "title": "А теперь не смотри",
   "year": 1973,
   "similarity": 0.533
  },
  {
   "key": "tmdb:20126",
   "workId": "f-tmdb20126",
   "title": "Кроваво-красное",
   "year": 1975,
   "similarity": 0.495
  },
  {
   "key": "tmdb:9540",
   "workId": "f-tmdb9540",
   "title": "Связанные насмерть",
   "year": 1988,
   "similarity": 0.466
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.456
  },
  {
   "key": "tmdb:11033",
   "workId": "f-tmdb11033",
   "title": "Бритва",
   "year": 1980,
   "similarity": 0.419
  }
 ],
 "tmdb:11216": [
  {
   "key": "tmdb:235",
   "workId": "f-tmdb235",
   "title": "Останься со мной",
   "year": 1986,
   "similarity": 0.513
  },
  {
   "key": "tmdb:637",
   "workId": "f-tmdb637",
   "title": "Жизнь прекрасна",
   "year": 1997,
   "similarity": 0.422
  },
  {
   "key": "tmdb:595",
   "workId": "f-tmdb595",
   "title": "Убить пересмешника",
   "year": 1962,
   "similarity": 0.416
  },
  {
   "key": "tmdb:207",
   "workId": "f-tmdb207",
   "title": "Общество мёртвых поэтов",
   "year": 1989,
   "similarity": 0.414
  },
  {
   "key": "tmdb:194",
   "workId": "f-tmdb194",
   "title": "Амели",
   "year": 2001,
   "similarity": 0.399
  }
 ],
 "tmdb:11239": [
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.579
  },
  {
   "key": "tmdb:20325",
   "workId": "f-tmdb20325",
   "title": "Время свинга",
   "year": 1936,
   "similarity": 0.529
  },
  {
   "key": "tmdb:11009",
   "workId": "f-tmdb11009",
   "title": "Лихорадка субботнего вечера",
   "year": 1977,
   "similarity": 0.507
  },
  {
   "key": "tmdb:3080",
   "workId": "f-tmdb3080",
   "title": "Цилиндр",
   "year": 1935,
   "similarity": 0.506
  },
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.483
  }
 ],
 "tmdb:1124": [
  {
   "key": "tmdb:27205",
   "workId": "w08",
   "title": "Начало",
   "year": 2010,
   "similarity": 0.475
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.459
  },
  {
   "key": "tmdb:745",
   "workId": "f-tmdb745",
   "title": "Шестое чувство",
   "year": 1999,
   "similarity": 0.457
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.448
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.425
  }
 ],
 "tmdb:11293": [
  {
   "key": "tmdb:990",
   "workId": "f-tmdb990",
   "title": "Бильярдист",
   "year": 1961,
   "similarity": 0.439
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.412
  },
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.385
  },
  {
   "key": "tmdb:284",
   "workId": "f-tmdb284",
   "title": "Квартира",
   "year": 1960,
   "similarity": 0.373
  },
  {
   "key": "tmdb:235",
   "workId": "f-tmdb235",
   "title": "Останься со мной",
   "year": 1986,
   "similarity": 0.372
  }
 ],
 "tmdb:11300": [
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.522
  },
  {
   "key": "tmdb:27327",
   "workId": "f-tmdb27327",
   "title": "Призрак рая",
   "year": 1974,
   "similarity": 0.494
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.458
  },
  {
   "key": "tmdb:31121",
   "workId": "f-tmdb31121",
   "title": "Шампунь",
   "year": 1975,
   "similarity": 0.45
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.449
  }
 ],
 "tmdb:11322": [
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.364
  },
  {
   "key": "tmdb:75656",
   "workId": "u-kp522892",
   "title": "Иллюзия обмана",
   "year": 2013,
   "similarity": 0.358
  },
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.357
  },
  {
   "key": "tmdb:82",
   "workId": "f-tmdb82",
   "title": "Полиция Майами: Отдел нравов",
   "year": 2006,
   "similarity": 0.321
  },
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.309
  }
 ],
 "tmdb:11323": [
  {
   "key": "tmdb:4944",
   "workId": "f-tmdb4944",
   "title": "После прочтения сжечь",
   "year": 2008,
   "similarity": 0.388
  },
  {
   "key": "tmdb:11439",
   "workId": "f-tmdb11439",
   "title": "Призрак",
   "year": 2010,
   "similarity": 0.324
  },
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.315
  },
  {
   "key": "tmdb:10858",
   "workId": "f-tmdb10858",
   "title": "Никсон",
   "year": 1995,
   "similarity": 0.312
  },
  {
   "key": "tmdb:1599",
   "workId": "f-tmdb1599",
   "title": "Взломщики сердец",
   "year": 2004,
   "similarity": 0.305
  }
 ],
 "tmdb:11324": [
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.486
  },
  {
   "key": "tmdb:2649",
   "workId": "u-kp12198",
   "title": "Игра",
   "year": 1997,
   "similarity": 0.435
  },
  {
   "key": "tmdb:1124",
   "workId": "u-kp195334",
   "title": "Престиж",
   "year": 2006,
   "similarity": 0.416
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.413
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.413
  }
 ],
 "tmdb:11368": [
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.603
  },
  {
   "key": "tmdb:10778",
   "workId": "f-tmdb10778",
   "title": "Человек, которого не было",
   "year": 2001,
   "similarity": 0.543
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.532
  },
  {
   "key": "tmdb:4944",
   "workId": "f-tmdb4944",
   "title": "После прочтения сжечь",
   "year": 2008,
   "similarity": 0.471
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.463
  }
 ],
 "tmdb:11416": [
  {
   "key": "tmdb:1495",
   "workId": "f-tmdb1495",
   "title": "Царство небесное",
   "year": 2005,
   "similarity": 0.494
  },
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.416
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.376
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.376
  },
  {
   "key": "tmdb:581",
   "workId": "f-tmdb581",
   "title": "Танцующий с волками",
   "year": 1990,
   "similarity": 0.364
  }
 ],
 "tmdb:11423": [
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.503
  },
  {
   "key": "tmdb:4689",
   "workId": "f-tmdb4689",
   "title": "Сочувствие господину Месть",
   "year": 2002,
   "similarity": 0.476
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.445
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.444
  },
  {
   "key": "tmdb:1949",
   "workId": "c-zodiac",
   "title": "Зодиак",
   "year": 2007,
   "similarity": 0.402
  }
 ],
 "tmdb:11426": [
  {
   "key": "tmdb:887",
   "workId": "f-tmdb887",
   "title": "Лучшие годы нашей жизни",
   "year": 1946,
   "similarity": 0.606
  },
  {
   "key": "tmdb:289",
   "workId": "f-tmdb289",
   "title": "Касабланка",
   "year": 1943,
   "similarity": 0.459
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.375
  },
  {
   "key": "tmdb:1654",
   "workId": "f-tmdb1654",
   "title": "Грязная дюжина",
   "year": 1967,
   "similarity": 0.374
  },
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.37
  }
 ],
 "tmdb:11439": [
  {
   "key": "tmdb:10795",
   "workId": "u-kp22936",
   "title": "Не говори никому",
   "year": 2006,
   "similarity": 0.398
  },
  {
   "key": "tmdb:11963",
   "workId": "f-tmdb11963",
   "title": "Три дня Кондора",
   "year": 1975,
   "similarity": 0.366
  },
  {
   "key": "tmdb:4944",
   "workId": "f-tmdb4944",
   "title": "После прочтения сжечь",
   "year": 2008,
   "similarity": 0.33
  },
  {
   "key": "tmdb:592",
   "workId": "f-tmdb592",
   "title": "Разговор",
   "year": 1974,
   "similarity": 0.329
  },
  {
   "key": "tmdb:11323",
   "workId": "f-tmdb11323",
   "title": "Информатор!",
   "year": 2009,
   "similarity": 0.324
  }
 ],
 "tmdb:11446": [
  {
   "key": "tmdb:157386",
   "workId": "f-tmdb157386",
   "title": "Захватывающее время",
   "year": 2013,
   "similarity": 0.443
  },
  {
   "key": "tmdb:1382",
   "workId": "f-tmdb1382",
   "title": "Я и ты и все, кого мы знаем",
   "year": 2005,
   "similarity": 0.435
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.428
  },
  {
   "key": "tmdb:27845",
   "workId": "f-tmdb27845",
   "title": "Истина в вине",
   "year": 1996,
   "similarity": 0.424
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.412
  }
 ],
 "tmdb:115": [
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.399
  },
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.363
  },
  {
   "key": "tmdb:4944",
   "workId": "f-tmdb4944",
   "title": "После прочтения сжечь",
   "year": 2008,
   "similarity": 0.358
  },
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.353
  },
  {
   "key": "tmdb:378",
   "workId": "f-tmdb378",
   "title": "Воспитание Аризоны",
   "year": 1987,
   "similarity": 0.345
  }
 ],
 "tmdb:11549": [
  {
   "key": "tmdb:1091",
   "workId": "f-tmdb1091",
   "title": "Нечто",
   "year": 1982,
   "similarity": 0.49
  },
  {
   "key": "tmdb:9426",
   "workId": "f-tmdb9426",
   "title": "Муха",
   "year": 1986,
   "similarity": 0.434
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.39
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.33
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.33
  }
 ],
 "tmdb:11602": [
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.72
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.562
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.549
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.537
  },
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.527
  }
 ],
 "tmdb:1164": [
  {
   "key": "tmdb:334",
   "workId": "f-tmdb334",
   "title": "Магнолия",
   "year": 1999,
   "similarity": 0.369
  },
  {
   "key": "tmdb:470",
   "workId": "f-tmdb470",
   "title": "21 грамм",
   "year": 2003,
   "similarity": 0.36
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.329
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.312
  },
  {
   "key": "tmdb:8055",
   "workId": "f-tmdb8055",
   "title": "Чтец",
   "year": 2008,
   "similarity": 0.299
  }
 ],
 "tmdb:11644": [
  {
   "key": "tmdb:17365",
   "workId": "f-tmdb17365",
   "title": "Заговор «Параллакс»",
   "year": 1974,
   "similarity": 0.477
  },
  {
   "key": "tmdb:592",
   "workId": "f-tmdb592",
   "title": "Разговор",
   "year": 1974,
   "similarity": 0.415
  },
  {
   "key": "tmdb:1018",
   "workId": "c-mulholland",
   "title": "Малхолланд Драйв",
   "year": 2001,
   "similarity": 0.403
  },
  {
   "key": "tmdb:11033",
   "workId": "f-tmdb11033",
   "title": "Бритва",
   "year": 1980,
   "similarity": 0.399
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.398
  }
 ],
 "tmdb:11698": [
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.532
  },
  {
   "key": "tmdb:26596",
   "workId": "f-tmdb26596",
   "title": "Джонни-гитара",
   "year": 1954,
   "similarity": 0.49
  },
  {
   "key": "tmdb:7857",
   "workId": "f-tmdb7857",
   "title": "Амаркорд",
   "year": 1973,
   "similarity": 0.463
  },
  {
   "key": "tmdb:405",
   "workId": "f-tmdb405",
   "title": "Дорога",
   "year": 1954,
   "similarity": 0.39
  },
  {
   "key": "tmdb:343",
   "workId": "f-tmdb343",
   "title": "Гарольд и Мод",
   "year": 1971,
   "similarity": 0.381
  }
 ],
 "tmdb:11702": [
  {
   "key": "tmdb:82",
   "workId": "f-tmdb82",
   "title": "Полиция Майами: Отдел нравов",
   "year": 2006,
   "similarity": 0.56
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.554
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.548
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.546
  },
  {
   "key": "tmdb:2019",
   "workId": "f-tmdb2019",
   "title": "Трудная мишень",
   "year": 1993,
   "similarity": 0.478
  }
 ],
 "tmdb:11703": [
  {
   "key": "tmdb:31225",
   "workId": "f-tmdb31225",
   "title": "Париж в огне",
   "year": 1991,
   "similarity": 0.579
  },
  {
   "key": "tmdb:79120",
   "workId": "f-tmdb79120",
   "title": "Уикенд",
   "year": 2011,
   "similarity": 0.417
  },
  {
   "key": "tmdb:47620",
   "workId": "f-tmdb47620",
   "title": "Отрава",
   "year": 1991,
   "similarity": 0.394
  },
  {
   "key": "tmdb:9800",
   "workId": "f-tmdb9800",
   "title": "Филадельфия",
   "year": 1993,
   "similarity": 0.388
  },
  {
   "key": "tmdb:9576",
   "workId": "f-tmdb9576",
   "title": "Тутси",
   "year": 1982,
   "similarity": 0.369
  }
 ],
 "tmdb:11710": [
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.529
  },
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.506
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.505
  },
  {
   "key": "tmdb:18333",
   "workId": "f-tmdb18333",
   "title": "Час волка",
   "year": 1968,
   "similarity": 0.498
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.483
  }
 ],
 "tmdb:11712": [
  {
   "key": "tmdb:11878",
   "workId": "f-tmdb11878",
   "title": "Телохранитель",
   "year": 1961,
   "similarity": 0.646
  },
  {
   "key": "tmdb:548",
   "workId": "w02",
   "title": "Расёмон",
   "year": 1950,
   "similarity": 0.567
  },
  {
   "key": "tmdb:3780",
   "workId": "f-tmdb3780",
   "title": "Красная борода",
   "year": 1965,
   "similarity": 0.563
  },
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.529
  },
  {
   "key": "tmdb:12493",
   "workId": "f-tmdb12493",
   "title": "Рай и ад",
   "year": 1963,
   "similarity": 0.487
  }
 ],
 "tmdb:11778": [
  {
   "key": "tmdb:792",
   "workId": "f-tmdb792",
   "title": "Взвод",
   "year": 1986,
   "similarity": 0.648
  },
  {
   "key": "tmdb:28",
   "workId": "f-tmdb28",
   "title": "Апокалипсис сегодня",
   "year": 1979,
   "similarity": 0.635
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.423
  },
  {
   "key": "tmdb:2604",
   "workId": "f-tmdb2604",
   "title": "Рождённый четвёртого июля",
   "year": 1989,
   "similarity": 0.396
  },
  {
   "key": "tmdb:975",
   "workId": "f-tmdb975",
   "title": "Тропы славы",
   "year": 1957,
   "similarity": 0.376
  }
 ],
 "tmdb:11830": [
  {
   "key": "tmdb:26596",
   "workId": "f-tmdb26596",
   "title": "Джонни-гитара",
   "year": 1954,
   "similarity": 0.329
  },
  {
   "key": "tmdb:11698",
   "workId": "f-tmdb11698",
   "title": "Строшек",
   "year": 1977,
   "similarity": 0.284
  },
  {
   "key": "tmdb:9071",
   "workId": "f-tmdb9071",
   "title": "Жизнь в забвении",
   "year": 1995,
   "similarity": 0.27
  },
  {
   "key": "tmdb:11712",
   "workId": "f-tmdb11712",
   "title": "Телохранитель 2: Отважный Сандзюро",
   "year": 1962,
   "similarity": 0.255
  }
 ],
 "tmdb:11878": [
  {
   "key": "tmdb:11712",
   "workId": "f-tmdb11712",
   "title": "Телохранитель 2: Отважный Сандзюро",
   "year": 1962,
   "similarity": 0.646
  },
  {
   "key": "tmdb:346",
   "workId": "f-tmdb346",
   "title": "Семь Самураев",
   "year": 1954,
   "similarity": 0.641
  },
  {
   "key": "tmdb:548",
   "workId": "w02",
   "title": "Расёмон",
   "year": 1950,
   "similarity": 0.585
  },
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.488
  },
  {
   "key": "tmdb:3780",
   "workId": "f-tmdb3780",
   "title": "Красная борода",
   "year": 1965,
   "similarity": 0.486
  }
 ],
 "tmdb:11906": [
  {
   "key": "tmdb:20126",
   "workId": "f-tmdb20126",
   "title": "Кроваво-красное",
   "year": 1975,
   "similarity": 0.617
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.526
  },
  {
   "key": "tmdb:931",
   "workId": "u-kp6268",
   "title": "А теперь не смотри",
   "year": 1973,
   "similarity": 0.493
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.477
  },
  {
   "key": "tmdb:948",
   "workId": "f-tmdb948",
   "title": "Хэллоуин",
   "year": 1978,
   "similarity": 0.418
  }
 ],
 "tmdb:11951": [
  {
   "key": "tmdb:27236",
   "workId": "f-tmdb27236",
   "title": "Двухполосное шоссе",
   "year": 1971,
   "similarity": 0.599
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.398
  },
  {
   "key": "tmdb:11300",
   "workId": "f-tmdb11300",
   "title": "Дикая штучка",
   "year": 1986,
   "similarity": 0.394
  },
  {
   "key": "tmdb:8810",
   "workId": "f-tmdb8810",
   "title": "Безумный Макс 2: Воин дороги",
   "year": 1981,
   "similarity": 0.364
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.356
  }
 ],
 "tmdb:11953": [
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.661
  },
  {
   "key": "tmdb:346",
   "workId": "f-tmdb346",
   "title": "Семь Самураев",
   "year": 1954,
   "similarity": 0.577
  },
  {
   "key": "tmdb:548",
   "workId": "w02",
   "title": "Расёмон",
   "year": 1950,
   "similarity": 0.492
  },
  {
   "key": "tmdb:11712",
   "workId": "f-tmdb11712",
   "title": "Телохранитель 2: Отважный Сандзюро",
   "year": 1962,
   "similarity": 0.438
  },
  {
   "key": "tmdb:11878",
   "workId": "f-tmdb11878",
   "title": "Телохранитель",
   "year": 1961,
   "similarity": 0.421
  }
 ],
 "tmdb:11963": [
  {
   "key": "tmdb:2503",
   "workId": "f-tmdb2503",
   "title": "Ультиматум Борна",
   "year": 2007,
   "similarity": 0.585
  },
  {
   "key": "tmdb:2502",
   "workId": "f-tmdb2502",
   "title": "Превосходство Борна",
   "year": 2004,
   "similarity": 0.56
  },
  {
   "key": "tmdb:2501",
   "workId": "f-tmdb2501",
   "title": "Идентификация Борна",
   "year": 2002,
   "similarity": 0.511
  },
  {
   "key": "tmdb:213",
   "workId": "f-tmdb213",
   "title": "На север через северо-запад",
   "year": 1959,
   "similarity": 0.496
  },
  {
   "key": "tmdb:37724",
   "workId": "f-tmdb37724",
   "title": "007: Координаты «Скайфолл»",
   "year": 2012,
   "similarity": 0.42
  }
 ],
 "tmdb:11976": [
  {
   "key": "tmdb:32985",
   "workId": "l-tmdb32985",
   "title": "Соломон Кейн",
   "year": 2009,
   "similarity": 0.474
  },
  {
   "key": "tmdb:23488",
   "workId": "l-tmdb23488",
   "title": "Дориан Грей",
   "year": 2009,
   "similarity": 0.349
  },
  {
   "key": "tmdb:38319",
   "workId": "l-tmdb38319",
   "title": "Храбрые перцем",
   "year": 2011,
   "similarity": 0.333
  },
  {
   "key": "tmdb:129",
   "workId": "f-tmdb129",
   "title": "Унесённые призраками",
   "year": 2001,
   "similarity": 0.33
  },
  {
   "key": "tmdb:9593",
   "workId": "f-tmdb9593",
   "title": "Последний киногерой",
   "year": 1993,
   "similarity": 0.325
  }
 ],
 "tmdb:11986": [
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.41
  },
  {
   "key": "tmdb:5781",
   "workId": "f-tmdb5781",
   "title": "Этот смутный объект желания",
   "year": 1977,
   "similarity": 0.379
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.37
  },
  {
   "key": "tmdb:145",
   "workId": "f-tmdb145",
   "title": "Рассекая волны",
   "year": 1996,
   "similarity": 0.362
  },
  {
   "key": "tmdb:9301",
   "workId": "f-tmdb9301",
   "title": "Принцесса и воин",
   "year": 2000,
   "similarity": 0.355
  }
 ],
 "tmdb:12162": [
  {
   "key": "tmdb:855",
   "workId": "f-tmdb855",
   "title": "Чёрный ястреб",
   "year": 2001,
   "similarity": 0.587
  },
  {
   "key": "tmdb:97630",
   "workId": "f-tmdb97630",
   "title": "Цель номер один",
   "year": 2012,
   "similarity": 0.574
  },
  {
   "key": "tmdb:1372",
   "workId": "f-tmdb1372",
   "title": "Кровавый алмаз",
   "year": 2006,
   "similarity": 0.528
  },
  {
   "key": "tmdb:6415",
   "workId": "f-tmdb6415",
   "title": "Три короля",
   "year": 1999,
   "similarity": 0.524
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.511
  }
 ],
 "tmdb:121986": [
  {
   "key": "tmdb:1382",
   "workId": "f-tmdb1382",
   "title": "Я и ты и все, кого мы знаем",
   "year": 2005,
   "similarity": 0.515
  },
  {
   "key": "tmdb:25468",
   "workId": "f-tmdb25468",
   "title": "Мой ужин с Андре",
   "year": 1981,
   "similarity": 0.439
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.437
  },
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.426
  },
  {
   "key": "tmdb:11446",
   "workId": "f-tmdb11446",
   "title": "Добро пожаловать в кукольный дом",
   "year": 1996,
   "similarity": 0.408
  }
 ],
 "tmdb:12262": [
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.694
  },
  {
   "key": "tmdb:15516",
   "workId": "f-tmdb15516",
   "title": "Последний дом слева",
   "year": 1972,
   "similarity": 0.543
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.526
  },
  {
   "key": "tmdb:10331",
   "workId": "f-tmdb10331",
   "title": "Ночь живых мертвецов",
   "year": 1968,
   "similarity": 0.523
  },
  {
   "key": "tmdb:10212",
   "workId": "l-tmdb10212",
   "title": "Людоед",
   "year": 1999,
   "similarity": 0.519
  }
 ],
 "tmdb:123678": [
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.513
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.374
  },
  {
   "key": "tmdb:17295",
   "workId": "f-tmdb17295",
   "title": "Битва за Алжир",
   "year": 1966,
   "similarity": 0.37
  },
  {
   "key": "tmdb:2440",
   "workId": "f-tmdb2440",
   "title": "Объединённая зона безопасности",
   "year": 2000,
   "similarity": 0.366
  },
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.34
  }
 ],
 "tmdb:12493": [
  {
   "key": "tmdb:548",
   "workId": "w02",
   "title": "Расёмон",
   "year": 1950,
   "similarity": 0.592
  },
  {
   "key": "tmdb:3780",
   "workId": "f-tmdb3780",
   "title": "Красная борода",
   "year": 1965,
   "similarity": 0.562
  },
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.542
  },
  {
   "key": "tmdb:934",
   "workId": "f-tmdb934",
   "title": "Мужские разборки",
   "year": 1955,
   "similarity": 0.504
  },
  {
   "key": "tmdb:11712",
   "workId": "f-tmdb11712",
   "title": "Телохранитель 2: Отважный Сандзюро",
   "year": 1962,
   "similarity": 0.487
  }
 ],
 "tmdb:1251": [
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.509
  },
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.472
  },
  {
   "key": "tmdb:792",
   "workId": "f-tmdb792",
   "title": "Взвод",
   "year": 1986,
   "similarity": 0.449
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.44
  },
  {
   "key": "tmdb:887",
   "workId": "f-tmdb887",
   "title": "Лучшие годы нашей жизни",
   "year": 1946,
   "similarity": 0.417
  }
 ],
 "tmdb:12573": [
  {
   "key": "tmdb:68722",
   "workId": "f-tmdb68722",
   "title": "Мастер",
   "year": 2012,
   "similarity": 0.423
  },
  {
   "key": "tmdb:8967",
   "workId": "f-tmdb8967",
   "title": "Древо жизни",
   "year": 2011,
   "similarity": 0.367
  },
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.362
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.355
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.342
  }
 ],
 "tmdb:12626": [
  {
   "key": "tmdb:9576",
   "workId": "f-tmdb9576",
   "title": "Тутси",
   "year": 1982,
   "similarity": 0.475
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.375
  },
  {
   "key": "tmdb:31121",
   "workId": "f-tmdb31121",
   "title": "Шампунь",
   "year": 1975,
   "similarity": 0.367
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.36
  },
  {
   "key": "tmdb:1779",
   "workId": "f-tmdb1779",
   "title": "Роджер и я",
   "year": 1989,
   "similarity": 0.341
  }
 ],
 "tmdb:12698": [
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.646
  },
  {
   "key": "tmdb:2440",
   "workId": "f-tmdb2440",
   "title": "Объединённая зона безопасности",
   "year": 2000,
   "similarity": 0.573
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.554
  },
  {
   "key": "tmdb:17295",
   "workId": "f-tmdb17295",
   "title": "Битва за Алжир",
   "year": 1966,
   "similarity": 0.526
  },
  {
   "key": "tmdb:31657",
   "workId": "f-tmdb31657",
   "title": "Возвращение домой",
   "year": 1978,
   "similarity": 0.52
  }
 ],
 "tmdb:1271": [
  {
   "key": "tmdb:1724",
   "workId": "f-tmdb1724",
   "title": "Невероятный Халк",
   "year": 2008,
   "similarity": 0.546
  },
  {
   "key": "tmdb:49026",
   "workId": "f-tmdb49026",
   "title": "Тёмный рыцарь: Возрождение легенды",
   "year": 2012,
   "similarity": 0.542
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.541
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.533
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.528
  }
 ],
 "tmdb:129": [
  {
   "key": "tmdb:4935",
   "workId": "f-tmdb4935",
   "title": "Ходячий замок",
   "year": 2004,
   "similarity": 0.791
  },
  {
   "key": "tmdb:11976",
   "workId": "l-tmdb11976",
   "title": "Легенда",
   "year": 1985,
   "similarity": 0.33
  },
  {
   "key": "tmdb:194",
   "workId": "f-tmdb194",
   "title": "Амели",
   "year": 2001,
   "similarity": 0.258
  },
  {
   "key": "tmdb:630",
   "workId": "f-tmdb630",
   "title": "Волшебник страны Оз",
   "year": 1939,
   "similarity": 0.257
  },
  {
   "key": "tmdb:856",
   "workId": "f-tmdb856",
   "title": "Кто подставил кролика Роджера",
   "year": 1988,
   "similarity": 0.256
  }
 ],
 "tmdb:13": [
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.558
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.436
  },
  {
   "key": "tmdb:380",
   "workId": "f-tmdb380",
   "title": "Человек дождя",
   "year": 1988,
   "similarity": 0.423
  },
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.4
  },
  {
   "key": "tmdb:207",
   "workId": "f-tmdb207",
   "title": "Общество мёртвых поэтов",
   "year": 1989,
   "similarity": 0.381
  }
 ],
 "tmdb:13183": [
  {
   "key": "tmdb:49026",
   "workId": "f-tmdb49026",
   "title": "Тёмный рыцарь: Возрождение легенды",
   "year": 2012,
   "similarity": 0.693
  },
  {
   "key": "tmdb:272",
   "workId": "f-tmdb272",
   "title": "Бэтмен: Начало",
   "year": 2005,
   "similarity": 0.688
  },
  {
   "key": "tmdb:752",
   "workId": "l-tmdb752",
   "title": "«V» значит Вендетта",
   "year": 2006,
   "similarity": 0.686
  },
  {
   "key": "tmdb:155",
   "workId": "f-tmdb155",
   "title": "Тёмный рыцарь",
   "year": 2008,
   "similarity": 0.676
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.553
  }
 ],
 "tmdb:13223": [
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.524
  },
  {
   "key": "tmdb:1640",
   "workId": "f-tmdb1640",
   "title": "Столкновение",
   "year": 2005,
   "similarity": 0.523
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.475
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.475
  },
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.47
  }
 ],
 "tmdb:132344": [
  {
   "key": "tmdb:76",
   "workId": "f-tmdb76",
   "title": "Перед рассветом",
   "year": 1995,
   "similarity": 0.613
  },
  {
   "key": "tmdb:80",
   "workId": "f-tmdb80",
   "title": "Перед закатом",
   "year": 2004,
   "similarity": 0.557
  },
  {
   "key": "tmdb:422",
   "workId": "f-tmdb422",
   "title": "8 с половиной",
   "year": 1963,
   "similarity": 0.377
  },
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.372
  },
  {
   "key": "tmdb:18148",
   "workId": "f-tmdb18148",
   "title": "Токийская повесть",
   "year": 1953,
   "similarity": 0.365
  }
 ],
 "tmdb:13398": [
  {
   "key": "tmdb:10494",
   "workId": "c-perfect-blue",
   "title": "Идеальная грусть",
   "year": 1997,
   "similarity": 0.33
  },
  {
   "key": "tmdb:7500",
   "workId": "f-tmdb7500",
   "title": "Сонатина",
   "year": 1993,
   "similarity": 0.287
  },
  {
   "key": "tmdb:5910",
   "workId": "f-tmdb5910",
   "title": "Фейерверк",
   "year": 1997,
   "similarity": 0.262
  }
 ],
 "tmdb:134": [
  {
   "key": "tmdb:378",
   "workId": "f-tmdb378",
   "title": "Воспитание Аризоны",
   "year": 1987,
   "similarity": 0.371
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.311
  },
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.305
  },
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.287
  },
  {
   "key": "tmdb:68718",
   "workId": "f-tmdb68718",
   "title": "Джанго освобождённый",
   "year": 2012,
   "similarity": 0.285
  }
 ],
 "tmdb:13528": [
  {
   "key": "tmdb:21734",
   "workId": "f-tmdb21734",
   "title": "Тень сомнения",
   "year": 1943,
   "similarity": 0.363
  },
  {
   "key": "tmdb:223",
   "workId": "f-tmdb223",
   "title": "Ребекка",
   "year": 1940,
   "similarity": 0.35
  },
  {
   "key": "tmdb:506",
   "workId": "f-tmdb506",
   "title": "Марни",
   "year": 1964,
   "similarity": 0.304
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.279
  },
  {
   "key": "tmdb:11167",
   "workId": "f-tmdb11167",
   "title": "Подглядывающий",
   "year": 1960,
   "similarity": 0.263
  }
 ],
 "tmdb:1372": [
  {
   "key": "tmdb:855",
   "workId": "f-tmdb855",
   "title": "Чёрный ястреб",
   "year": 2001,
   "similarity": 0.54
  },
  {
   "key": "tmdb:12162",
   "workId": "f-tmdb12162",
   "title": "Повелитель бури",
   "year": 2008,
   "similarity": 0.528
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.476
  },
  {
   "key": "tmdb:97630",
   "workId": "f-tmdb97630",
   "title": "Цель номер один",
   "year": 2012,
   "similarity": 0.439
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.423
  }
 ],
 "tmdb:1382": [
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.555
  },
  {
   "key": "tmdb:121986",
   "workId": "f-tmdb121986",
   "title": "Милая Фрэнсис",
   "year": 2013,
   "similarity": 0.515
  },
  {
   "key": "tmdb:9081",
   "workId": "f-tmdb9081",
   "title": "Пробуждение жизни",
   "year": 2001,
   "similarity": 0.448
  },
  {
   "key": "tmdb:11446",
   "workId": "f-tmdb11446",
   "title": "Добро пожаловать в кукольный дом",
   "year": 1996,
   "similarity": 0.435
  },
  {
   "key": "tmdb:343",
   "workId": "f-tmdb343",
   "title": "Гарольд и Мод",
   "year": 1971,
   "similarity": 0.435
  }
 ],
 "tmdb:13891": [
  {
   "key": "tmdb:37080",
   "workId": "f-tmdb37080",
   "title": "Мать и дитя",
   "year": 2009,
   "similarity": 0.422
  },
  {
   "key": "tmdb:11300",
   "workId": "f-tmdb11300",
   "title": "Дикая штучка",
   "year": 1986,
   "similarity": 0.42
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.418
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.389
  },
  {
   "key": "tmdb:27327",
   "workId": "f-tmdb27327",
   "title": "Призрак рая",
   "year": 1974,
   "similarity": 0.386
  }
 ],
 "tmdb:1391": [
  {
   "key": "tmdb:25188",
   "workId": "f-tmdb25188",
   "title": "Последний киносеанс",
   "year": 1971,
   "similarity": 0.437
  },
  {
   "key": "tmdb:68924",
   "workId": "f-tmdb68924",
   "title": "Ледяной ветер",
   "year": 1997,
   "similarity": 0.401
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.37
  },
  {
   "key": "tmdb:16153",
   "workId": "f-tmdb16153",
   "title": "Алиса здесь больше не живет",
   "year": 1974,
   "similarity": 0.368
  },
  {
   "key": "tmdb:9675",
   "workId": "f-tmdb9675",
   "title": "На обочине",
   "year": 2004,
   "similarity": 0.339
  }
 ],
 "tmdb:1396": [
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.697
  },
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.572
  },
  {
   "key": "tmdb:1398",
   "workId": "l-tmdb1398",
   "title": "Сталкер",
   "year": 1979,
   "similarity": 0.552
  },
  {
   "key": "tmdb:144",
   "workId": "f-tmdb144",
   "title": "Небо над Берлином",
   "year": 1987,
   "similarity": 0.552
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.533
  }
 ],
 "tmdb:1398": [
  {
   "key": "tmdb:593",
   "workId": "w06",
   "title": "Солярис",
   "year": 1972,
   "similarity": 0.615
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.552
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.505
  },
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.473
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.465
  }
 ],
 "tmdb:13998": [
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.526
  },
  {
   "key": "tmdb:38810",
   "workId": "f-tmdb38810",
   "title": "Клык",
   "year": 2009,
   "similarity": 0.495
  },
  {
   "key": "tmdb:1412",
   "workId": "f-tmdb1412",
   "title": "Секс, ложь и видео",
   "year": 1989,
   "similarity": 0.475
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.463
  },
  {
   "key": "tmdb:27845",
   "workId": "f-tmdb27845",
   "title": "Истина в вине",
   "year": 1996,
   "similarity": 0.459
  }
 ],
 "tmdb:14": [
  {
   "key": "tmdb:334",
   "workId": "f-tmdb334",
   "title": "Магнолия",
   "year": 1999,
   "similarity": 0.513
  },
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.487
  },
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.469
  },
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.461
  },
  {
   "key": "tmdb:550",
   "workId": "u-kp361",
   "title": "Бойцовский клуб",
   "year": 1999,
   "similarity": 0.451
  }
 ],
 "tmdb:14022": [
  {
   "key": "tmdb:27845",
   "workId": "f-tmdb27845",
   "title": "Истина в вине",
   "year": 1996,
   "similarity": 0.401
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.377
  },
  {
   "key": "tmdb:4495",
   "workId": "f-tmdb4495",
   "title": "Дух улья",
   "year": 1973,
   "similarity": 0.377
  },
  {
   "key": "tmdb:27236",
   "workId": "f-tmdb27236",
   "title": "Двухполосное шоссе",
   "year": 1971,
   "similarity": 0.338
  },
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.326
  }
 ],
 "tmdb:14048": [
  {
   "key": "tmdb:25468",
   "workId": "f-tmdb25468",
   "title": "Мой ужин с Андре",
   "year": 1981,
   "similarity": 0.335
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.302
  },
  {
   "key": "tmdb:2013",
   "workId": "f-tmdb2013",
   "title": "Скафандр и бабочка",
   "year": 2007,
   "similarity": 0.297
  },
  {
   "key": "tmdb:121986",
   "workId": "f-tmdb121986",
   "title": "Милая Фрэнсис",
   "year": 2013,
   "similarity": 0.292
  },
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.281
  }
 ],
 "tmdb:141": [
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.647
  },
  {
   "key": "tmdb:550",
   "workId": "u-kp361",
   "title": "Бойцовский клуб",
   "year": 1999,
   "similarity": 0.56
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.502
  },
  {
   "key": "tmdb:63",
   "workId": "f-tmdb63",
   "title": "12 обезьян",
   "year": 1995,
   "similarity": 0.455
  },
  {
   "key": "tmdb:104",
   "workId": "f-tmdb104",
   "title": "Беги, Лола, беги",
   "year": 1998,
   "similarity": 0.404
  }
 ],
 "tmdb:1412": [
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.485
  },
  {
   "key": "tmdb:31121",
   "workId": "f-tmdb31121",
   "title": "Шампунь",
   "year": 1975,
   "similarity": 0.482
  },
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.475
  },
  {
   "key": "tmdb:649",
   "workId": "f-tmdb649",
   "title": "Дневная красавица",
   "year": 1967,
   "similarity": 0.439
  },
  {
   "key": "tmdb:37080",
   "workId": "f-tmdb37080",
   "title": "Мать и дитя",
   "year": 2009,
   "similarity": 0.407
  }
 ],
 "tmdb:14139": [
  {
   "key": "tmdb:14337",
   "workId": "c-primer",
   "title": "Детонатор",
   "year": 2004,
   "similarity": 0.596
  },
  {
   "key": "tmdb:26466",
   "workId": "l-tmdb26466",
   "title": "Треугольник",
   "year": 2009,
   "similarity": 0.522
  },
  {
   "key": "tmdb:63",
   "workId": "f-tmdb63",
   "title": "12 обезьян",
   "year": 1995,
   "similarity": 0.45
  },
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.357
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.349
  }
 ],
 "tmdb:1417": [
  {
   "key": "tmdb:2668",
   "workId": "l-tmdb2668",
   "title": "Сонная лощина",
   "year": 1999,
   "similarity": 0.291
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.286
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.274
  },
  {
   "key": "tmdb:194",
   "workId": "f-tmdb194",
   "title": "Амели",
   "year": 2001,
   "similarity": 0.274
  },
  {
   "key": "tmdb:9693",
   "workId": "f-tmdb9693",
   "title": "Дитя человеческое",
   "year": 2006,
   "similarity": 0.269
  }
 ],
 "tmdb:1422": [
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.595
  },
  {
   "key": "tmdb:322",
   "workId": "f-tmdb322",
   "title": "Таинственная река",
   "year": 2003,
   "similarity": 0.554
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.528
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.462
  },
  {
   "key": "tmdb:238",
   "workId": "f-tmdb238",
   "title": "Крёстный отец",
   "year": 1972,
   "similarity": 0.447
  }
 ],
 "tmdb:1427": [
  {
   "key": "tmdb:86825",
   "workId": "f-tmdb86825",
   "title": "Порочные игры",
   "year": 2013,
   "similarity": 0.309
  },
  {
   "key": "tmdb:82507",
   "workId": "l-tmdb82507",
   "title": "Синистер",
   "year": 2012,
   "similarity": 0.258
  }
 ],
 "tmdb:14275": [
  {
   "key": "tmdb:157386",
   "workId": "f-tmdb157386",
   "title": "Захватывающее время",
   "year": 2013,
   "similarity": 0.359
  },
  {
   "key": "tmdb:25188",
   "workId": "f-tmdb25188",
   "title": "Последний киносеанс",
   "year": 1971,
   "similarity": 0.35
  },
  {
   "key": "tmdb:7859",
   "workId": "f-tmdb7859",
   "title": "Полу-Нельсон",
   "year": 2006,
   "similarity": 0.34
  },
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.339
  },
  {
   "key": "tmdb:207",
   "workId": "f-tmdb207",
   "title": "Общество мёртвых поэтов",
   "year": 1989,
   "similarity": 0.257
  }
 ],
 "tmdb:14285": [
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.332
  },
  {
   "key": "tmdb:10633",
   "workId": "f-tmdb10633",
   "title": "Полуночная жара",
   "year": 1967,
   "similarity": 0.322
  },
  {
   "key": "tmdb:33324",
   "workId": "f-tmdb33324",
   "title": "Округ Харлан, США",
   "year": 1976,
   "similarity": 0.273
  },
  {
   "key": "tmdb:21734",
   "workId": "f-tmdb21734",
   "title": "Тень сомнения",
   "year": 1943,
   "similarity": 0.261
  },
  {
   "key": "tmdb:17057",
   "workId": "f-tmdb17057",
   "title": "В укромном месте",
   "year": 1950,
   "similarity": 0.259
  }
 ],
 "tmdb:14295": [
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.397
  },
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.379
  },
  {
   "key": "tmdb:301",
   "workId": "f-tmdb301",
   "title": "Рио Браво",
   "year": 1959,
   "similarity": 0.325
  },
  {
   "key": "tmdb:12573",
   "workId": "f-tmdb12573",
   "title": "Серьёзный человек",
   "year": 2009,
   "similarity": 0.323
  },
  {
   "key": "tmdb:666",
   "workId": "f-tmdb666",
   "title": "Центральный вокзал",
   "year": 1998,
   "similarity": 0.305
  }
 ],
 "tmdb:143": [
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.646
  },
  {
   "key": "tmdb:31657",
   "workId": "f-tmdb31657",
   "title": "Возвращение домой",
   "year": 1978,
   "similarity": 0.571
  },
  {
   "key": "tmdb:975",
   "workId": "f-tmdb975",
   "title": "Тропы славы",
   "year": 1957,
   "similarity": 0.554
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.543
  },
  {
   "key": "tmdb:2440",
   "workId": "f-tmdb2440",
   "title": "Объединённая зона безопасности",
   "year": 2000,
   "similarity": 0.517
  }
 ],
 "tmdb:14337": [
  {
   "key": "tmdb:14139",
   "workId": "c-timecrimes",
   "title": "Временная петля",
   "year": 2007,
   "similarity": 0.596
  },
  {
   "key": "tmdb:26466",
   "workId": "l-tmdb26466",
   "title": "Треугольник",
   "year": 2009,
   "similarity": 0.457
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.426
  },
  {
   "key": "tmdb:63",
   "workId": "f-tmdb63",
   "title": "12 обезьян",
   "year": 1995,
   "similarity": 0.42
  },
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.385
  }
 ],
 "tmdb:14372": [
  {
   "key": "tmdb:2756",
   "workId": "f-tmdb2756",
   "title": "Бездна",
   "year": 1989,
   "similarity": 0.408
  },
  {
   "key": "tmdb:754",
   "workId": "f-tmdb754",
   "title": "Без лица",
   "year": 1997,
   "similarity": 0.406
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.381
  },
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.35
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.338
  }
 ],
 "tmdb:144": [
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.552
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.548
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.495
  },
  {
   "key": "tmdb:11710",
   "workId": "f-tmdb11710",
   "title": "Каждый за себя, а Бог против всех",
   "year": 1974,
   "similarity": 0.438
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.42
  }
 ],
 "tmdb:1443": [
  {
   "key": "tmdb:68924",
   "workId": "f-tmdb68924",
   "title": "Ледяной ветер",
   "year": 1997,
   "similarity": 0.507
  },
  {
   "key": "tmdb:153",
   "workId": "f-tmdb153",
   "title": "Трудности перевода",
   "year": 2003,
   "similarity": 0.5
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.43
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.398
  },
  {
   "key": "tmdb:10683",
   "workId": "f-tmdb10683",
   "title": "Счастье",
   "year": 1998,
   "similarity": 0.381
  }
 ],
 "tmdb:1444": [
  {
   "key": "tmdb:1382",
   "workId": "f-tmdb1382",
   "title": "Я и ты и все, кого мы знаем",
   "year": 2005,
   "similarity": 0.555
  },
  {
   "key": "tmdb:11698",
   "workId": "f-tmdb11698",
   "title": "Строшек",
   "year": 1977,
   "similarity": 0.532
  },
  {
   "key": "tmdb:76",
   "workId": "f-tmdb76",
   "title": "Перед рассветом",
   "year": 1995,
   "similarity": 0.482
  },
  {
   "key": "tmdb:343",
   "workId": "f-tmdb343",
   "title": "Гарольд и Мод",
   "year": 1971,
   "similarity": 0.447
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.446
  }
 ],
 "tmdb:145": [
  {
   "key": "tmdb:68722",
   "workId": "f-tmdb68722",
   "title": "Мастер",
   "year": 2012,
   "similarity": 0.529
  },
  {
   "key": "tmdb:452",
   "workId": "f-tmdb452",
   "title": "Идиоты",
   "year": 1998,
   "similarity": 0.5
  },
  {
   "key": "tmdb:17609",
   "workId": "f-tmdb17609",
   "title": "Антихрист",
   "year": 2009,
   "similarity": 0.446
  },
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.43
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.391
  }
 ],
 "tmdb:145197": [
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.475
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.452
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.439
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.411
  },
  {
   "key": "tmdb:77987",
   "workId": "f-tmdb77987",
   "title": "Только бог простит",
   "year": 2013,
   "similarity": 0.404
  }
 ],
 "tmdb:14537": [
  {
   "key": "tmdb:11953",
   "workId": "f-tmdb11953",
   "title": "Кагемуся: Тень воина",
   "year": 1980,
   "similarity": 0.661
  },
  {
   "key": "tmdb:548",
   "workId": "w02",
   "title": "Расёмон",
   "year": 1950,
   "similarity": 0.582
  },
  {
   "key": "tmdb:12493",
   "workId": "f-tmdb12493",
   "title": "Рай и ад",
   "year": 1963,
   "similarity": 0.542
  },
  {
   "key": "tmdb:11712",
   "workId": "f-tmdb11712",
   "title": "Телохранитель 2: Отважный Сандзюро",
   "year": 1962,
   "similarity": 0.529
  },
  {
   "key": "tmdb:346",
   "workId": "f-tmdb346",
   "title": "Семь Самураев",
   "year": 1954,
   "similarity": 0.527
  }
 ],
 "tmdb:14585": [
  {
   "key": "tmdb:82693",
   "workId": "f-tmdb82693",
   "title": "Мой парень – псих",
   "year": 2012,
   "similarity": 0.256
  },
  {
   "key": "tmdb:10758",
   "workId": "f-tmdb10758",
   "title": "Официантка",
   "year": 2007,
   "similarity": 0.255
  }
 ],
 "tmdb:146233": [
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.555
  },
  {
   "key": "tmdb:322",
   "workId": "f-tmdb322",
   "title": "Таинственная река",
   "year": 2003,
   "similarity": 0.548
  },
  {
   "key": "tmdb:11423",
   "workId": "c-memories",
   "title": "Воспоминания об убийстве",
   "year": 2003,
   "similarity": 0.503
  },
  {
   "key": "tmdb:2118",
   "workId": "f-tmdb2118",
   "title": "Секреты Лос-Анджелеса",
   "year": 1997,
   "similarity": 0.477
  },
  {
   "key": "tmdb:1949",
   "workId": "c-zodiac",
   "title": "Зодиак",
   "year": 2007,
   "similarity": 0.473
  }
 ],
 "tmdb:147": [
  {
   "key": "tmdb:405",
   "workId": "f-tmdb405",
   "title": "Дорога",
   "year": 1954,
   "similarity": 0.466
  },
  {
   "key": "tmdb:5156",
   "workId": "f-tmdb5156",
   "title": "Похитители велосипедов",
   "year": 1948,
   "similarity": 0.438
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.386
  },
  {
   "key": "tmdb:18148",
   "workId": "f-tmdb18148",
   "title": "Токийская повесть",
   "year": 1953,
   "similarity": 0.379
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.374
  }
 ],
 "tmdb:1480": [
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.612
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.55
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.549
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.548
  },
  {
   "key": "tmdb:832",
   "workId": "f-tmdb832",
   "title": "М убийца",
   "year": 1931,
   "similarity": 0.52
  }
 ],
 "tmdb:1487": [
  {
   "key": "tmdb:1724",
   "workId": "f-tmdb1724",
   "title": "Невероятный Халк",
   "year": 2008,
   "similarity": 0.73
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.687
  },
  {
   "key": "tmdb:558",
   "workId": "f-tmdb558",
   "title": "Человек-паук 2",
   "year": 2004,
   "similarity": 0.672
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.672
  },
  {
   "key": "tmdb:49521",
   "workId": "f-tmdb49521",
   "title": "Человек из стали",
   "year": 2013,
   "similarity": 0.646
  }
 ],
 "tmdb:14886": [
  {
   "key": "tmdb:16153",
   "workId": "f-tmdb16153",
   "title": "Алиса здесь больше не живет",
   "year": 1974,
   "similarity": 0.524
  },
  {
   "key": "tmdb:3133",
   "workId": "f-tmdb3133",
   "title": "Пустоши",
   "year": 1973,
   "similarity": 0.352
  },
  {
   "key": "tmdb:655",
   "workId": "f-tmdb655",
   "title": "Париж, Техас",
   "year": 1984,
   "similarity": 0.329
  },
  {
   "key": "tmdb:11293",
   "workId": "f-tmdb11293",
   "title": "Бумажная луна",
   "year": 1973,
   "similarity": 0.319
  },
  {
   "key": "tmdb:17365",
   "workId": "f-tmdb17365",
   "title": "Заговор «Параллакс»",
   "year": 1974,
   "similarity": 0.289
  }
 ],
 "tmdb:1495": [
  {
   "key": "tmdb:11416",
   "workId": "f-tmdb11416",
   "title": "Миссия",
   "year": 1986,
   "similarity": 0.494
  },
  {
   "key": "tmdb:616",
   "workId": "f-tmdb616",
   "title": "Последний самурай",
   "year": 2003,
   "similarity": 0.477
  },
  {
   "key": "tmdb:8619",
   "workId": "f-tmdb8619",
   "title": "Хозяин морей: На краю Земли",
   "year": 2003,
   "similarity": 0.46
  },
  {
   "key": "tmdb:32985",
   "workId": "l-tmdb32985",
   "title": "Соломон Кейн",
   "year": 2009,
   "similarity": 0.459
  },
  {
   "key": "tmdb:57212",
   "workId": "f-tmdb57212",
   "title": "Боевой конь",
   "year": 2011,
   "similarity": 0.409
  }
 ],
 "tmdb:15": [
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.443
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.435
  },
  {
   "key": "tmdb:426",
   "workId": "f-tmdb426",
   "title": "Головокружение",
   "year": 1958,
   "similarity": 0.414
  },
  {
   "key": "tmdb:599",
   "workId": "f-tmdb599",
   "title": "Сансет бульвар",
   "year": 1950,
   "similarity": 0.409
  },
  {
   "key": "tmdb:1578",
   "workId": "f-tmdb1578",
   "title": "Бешеный бык",
   "year": 1980,
   "similarity": 0.405
  }
 ],
 "tmdb:15144": [
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.623
  },
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.606
  },
  {
   "key": "tmdb:621",
   "workId": "f-tmdb621",
   "title": "Бриолин",
   "year": 1978,
   "similarity": 0.606
  },
  {
   "key": "tmdb:1584",
   "workId": "f-tmdb1584",
   "title": "Школа рока",
   "year": 2003,
   "similarity": 0.589
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.499
  }
 ],
 "tmdb:15244": [
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.514
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.495
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.475
  },
  {
   "key": "tmdb:803",
   "workId": "f-tmdb803",
   "title": "Ночь и туман",
   "year": 1956,
   "similarity": 0.469
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.459
  }
 ],
 "tmdb:153": [
  {
   "key": "tmdb:1443",
   "workId": "f-tmdb1443",
   "title": "Девственницы-самоубийцы",
   "year": 2000,
   "similarity": 0.5
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.409
  },
  {
   "key": "tmdb:8051",
   "workId": "f-tmdb8051",
   "title": "Любовь, сбивающая с ног",
   "year": 2002,
   "similarity": 0.408
  },
  {
   "key": "tmdb:843",
   "workId": "f-tmdb843",
   "title": "Любовное настроение",
   "year": 2000,
   "similarity": 0.39
  },
  {
   "key": "tmdb:9675",
   "workId": "f-tmdb9675",
   "title": "На обочине",
   "year": 2004,
   "similarity": 0.37
  }
 ],
 "tmdb:1538": [
  {
   "key": "tmdb:949",
   "workId": "f-tmdb949",
   "title": "Схватка",
   "year": 1995,
   "similarity": 0.425
  },
  {
   "key": "tmdb:2118",
   "workId": "f-tmdb2118",
   "title": "Секреты Лос-Анджелеса",
   "year": 1997,
   "similarity": 0.412
  },
  {
   "key": "tmdb:23168",
   "workId": "f-tmdb23168",
   "title": "Город воров",
   "year": 2010,
   "similarity": 0.401
  },
  {
   "key": "tmdb:2649",
   "workId": "u-kp12198",
   "title": "Игра",
   "year": 1997,
   "similarity": 0.392
  },
  {
   "key": "tmdb:1051",
   "workId": "f-tmdb1051",
   "title": "Французский связной",
   "year": 1971,
   "similarity": 0.382
  }
 ],
 "tmdb:155": [
  {
   "key": "tmdb:49026",
   "workId": "f-tmdb49026",
   "title": "Тёмный рыцарь: Возрождение легенды",
   "year": 2012,
   "similarity": 0.802
  },
  {
   "key": "tmdb:272",
   "workId": "f-tmdb272",
   "title": "Бэтмен: Начало",
   "year": 2005,
   "similarity": 0.791
  },
  {
   "key": "tmdb:13183",
   "workId": "f-tmdb13183",
   "title": "Хранители",
   "year": 2009,
   "similarity": 0.676
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.641
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.596
  }
 ],
 "tmdb:15516": [
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.543
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.541
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.532
  },
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.469
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.464
  }
 ],
 "tmdb:157354": [
  {
   "key": "tmdb:45317",
   "workId": "f-tmdb45317",
   "title": "Боец",
   "year": 2010,
   "similarity": 0.442
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.424
  },
  {
   "key": "tmdb:76203",
   "workId": "f-tmdb76203",
   "title": "12 лет рабства",
   "year": 2013,
   "similarity": 0.371
  },
  {
   "key": "tmdb:9008",
   "workId": "f-tmdb9008",
   "title": "Свой человек",
   "year": 1999,
   "similarity": 0.349
  },
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.317
  }
 ],
 "tmdb:157386": [
  {
   "key": "tmdb:15144",
   "workId": "f-tmdb15144",
   "title": "Шестнадцать свечей",
   "year": 1984,
   "similarity": 0.491
  },
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.462
  },
  {
   "key": "tmdb:27845",
   "workId": "f-tmdb27845",
   "title": "Истина в вине",
   "year": 1996,
   "similarity": 0.456
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.455
  },
  {
   "key": "tmdb:11446",
   "workId": "f-tmdb11446",
   "title": "Добро пожаловать в кукольный дом",
   "year": 1996,
   "similarity": 0.443
  }
 ],
 "tmdb:1578": [
  {
   "key": "tmdb:475",
   "workId": "f-tmdb475",
   "title": "Бонни и Клайд",
   "year": 1967,
   "similarity": 0.479
  },
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.468
  },
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.46
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.451
  },
  {
   "key": "tmdb:990",
   "workId": "f-tmdb990",
   "title": "Бильярдист",
   "year": 1961,
   "similarity": 0.446
  }
 ],
 "tmdb:15794": [
  {
   "key": "tmdb:934",
   "workId": "f-tmdb934",
   "title": "Мужские разборки",
   "year": 1955,
   "similarity": 0.514
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.511
  },
  {
   "key": "tmdb:832",
   "workId": "f-tmdb832",
   "title": "М убийца",
   "year": 1931,
   "similarity": 0.461
  },
  {
   "key": "tmdb:845",
   "workId": "f-tmdb845",
   "title": "Незнакомцы в поезде",
   "year": 1951,
   "similarity": 0.446
  },
  {
   "key": "tmdb:12493",
   "workId": "f-tmdb12493",
   "title": "Рай и ад",
   "year": 1963,
   "similarity": 0.43
  }
 ],
 "tmdb:1580": [
  {
   "key": "tmdb:845",
   "workId": "f-tmdb845",
   "title": "Незнакомцы в поезде",
   "year": 1951,
   "similarity": 0.462
  },
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.386
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.378
  },
  {
   "key": "tmdb:567",
   "workId": "f-tmdb567",
   "title": "Окно во двор",
   "year": 1954,
   "similarity": 0.363
  },
  {
   "key": "tmdb:539",
   "workId": "f-tmdb539",
   "title": "Психо",
   "year": 1960,
   "similarity": 0.36
  }
 ],
 "tmdb:158011": [
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.657
  },
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.601
  },
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.546
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.514
  },
  {
   "key": "tmdb:82507",
   "workId": "l-tmdb82507",
   "title": "Синистер",
   "year": 2012,
   "similarity": 0.488
  }
 ],
 "tmdb:1584": [
  {
   "key": "tmdb:15144",
   "workId": "f-tmdb15144",
   "title": "Шестнадцать свечей",
   "year": 1984,
   "similarity": 0.589
  },
  {
   "key": "tmdb:621",
   "workId": "f-tmdb621",
   "title": "Бриолин",
   "year": 1978,
   "similarity": 0.535
  },
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.518
  },
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.458
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.445
  }
 ],
 "tmdb:1585": [
  {
   "key": "tmdb:909",
   "workId": "f-tmdb909",
   "title": "Встреть меня в Сент-Луисе",
   "year": 1944,
   "similarity": 0.606
  },
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.47
  },
  {
   "key": "tmdb:16619",
   "workId": "f-tmdb16619",
   "title": "Обыкновенные люди",
   "year": 1980,
   "similarity": 0.433
  },
  {
   "key": "tmdb:3083",
   "workId": "f-tmdb3083",
   "title": "Мистер Смит едет в Вашингтон",
   "year": 1939,
   "similarity": 0.415
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.408
  }
 ],
 "tmdb:1598": [
  {
   "key": "tmdb:1700",
   "workId": "f-tmdb1700",
   "title": "Мизери",
   "year": 1990,
   "similarity": 0.383
  },
  {
   "key": "tmdb:7340",
   "workId": "f-tmdb7340",
   "title": "Кэрри",
   "year": 1976,
   "similarity": 0.324
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.319
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.315
  },
  {
   "key": "tmdb:2652",
   "workId": "l-tmdb2652",
   "title": "Леденец",
   "year": 2006,
   "similarity": 0.312
  }
 ],
 "tmdb:1599": [
  {
   "key": "tmdb:4944",
   "workId": "f-tmdb4944",
   "title": "После прочтения сжечь",
   "year": 2008,
   "similarity": 0.365
  },
  {
   "key": "tmdb:12573",
   "workId": "f-tmdb12573",
   "title": "Серьёзный человек",
   "year": 2009,
   "similarity": 0.331
  },
  {
   "key": "tmdb:1382",
   "workId": "f-tmdb1382",
   "title": "Я и ты и все, кого мы знаем",
   "year": 2005,
   "similarity": 0.325
  },
  {
   "key": "tmdb:8051",
   "workId": "f-tmdb8051",
   "title": "Любовь, сбивающая с ног",
   "year": 2002,
   "similarity": 0.322
  },
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.319
  }
 ],
 "tmdb:16": [
  {
   "key": "tmdb:553",
   "workId": "f-tmdb553",
   "title": "Догвилль",
   "year": 2003,
   "similarity": 0.378
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.353
  },
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.32
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.296
  },
  {
   "key": "tmdb:8051",
   "workId": "f-tmdb8051",
   "title": "Любовь, сбивающая с ног",
   "year": 2002,
   "similarity": 0.294
  }
 ],
 "tmdb:1600": [
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.525
  },
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.508
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.5
  },
  {
   "key": "tmdb:144",
   "workId": "f-tmdb144",
   "title": "Небо над Берлином",
   "year": 1987,
   "similarity": 0.495
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.482
  }
 ],
 "tmdb:161": [
  {
   "key": "tmdb:75656",
   "workId": "u-kp522892",
   "title": "Иллюзия обмана",
   "year": 2013,
   "similarity": 0.456
  },
  {
   "key": "tmdb:5503",
   "workId": "f-tmdb5503",
   "title": "Беглец",
   "year": 1993,
   "similarity": 0.454
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.45
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.39
  },
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.382
  }
 ],
 "tmdb:16153": [
  {
   "key": "tmdb:14886",
   "workId": "f-tmdb14886",
   "title": "Последний наряд",
   "year": 1973,
   "similarity": 0.524
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.375
  },
  {
   "key": "tmdb:1391",
   "workId": "f-tmdb1391",
   "title": "И твою маму тоже",
   "year": 2001,
   "similarity": 0.368
  },
  {
   "key": "tmdb:1653",
   "workId": "f-tmdb1653",
   "title": "Дневники мотоциклиста",
   "year": 2004,
   "similarity": 0.339
  },
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.339
  }
 ],
 "tmdb:1626": [
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.585
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.529
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.515
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.505
  },
  {
   "key": "tmdb:15244",
   "workId": "f-tmdb15244",
   "title": "Приговоренный к смерти бежал, или Дух веет, где хочет",
   "year": 1956,
   "similarity": 0.495
  }
 ],
 "tmdb:1628": [
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.518
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.483
  },
  {
   "key": "tmdb:5544",
   "workId": "f-tmdb5544",
   "title": "Хиросима, любовь моя",
   "year": 1959,
   "similarity": 0.463
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.462
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.46
  }
 ],
 "tmdb:16305": [
  {
   "key": "tmdb:3086",
   "workId": "f-tmdb3086",
   "title": "Леди Ева",
   "year": 1941,
   "similarity": 0.468
  },
  {
   "key": "tmdb:3082",
   "workId": "f-tmdb3082",
   "title": "Новые времена",
   "year": 1936,
   "similarity": 0.456
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.398
  },
  {
   "key": "tmdb:961",
   "workId": "f-tmdb961",
   "title": "Паровоз Генерал",
   "year": 1926,
   "similarity": 0.362
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.343
  }
 ],
 "tmdb:16307": [
  {
   "key": "tmdb:7340",
   "workId": "f-tmdb7340",
   "title": "Кэрри",
   "year": 1976,
   "similarity": 0.479
  },
  {
   "key": "tmdb:805",
   "workId": "f-tmdb805",
   "title": "Ребёнок Розмари",
   "year": 1968,
   "similarity": 0.438
  },
  {
   "key": "tmdb:17609",
   "workId": "f-tmdb17609",
   "title": "Антихрист",
   "year": 2009,
   "similarity": 0.42
  },
  {
   "key": "tmdb:74725",
   "workId": "c-kill-list",
   "title": "Список смертников",
   "year": 2011,
   "similarity": 0.4
  },
  {
   "key": "tmdb:9552",
   "workId": "f-tmdb9552",
   "title": "Изгоняющий дьявола",
   "year": 1973,
   "similarity": 0.388
  }
 ],
 "tmdb:1632": [
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.459
  },
  {
   "key": "tmdb:76203",
   "workId": "f-tmdb76203",
   "title": "12 лет рабства",
   "year": 2013,
   "similarity": 0.441
  },
  {
   "key": "tmdb:10633",
   "workId": "f-tmdb10633",
   "title": "Полуночная жара",
   "year": 1967,
   "similarity": 0.438
  },
  {
   "key": "tmdb:9008",
   "workId": "f-tmdb9008",
   "title": "Свой человек",
   "year": 1999,
   "similarity": 0.427
  },
  {
   "key": "tmdb:157354",
   "workId": "f-tmdb157354",
   "title": "Станция «Фрутвейл»",
   "year": 2013,
   "similarity": 0.424
  }
 ],
 "tmdb:16320": [
  {
   "key": "tmdb:18",
   "workId": "f-tmdb18",
   "title": "Пятый элемент",
   "year": 1997,
   "similarity": 0.405
  },
  {
   "key": "tmdb:7299",
   "workId": "u-kp309",
   "title": "Эквилибриум",
   "year": 2002,
   "similarity": 0.366
  },
  {
   "key": "tmdb:24428",
   "workId": "f-tmdb24428",
   "title": "Мстители",
   "year": 2012,
   "similarity": 0.337
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.326
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.326
  }
 ],
 "tmdb:1637": [
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.743
  },
  {
   "key": "tmdb:36955",
   "workId": "f-tmdb36955",
   "title": "Правдивая ложь",
   "year": 1994,
   "similarity": 0.675
  },
  {
   "key": "tmdb:754",
   "workId": "f-tmdb754",
   "title": "Без лица",
   "year": 1997,
   "similarity": 0.674
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.642
  },
  {
   "key": "tmdb:744",
   "workId": "f-tmdb744",
   "title": "Лучший стрелок",
   "year": 1986,
   "similarity": 0.633
  }
 ],
 "tmdb:16391": [
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.525
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.48
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.47
  },
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.467
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.454
  }
 ],
 "tmdb:1640": [
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.546
  },
  {
   "key": "tmdb:13223",
   "workId": "f-tmdb13223",
   "title": "Гран Торино",
   "year": 2008,
   "similarity": 0.523
  },
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.451
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.403
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.393
  }
 ],
 "tmdb:16523": [
  {
   "key": "tmdb:1382",
   "workId": "f-tmdb1382",
   "title": "Я и ты и все, кого мы знаем",
   "year": 2005,
   "similarity": 0.404
  },
  {
   "key": "tmdb:83666",
   "workId": "f-tmdb83666",
   "title": "Королевство полной луны",
   "year": 2012,
   "similarity": 0.343
  },
  {
   "key": "tmdb:38810",
   "workId": "f-tmdb38810",
   "title": "Клык",
   "year": 2009,
   "similarity": 0.34
  },
  {
   "key": "tmdb:86825",
   "workId": "f-tmdb86825",
   "title": "Порочные игры",
   "year": 2013,
   "similarity": 0.323
  },
  {
   "key": "tmdb:8967",
   "workId": "f-tmdb8967",
   "title": "Древо жизни",
   "year": 2011,
   "similarity": 0.317
  }
 ],
 "tmdb:1653": [
  {
   "key": "tmdb:6106",
   "workId": "f-tmdb6106",
   "title": "Сальвадор",
   "year": 1986,
   "similarity": 0.532
  },
  {
   "key": "tmdb:598",
   "workId": "f-tmdb598",
   "title": "Город бога",
   "year": 2002,
   "similarity": 0.407
  },
  {
   "key": "tmdb:666",
   "workId": "f-tmdb666",
   "title": "Центральный вокзал",
   "year": 1998,
   "similarity": 0.396
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.392
  },
  {
   "key": "tmdb:2013",
   "workId": "f-tmdb2013",
   "title": "Скафандр и бабочка",
   "year": 2007,
   "similarity": 0.376
  }
 ],
 "tmdb:1654": [
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.607
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.444
  },
  {
   "key": "tmdb:792",
   "workId": "f-tmdb792",
   "title": "Взвод",
   "year": 1986,
   "similarity": 0.426
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.421
  },
  {
   "key": "tmdb:16869",
   "workId": "f-tmdb16869",
   "title": "Бесславные ублюдки",
   "year": 2009,
   "similarity": 0.409
  }
 ],
 "tmdb:16619": [
  {
   "key": "tmdb:11050",
   "workId": "f-tmdb11050",
   "title": "Язык нежности",
   "year": 1983,
   "similarity": 0.464
  },
  {
   "key": "tmdb:1585",
   "workId": "f-tmdb1585",
   "title": "Эта замечательная жизнь",
   "year": 1946,
   "similarity": 0.433
  },
  {
   "key": "tmdb:1919",
   "workId": "f-tmdb1919",
   "title": "Вдали от неё",
   "year": 2007,
   "similarity": 0.362
  },
  {
   "key": "tmdb:343",
   "workId": "f-tmdb343",
   "title": "Гарольд и Мод",
   "year": 1971,
   "similarity": 0.35
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.348
  }
 ],
 "tmdb:16642": [
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.511
  },
  {
   "key": "tmdb:3133",
   "workId": "f-tmdb3133",
   "title": "Пустоши",
   "year": 1973,
   "similarity": 0.469
  },
  {
   "key": "tmdb:2000",
   "workId": "f-tmdb2000",
   "title": "Агирре, гнев божий",
   "year": 1972,
   "similarity": 0.401
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.388
  },
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.358
  }
 ],
 "tmdb:16672": [
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.579
  },
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.577
  },
  {
   "key": "tmdb:18333",
   "workId": "f-tmdb18333",
   "title": "Час волка",
   "year": 1968,
   "similarity": 0.548
  },
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.539
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.506
  }
 ],
 "tmdb:168672": [
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.444
  },
  {
   "key": "tmdb:23168",
   "workId": "f-tmdb23168",
   "title": "Город воров",
   "year": 2010,
   "similarity": 0.394
  },
  {
   "key": "tmdb:70670",
   "workId": "u-kp526812",
   "title": "Охотники за головами",
   "year": 2011,
   "similarity": 0.376
  },
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.36
  },
  {
   "key": "tmdb:2118",
   "workId": "f-tmdb2118",
   "title": "Секреты Лос-Анджелеса",
   "year": 1997,
   "similarity": 0.343
  }
 ],
 "tmdb:16869": [
  {
   "key": "tmdb:68718",
   "workId": "f-tmdb68718",
   "title": "Джанго освобождённый",
   "year": 2012,
   "similarity": 0.58
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.542
  },
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.503
  },
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.496
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.443
  }
 ],
 "tmdb:1700": [
  {
   "key": "tmdb:694",
   "workId": "f-tmdb694",
   "title": "Сияние",
   "year": 1980,
   "similarity": 0.47
  },
  {
   "key": "tmdb:1598",
   "workId": "f-tmdb1598",
   "title": "Мыс страха",
   "year": 1991,
   "similarity": 0.383
  },
  {
   "key": "tmdb:9552",
   "workId": "f-tmdb9552",
   "title": "Изгоняющий дьявола",
   "year": 1973,
   "similarity": 0.377
  },
  {
   "key": "tmdb:539",
   "workId": "f-tmdb539",
   "title": "Психо",
   "year": 1960,
   "similarity": 0.357
  },
  {
   "key": "tmdb:274",
   "workId": "u-kp345",
   "title": "Молчание ягнят",
   "year": 1990,
   "similarity": 0.356
  }
 ],
 "tmdb:1701": [
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.743
  },
  {
   "key": "tmdb:754",
   "workId": "f-tmdb754",
   "title": "Без лица",
   "year": 1997,
   "similarity": 0.693
  },
  {
   "key": "tmdb:9802",
   "workId": "f-tmdb9802",
   "title": "Скала",
   "year": 1996,
   "similarity": 0.691
  },
  {
   "key": "tmdb:36955",
   "workId": "f-tmdb36955",
   "title": "Правдивая ложь",
   "year": 1994,
   "similarity": 0.652
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.627
  }
 ],
 "tmdb:17057": [
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.623
  },
  {
   "key": "tmdb:25736",
   "workId": "f-tmdb25736",
   "title": "Почтальон всегда звонит дважды",
   "year": 1946,
   "similarity": 0.488
  },
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.477
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.471
  },
  {
   "key": "tmdb:976",
   "workId": "f-tmdb976",
   "title": "Сладкий запах успеха",
   "year": 1957,
   "similarity": 0.465
  }
 ],
 "tmdb:17159": [
  {
   "key": "tmdb:31121",
   "workId": "f-tmdb31121",
   "title": "Шампунь",
   "year": 1975,
   "similarity": 0.332
  },
  {
   "key": "tmdb:90",
   "workId": "f-tmdb90",
   "title": "Полицейский из Беверли-Хиллз",
   "year": 1984,
   "similarity": 0.325
  },
  {
   "key": "tmdb:38319",
   "workId": "l-tmdb38319",
   "title": "Храбрые перцем",
   "year": 2011,
   "similarity": 0.325
  },
  {
   "key": "tmdb:18620",
   "workId": "f-tmdb18620",
   "title": "Go Fish",
   "year": 1994,
   "similarity": 0.324
  },
  {
   "key": "tmdb:2255",
   "workId": "f-tmdb2255",
   "title": "В погоне за Эми",
   "year": 1997,
   "similarity": 0.308
  }
 ],
 "tmdb:1724": [
  {
   "key": "tmdb:49521",
   "workId": "f-tmdb49521",
   "title": "Человек из стали",
   "year": 2013,
   "similarity": 0.818
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.793
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.775
  },
  {
   "key": "tmdb:558",
   "workId": "f-tmdb558",
   "title": "Человек-паук 2",
   "year": 2004,
   "similarity": 0.759
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.738
  }
 ],
 "tmdb:1726": [
  {
   "key": "tmdb:24428",
   "workId": "f-tmdb24428",
   "title": "Мстители",
   "year": 2012,
   "similarity": 0.812
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.801
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.779
  },
  {
   "key": "tmdb:558",
   "workId": "f-tmdb558",
   "title": "Человек-паук 2",
   "year": 2004,
   "similarity": 0.739
  },
  {
   "key": "tmdb:1724",
   "workId": "f-tmdb1724",
   "title": "Невероятный Халк",
   "year": 2008,
   "similarity": 0.738
  }
 ],
 "tmdb:17295": [
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.526
  },
  {
   "key": "tmdb:975",
   "workId": "f-tmdb975",
   "title": "Тропы славы",
   "year": 1957,
   "similarity": 0.499
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.465
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.443
  },
  {
   "key": "tmdb:643",
   "workId": "f-tmdb643",
   "title": "Броненосец Потёмкин",
   "year": 1925,
   "similarity": 0.386
  }
 ],
 "tmdb:1730": [
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.613
  },
  {
   "key": "tmdb:77987",
   "workId": "f-tmdb77987",
   "title": "Только бог простит",
   "year": 2013,
   "similarity": 0.584
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.579
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.533
  },
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.529
  }
 ],
 "tmdb:17346": [
  {
   "key": "tmdb:121986",
   "workId": "f-tmdb121986",
   "title": "Милая Фрэнсис",
   "year": 2013,
   "similarity": 0.39
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.366
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.36
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.35
  },
  {
   "key": "tmdb:69605",
   "workId": "f-tmdb69605",
   "title": "Слова, написанные на ветру",
   "year": 1956,
   "similarity": 0.343
  }
 ],
 "tmdb:17365": [
  {
   "key": "tmdb:592",
   "workId": "f-tmdb592",
   "title": "Разговор",
   "year": 1974,
   "similarity": 0.501
  },
  {
   "key": "tmdb:11644",
   "workId": "f-tmdb11644",
   "title": "Прокол",
   "year": 1981,
   "similarity": 0.477
  },
  {
   "key": "tmdb:26039",
   "workId": "f-tmdb26039",
   "title": "В упор",
   "year": 1967,
   "similarity": 0.468
  },
  {
   "key": "tmdb:10774",
   "workId": "f-tmdb10774",
   "title": "Телесеть",
   "year": 1976,
   "similarity": 0.411
  },
  {
   "key": "tmdb:15794",
   "workId": "f-tmdb15794",
   "title": "Белая горячка",
   "year": 1949,
   "similarity": 0.408
  }
 ],
 "tmdb:17431": [
  {
   "key": "tmdb:78",
   "workId": "f-tmdb78",
   "title": "Бегущий по лезвию",
   "year": 1982,
   "similarity": 0.516
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.493
  },
  {
   "key": "tmdb:9693",
   "workId": "f-tmdb9693",
   "title": "Дитя человеческое",
   "year": 2006,
   "similarity": 0.468
  },
  {
   "key": "tmdb:63",
   "workId": "f-tmdb63",
   "title": "12 обезьян",
   "year": 1995,
   "similarity": 0.453
  },
  {
   "key": "tmdb:782",
   "workId": "u-kp5012",
   "title": "Гаттака",
   "year": 1997,
   "similarity": 0.437
  }
 ],
 "tmdb:17609": [
  {
   "key": "tmdb:9540",
   "workId": "f-tmdb9540",
   "title": "Связанные насмерть",
   "year": 1988,
   "similarity": 0.489
  },
  {
   "key": "tmdb:68722",
   "workId": "f-tmdb68722",
   "title": "Мастер",
   "year": 2012,
   "similarity": 0.469
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.467
  },
  {
   "key": "tmdb:38810",
   "workId": "f-tmdb38810",
   "title": "Клык",
   "year": 2009,
   "similarity": 0.462
  },
  {
   "key": "tmdb:77987",
   "workId": "f-tmdb77987",
   "title": "Только бог простит",
   "year": 2013,
   "similarity": 0.459
  }
 ],
 "tmdb:17654": [
  {
   "key": "tmdb:9693",
   "workId": "f-tmdb9693",
   "title": "Дитя человеческое",
   "year": 2006,
   "similarity": 0.306
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.281
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.279
  },
  {
   "key": "tmdb:22970",
   "workId": "l-tmdb22970",
   "title": "Хижина в лесу",
   "year": 2012,
   "similarity": 0.278
  },
  {
   "key": "tmdb:17431",
   "workId": "l-tmdb17431",
   "title": "Луна 2112",
   "year": 2009,
   "similarity": 0.268
  }
 ],
 "tmdb:1779": [
  {
   "key": "tmdb:12626",
   "workId": "f-tmdb12626",
   "title": "Теленовости",
   "year": 1987,
   "similarity": 0.341
  },
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.309
  },
  {
   "key": "tmdb:9388",
   "workId": "f-tmdb9388",
   "title": "Здесь курят",
   "year": 2005,
   "similarity": 0.278
  },
  {
   "key": "tmdb:501",
   "workId": "f-tmdb501",
   "title": "Человек гризли",
   "year": 2005,
   "similarity": 0.277
  },
  {
   "key": "tmdb:10858",
   "workId": "f-tmdb10858",
   "title": "Никсон",
   "year": 1995,
   "similarity": 0.272
  }
 ],
 "tmdb:17814": [
  {
   "key": "tmdb:10331",
   "workId": "f-tmdb10331",
   "title": "Ночь живых мертвецов",
   "year": 1968,
   "similarity": 0.489
  },
  {
   "key": "tmdb:923",
   "workId": "f-tmdb923",
   "title": "Рассвет мертвецов",
   "year": 1978,
   "similarity": 0.459
  },
  {
   "key": "tmdb:1103",
   "workId": "f-tmdb1103",
   "title": "Побег из Нью-Йорка",
   "year": 1981,
   "similarity": 0.446
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.43
  },
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.373
  }
 ],
 "tmdb:1786": [
  {
   "key": "tmdb:803",
   "workId": "f-tmdb803",
   "title": "Ночь и туман",
   "year": 1956,
   "similarity": 0.459
  },
  {
   "key": "tmdb:637",
   "workId": "f-tmdb637",
   "title": "Жизнь прекрасна",
   "year": 1997,
   "similarity": 0.439
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.396
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.395
  },
  {
   "key": "tmdb:8055",
   "workId": "f-tmdb8055",
   "title": "Чтец",
   "year": 2008,
   "similarity": 0.375
  }
 ],
 "tmdb:17962": [
  {
   "key": "tmdb:18148",
   "workId": "f-tmdb18148",
   "title": "Токийская повесть",
   "year": 1953,
   "similarity": 0.479
  },
  {
   "key": "tmdb:5910",
   "workId": "f-tmdb5910",
   "title": "Фейерверк",
   "year": 1997,
   "similarity": 0.38
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.348
  },
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.342
  },
  {
   "key": "tmdb:5544",
   "workId": "f-tmdb5544",
   "title": "Хиросима, любовь моя",
   "year": 1959,
   "similarity": 0.332
  }
 ],
 "tmdb:18": [
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.524
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.494
  },
  {
   "key": "tmdb:607",
   "workId": "f-tmdb607",
   "title": "Люди в чёрном",
   "year": 1997,
   "similarity": 0.478
  },
  {
   "key": "tmdb:2164",
   "workId": "f-tmdb2164",
   "title": "Звёздные врата",
   "year": 1994,
   "similarity": 0.461
  },
  {
   "key": "tmdb:563",
   "workId": "l-tmdb563",
   "title": "Звездный десант",
   "year": 1997,
   "similarity": 0.43
  }
 ],
 "tmdb:180": [
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.573
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.572
  },
  {
   "key": "tmdb:281",
   "workId": "f-tmdb281",
   "title": "Странные дни",
   "year": 1995,
   "similarity": 0.559
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.546
  },
  {
   "key": "tmdb:7299",
   "workId": "u-kp309",
   "title": "Эквилибриум",
   "year": 2002,
   "similarity": 0.527
  }
 ],
 "tmdb:1813": [
  {
   "key": "tmdb:635",
   "workId": "u-kp7471",
   "title": "Сердце Ангела",
   "year": 1987,
   "similarity": 0.511
  },
  {
   "key": "tmdb:29917",
   "workId": "u-kp418762",
   "title": "Экзамен",
   "year": 2009,
   "similarity": 0.37
  },
  {
   "key": "tmdb:26466",
   "workId": "l-tmdb26466",
   "title": "Треугольник",
   "year": 2009,
   "similarity": 0.366
  },
  {
   "key": "tmdb:402",
   "workId": "f-tmdb402",
   "title": "Основной инстинкт",
   "year": 1992,
   "similarity": 0.365
  },
  {
   "key": "tmdb:16307",
   "workId": "f-tmdb16307",
   "title": "Плетеный человек",
   "year": 1973,
   "similarity": 0.346
  }
 ],
 "tmdb:18148": [
  {
   "key": "tmdb:17962",
   "workId": "f-tmdb17962",
   "title": "После жизни",
   "year": 1999,
   "similarity": 0.479
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.447
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.445
  },
  {
   "key": "tmdb:5910",
   "workId": "f-tmdb5910",
   "title": "Фейерверк",
   "year": 1997,
   "similarity": 0.439
  },
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.423
  }
 ],
 "tmdb:1818": [
  {
   "key": "tmdb:269",
   "workId": "f-tmdb269",
   "title": "На последнем дыхании",
   "year": 1960,
   "similarity": 0.536
  },
  {
   "key": "tmdb:934",
   "workId": "f-tmdb934",
   "title": "Мужские разборки",
   "year": 1955,
   "similarity": 0.518
  },
  {
   "key": "tmdb:8073",
   "workId": "f-tmdb8073",
   "title": "Банда аутсайдеров",
   "year": 1964,
   "similarity": 0.46
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.409
  },
  {
   "key": "tmdb:405",
   "workId": "f-tmdb405",
   "title": "Дорога",
   "year": 1954,
   "similarity": 0.382
  }
 ],
 "tmdb:18333": [
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.595
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.548
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.529
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.528
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.527
  }
 ],
 "tmdb:184": [
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.424
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.41
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.357
  },
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.334
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.327
  }
 ],
 "tmdb:1847": [
  {
   "key": "tmdb:269",
   "workId": "f-tmdb269",
   "title": "На последнем дыхании",
   "year": 1960,
   "similarity": 0.399
  },
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.384
  },
  {
   "key": "tmdb:8073",
   "workId": "f-tmdb8073",
   "title": "Банда аутсайдеров",
   "year": 1964,
   "similarity": 0.35
  },
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.318
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.315
  }
 ],
 "tmdb:185": [
  {
   "key": "tmdb:694",
   "workId": "f-tmdb694",
   "title": "Сияние",
   "year": 1980,
   "similarity": 0.473
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.417
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.411
  },
  {
   "key": "tmdb:550",
   "workId": "u-kp361",
   "title": "Бойцовский клуб",
   "year": 1999,
   "similarity": 0.386
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.384
  }
 ],
 "tmdb:1859": [
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.541
  },
  {
   "key": "tmdb:651",
   "workId": "f-tmdb651",
   "title": "Военно-полевой госпиталь М.Э.Ш.",
   "year": 1970,
   "similarity": 0.442
  },
  {
   "key": "tmdb:872",
   "workId": "f-tmdb872",
   "title": "Поющие под дождём",
   "year": 1952,
   "similarity": 0.395
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.386
  },
  {
   "key": "tmdb:198",
   "workId": "f-tmdb198",
   "title": "Быть или не быть",
   "year": 1942,
   "similarity": 0.382
  }
 ],
 "tmdb:18620": [
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.448
  },
  {
   "key": "tmdb:31225",
   "workId": "f-tmdb31225",
   "title": "Париж в огне",
   "year": 1991,
   "similarity": 0.42
  },
  {
   "key": "tmdb:9576",
   "workId": "f-tmdb9576",
   "title": "Тутси",
   "year": 1982,
   "similarity": 0.4
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.376
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.364
  }
 ],
 "tmdb:1887": [
  {
   "key": "tmdb:11104",
   "workId": "f-tmdb11104",
   "title": "Чунгкингский экспресс",
   "year": 1994,
   "similarity": 0.357
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.356
  },
  {
   "key": "tmdb:10436",
   "workId": "f-tmdb10436",
   "title": "Эпоха невинности",
   "year": 1993,
   "similarity": 0.348
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.341
  },
  {
   "key": "tmdb:266",
   "workId": "f-tmdb266",
   "title": "Презрение",
   "year": 1963,
   "similarity": 0.31
  }
 ],
 "tmdb:18900": [
  {
   "key": "tmdb:25364",
   "workId": "f-tmdb25364",
   "title": "Туз в рукаве",
   "year": 1951,
   "similarity": 0.365
  },
  {
   "key": "tmdb:15794",
   "workId": "f-tmdb15794",
   "title": "Белая горячка",
   "year": 1949,
   "similarity": 0.34
  },
  {
   "key": "tmdb:93",
   "workId": "f-tmdb93",
   "title": "Анатомия убийства",
   "year": 1959,
   "similarity": 0.32
  },
  {
   "key": "tmdb:845",
   "workId": "f-tmdb845",
   "title": "Незнакомцы в поезде",
   "year": 1951,
   "similarity": 0.293
  },
  {
   "key": "tmdb:934",
   "workId": "f-tmdb934",
   "title": "Мужские разборки",
   "year": 1955,
   "similarity": 0.278
  }
 ],
 "tmdb:19": [
  {
   "key": "tmdb:636",
   "workId": "f-tmdb636",
   "title": "Галактика ТНХ-1138",
   "year": 1971,
   "similarity": 0.51
  },
  {
   "key": "tmdb:78",
   "workId": "f-tmdb78",
   "title": "Бегущий по лезвию",
   "year": 1982,
   "similarity": 0.456
  },
  {
   "key": "tmdb:17431",
   "workId": "l-tmdb17431",
   "title": "Луна 2112",
   "year": 2009,
   "similarity": 0.401
  },
  {
   "key": "tmdb:871",
   "workId": "f-tmdb871",
   "title": "Планета обезьян",
   "year": 1968,
   "similarity": 0.382
  },
  {
   "key": "tmdb:782",
   "workId": "u-kp5012",
   "title": "Гаттака",
   "year": 1997,
   "similarity": 0.343
  }
 ],
 "tmdb:1900": [
  {
   "key": "tmdb:55",
   "workId": "f-tmdb55",
   "title": "Сука-любовь",
   "year": 2000,
   "similarity": 0.433
  },
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.402
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.385
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.355
  },
  {
   "key": "tmdb:238",
   "workId": "f-tmdb238",
   "title": "Крёстный отец",
   "year": 1972,
   "similarity": 0.334
  }
 ],
 "tmdb:1919": [
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.479
  },
  {
   "key": "tmdb:2013",
   "workId": "f-tmdb2013",
   "title": "Скафандр и бабочка",
   "year": 2007,
   "similarity": 0.441
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.403
  },
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.373
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.372
  }
 ],
 "tmdb:1933": [
  {
   "key": "tmdb:745",
   "workId": "f-tmdb745",
   "title": "Шестое чувство",
   "year": 1999,
   "similarity": 0.535
  },
  {
   "key": "tmdb:82507",
   "workId": "l-tmdb82507",
   "title": "Синистер",
   "year": 2012,
   "similarity": 0.5
  },
  {
   "key": "tmdb:2668",
   "workId": "l-tmdb2668",
   "title": "Сонная лощина",
   "year": 1999,
   "similarity": 0.448
  },
  {
   "key": "tmdb:9552",
   "workId": "f-tmdb9552",
   "title": "Изгоняющий дьявола",
   "year": 1973,
   "similarity": 0.343
  },
  {
   "key": "tmdb:7340",
   "workId": "f-tmdb7340",
   "title": "Кэрри",
   "year": 1976,
   "similarity": 0.342
  }
 ],
 "tmdb:194": [
  {
   "key": "tmdb:83666",
   "workId": "f-tmdb83666",
   "title": "Королевство полной луны",
   "year": 2012,
   "similarity": 0.459
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.435
  },
  {
   "key": "tmdb:11216",
   "workId": "f-tmdb11216",
   "title": "Новый кинотеатр «Парадизо»",
   "year": 1988,
   "similarity": 0.399
  },
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.389
  },
  {
   "key": "tmdb:2013",
   "workId": "f-tmdb2013",
   "title": "Скафандр и бабочка",
   "year": 2007,
   "similarity": 0.353
  }
 ],
 "tmdb:1949": [
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.473
  },
  {
   "key": "tmdb:11423",
   "workId": "c-memories",
   "title": "Воспоминания об убийстве",
   "year": 2003,
   "similarity": 0.402
  },
  {
   "key": "tmdb:891",
   "workId": "f-tmdb891",
   "title": "Вся президентская рать",
   "year": 1976,
   "similarity": 0.354
  },
  {
   "key": "tmdb:70670",
   "workId": "u-kp526812",
   "title": "Охотники за головами",
   "year": 2011,
   "similarity": 0.351
  },
  {
   "key": "tmdb:820",
   "workId": "f-tmdb820",
   "title": "Джон Ф. Кеннеди: Выстрелы в Далласе",
   "year": 1991,
   "similarity": 0.332
  }
 ],
 "tmdb:19542": [
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.451
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.435
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.434
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.433
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.406
  }
 ],
 "tmdb:1955": [
  {
   "key": "tmdb:76203",
   "workId": "f-tmdb76203",
   "title": "12 лет рабства",
   "year": 2013,
   "similarity": 0.377
  },
  {
   "key": "tmdb:2013",
   "workId": "f-tmdb2013",
   "title": "Скафандр и бабочка",
   "year": 2007,
   "similarity": 0.327
  },
  {
   "key": "tmdb:3780",
   "workId": "f-tmdb3780",
   "title": "Красная борода",
   "year": 1965,
   "similarity": 0.315
  },
  {
   "key": "tmdb:405",
   "workId": "f-tmdb405",
   "title": "Дорога",
   "year": 1954,
   "similarity": 0.282
  },
  {
   "key": "tmdb:234",
   "workId": "f-tmdb234",
   "title": "Кабинет доктора Калигари",
   "year": 1920,
   "similarity": 0.274
  }
 ],
 "tmdb:198": [
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.385
  },
  {
   "key": "tmdb:1859",
   "workId": "f-tmdb1859",
   "title": "Ниночка",
   "year": 1939,
   "similarity": 0.382
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.375
  },
  {
   "key": "tmdb:3080",
   "workId": "f-tmdb3080",
   "title": "Цилиндр",
   "year": 1935,
   "similarity": 0.351
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.35
  }
 ],
 "tmdb:1991": [
  {
   "key": "tmdb:49797",
   "workId": "f-tmdb49797",
   "title": "Я видел дьявола",
   "year": 2010,
   "similarity": 0.406
  },
  {
   "key": "tmdb:16869",
   "workId": "f-tmdb16869",
   "title": "Бесславные ублюдки",
   "year": 2009,
   "similarity": 0.363
  },
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.334
  },
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.33
  },
  {
   "key": "tmdb:68718",
   "workId": "f-tmdb68718",
   "title": "Джанго освобождённый",
   "year": 2012,
   "similarity": 0.325
  }
 ],
 "tmdb:19995": [
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.472
  },
  {
   "key": "tmdb:24428",
   "workId": "f-tmdb24428",
   "title": "Мстители",
   "year": 2012,
   "similarity": 0.47
  },
  {
   "key": "tmdb:49521",
   "workId": "f-tmdb49521",
   "title": "Человек из стали",
   "year": 2013,
   "similarity": 0.469
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.457
  },
  {
   "key": "tmdb:49047",
   "workId": "f-tmdb49047",
   "title": "Гравитация",
   "year": 2013,
   "similarity": 0.432
  }
 ],
 "tmdb:2000": [
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.442
  },
  {
   "key": "tmdb:16642",
   "workId": "f-tmdb16642",
   "title": "Дни жатвы",
   "year": 1978,
   "similarity": 0.401
  },
  {
   "key": "tmdb:9343",
   "workId": "f-tmdb9343",
   "title": "Фицкарральдо",
   "year": 1982,
   "similarity": 0.379
  },
  {
   "key": "tmdb:11710",
   "workId": "f-tmdb11710",
   "title": "Каждый за себя, а Бог против всех",
   "year": 1974,
   "similarity": 0.375
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.356
  }
 ],
 "tmdb:20108": [
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.469
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.468
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.459
  },
  {
   "key": "tmdb:669",
   "workId": "f-tmdb669",
   "title": "Нанук с Севера",
   "year": 1922,
   "similarity": 0.431
  },
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.429
  }
 ],
 "tmdb:20126": [
  {
   "key": "tmdb:11906",
   "workId": "f-tmdb11906",
   "title": "Суспирия",
   "year": 1977,
   "similarity": 0.617
  },
  {
   "key": "tmdb:931",
   "workId": "u-kp6268",
   "title": "А теперь не смотри",
   "year": 1973,
   "similarity": 0.516
  },
  {
   "key": "tmdb:11167",
   "workId": "f-tmdb11167",
   "title": "Подглядывающий",
   "year": 1960,
   "similarity": 0.495
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.44
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.427
  }
 ],
 "tmdb:2013": [
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.486
  },
  {
   "key": "tmdb:1919",
   "workId": "f-tmdb1919",
   "title": "Вдали от неё",
   "year": 2007,
   "similarity": 0.441
  },
  {
   "key": "tmdb:334",
   "workId": "f-tmdb334",
   "title": "Магнолия",
   "year": 1999,
   "similarity": 0.402
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.399
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.387
  }
 ],
 "tmdb:2019": [
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.478
  },
  {
   "key": "tmdb:74",
   "workId": "f-tmdb74",
   "title": "Война миров",
   "year": 2005,
   "similarity": 0.403
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.381
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.38
  },
  {
   "key": "tmdb:9593",
   "workId": "f-tmdb9593",
   "title": "Последний киногерой",
   "year": 1993,
   "similarity": 0.38
  }
 ],
 "tmdb:2028": [
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.653
  },
  {
   "key": "tmdb:15144",
   "workId": "f-tmdb15144",
   "title": "Шестнадцать свечей",
   "year": 1984,
   "similarity": 0.623
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.587
  },
  {
   "key": "tmdb:207",
   "workId": "f-tmdb207",
   "title": "Общество мёртвых поэтов",
   "year": 1989,
   "similarity": 0.541
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.53
  }
 ],
 "tmdb:203": [
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.474
  },
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.472
  },
  {
   "key": "tmdb:238",
   "workId": "f-tmdb238",
   "title": "Крёстный отец",
   "year": 1972,
   "similarity": 0.468
  },
  {
   "key": "tmdb:26039",
   "workId": "f-tmdb26039",
   "title": "В упор",
   "year": 1967,
   "similarity": 0.45
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.439
  }
 ],
 "tmdb:20325": [
  {
   "key": "tmdb:3080",
   "workId": "f-tmdb3080",
   "title": "Цилиндр",
   "year": 1935,
   "similarity": 0.723
  },
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.578
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.529
  },
  {
   "key": "tmdb:11009",
   "workId": "f-tmdb11009",
   "title": "Лихорадка субботнего вечера",
   "year": 1977,
   "similarity": 0.457
  },
  {
   "key": "tmdb:872",
   "workId": "f-tmdb872",
   "title": "Поющие под дождём",
   "year": 1952,
   "similarity": 0.456
  }
 ],
 "tmdb:207": [
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.541
  },
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.527
  },
  {
   "key": "tmdb:235",
   "workId": "f-tmdb235",
   "title": "Останься со мной",
   "year": 1986,
   "similarity": 0.472
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.444
  },
  {
   "key": "tmdb:11216",
   "workId": "f-tmdb11216",
   "title": "Новый кинотеатр «Парадизо»",
   "year": 1988,
   "similarity": 0.414
  }
 ],
 "tmdb:2108": [
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.653
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.607
  },
  {
   "key": "tmdb:15144",
   "workId": "f-tmdb15144",
   "title": "Шестнадцать свечей",
   "year": 1984,
   "similarity": 0.606
  },
  {
   "key": "tmdb:9571",
   "workId": "f-tmdb9571",
   "title": "Под кайфом и в смятении",
   "year": 1993,
   "similarity": 0.606
  },
  {
   "key": "tmdb:207",
   "workId": "f-tmdb207",
   "title": "Общество мёртвых поэтов",
   "year": 1989,
   "similarity": 0.527
  }
 ],
 "tmdb:21135": [
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.666
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.605
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.589
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.585
  },
  {
   "key": "tmdb:266",
   "workId": "f-tmdb266",
   "title": "Презрение",
   "year": 1963,
   "similarity": 0.523
  }
 ],
 "tmdb:2118": [
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.637
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.527
  },
  {
   "key": "tmdb:70670",
   "workId": "u-kp526812",
   "title": "Охотники за головами",
   "year": 2011,
   "similarity": 0.481
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.477
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.463
  }
 ],
 "tmdb:213": [
  {
   "key": "tmdb:845",
   "workId": "f-tmdb845",
   "title": "Незнакомцы в поезде",
   "year": 1951,
   "similarity": 0.497
  },
  {
   "key": "tmdb:11963",
   "workId": "f-tmdb11963",
   "title": "Три дня Кондора",
   "year": 1975,
   "similarity": 0.496
  },
  {
   "key": "tmdb:567",
   "workId": "f-tmdb567",
   "title": "Окно во двор",
   "year": 1954,
   "similarity": 0.487
  },
  {
   "key": "tmdb:303",
   "workId": "f-tmdb303",
   "title": "Дурная слава",
   "year": 1946,
   "similarity": 0.478
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.458
  }
 ],
 "tmdb:21450": [
  {
   "key": "tmdb:452",
   "workId": "f-tmdb452",
   "title": "Идиоты",
   "year": 1998,
   "similarity": 0.451
  },
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.389
  },
  {
   "key": "tmdb:145",
   "workId": "f-tmdb145",
   "title": "Рассекая волны",
   "year": 1996,
   "similarity": 0.377
  },
  {
   "key": "tmdb:17609",
   "workId": "f-tmdb17609",
   "title": "Антихрист",
   "year": 2009,
   "similarity": 0.364
  },
  {
   "key": "tmdb:9540",
   "workId": "f-tmdb9540",
   "title": "Связанные насмерть",
   "year": 1988,
   "similarity": 0.325
  }
 ],
 "tmdb:216": [
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.476
  },
  {
   "key": "tmdb:439",
   "workId": "f-tmdb439",
   "title": "Сладкая жизнь",
   "year": 1960,
   "similarity": 0.429
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.422
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.396
  },
  {
   "key": "tmdb:18148",
   "workId": "f-tmdb18148",
   "title": "Токийская повесть",
   "year": 1953,
   "similarity": 0.389
  }
 ],
 "tmdb:2164": [
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.485
  },
  {
   "key": "tmdb:18",
   "workId": "f-tmdb18",
   "title": "Пятый элемент",
   "year": 1997,
   "similarity": 0.461
  },
  {
   "key": "tmdb:95",
   "workId": "f-tmdb95",
   "title": "Армагеддон",
   "year": 1998,
   "similarity": 0.442
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.439
  },
  {
   "key": "tmdb:607",
   "workId": "f-tmdb607",
   "title": "Люди в чёрном",
   "year": 1997,
   "similarity": 0.413
  }
 ],
 "tmdb:21734": [
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.516
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.482
  },
  {
   "key": "tmdb:223",
   "workId": "f-tmdb223",
   "title": "Ребекка",
   "year": 1940,
   "similarity": 0.453
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.453
  },
  {
   "key": "tmdb:426",
   "workId": "f-tmdb426",
   "title": "Головокружение",
   "year": 1958,
   "similarity": 0.444
  }
 ],
 "tmdb:218": [
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.896
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.596
  },
  {
   "key": "tmdb:5548",
   "workId": "l-tmdb5548",
   "title": "Робокоп",
   "year": 1987,
   "similarity": 0.565
  },
  {
   "key": "tmdb:78",
   "workId": "f-tmdb78",
   "title": "Бегущий по лезвию",
   "year": 1982,
   "similarity": 0.558
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.557
  }
 ],
 "tmdb:22": [
  {
   "key": "tmdb:2493",
   "workId": "f-tmdb2493",
   "title": "Принцесса-невеста",
   "year": 1987,
   "similarity": 0.614
  },
  {
   "key": "tmdb:254",
   "workId": "f-tmdb254",
   "title": "Кинг Конг",
   "year": 2005,
   "similarity": 0.507
  },
  {
   "key": "tmdb:557",
   "workId": "f-tmdb557",
   "title": "Человек-паук",
   "year": 2002,
   "similarity": 0.449
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.446
  },
  {
   "key": "tmdb:85",
   "workId": "f-tmdb85",
   "title": "Индиана Джонс: В поисках утраченного ковчега",
   "year": 1981,
   "similarity": 0.442
  }
 ],
 "tmdb:221": [
  {
   "key": "tmdb:157386",
   "workId": "f-tmdb157386",
   "title": "Захватывающее время",
   "year": 2013,
   "similarity": 0.417
  },
  {
   "key": "tmdb:25188",
   "workId": "f-tmdb25188",
   "title": "Последний киносеанс",
   "year": 1971,
   "similarity": 0.4
  },
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.394
  },
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.38
  },
  {
   "key": "tmdb:838",
   "workId": "f-tmdb838",
   "title": "Американские граффити",
   "year": 1973,
   "similarity": 0.348
  }
 ],
 "tmdb:223": [
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.522
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.499
  },
  {
   "key": "tmdb:21734",
   "workId": "f-tmdb21734",
   "title": "Тень сомнения",
   "year": 1943,
   "similarity": 0.453
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.437
  },
  {
   "key": "tmdb:3309",
   "workId": "f-tmdb3309",
   "title": "Милдред Пирс",
   "year": 1945,
   "similarity": 0.434
  }
 ],
 "tmdb:2255": [
  {
   "key": "tmdb:2292",
   "workId": "f-tmdb2292",
   "title": "Клерки",
   "year": 1994,
   "similarity": 0.575
  },
  {
   "key": "tmdb:17159",
   "workId": "f-tmdb17159",
   "title": "Эдди Мерфи без купюр",
   "year": 1987,
   "similarity": 0.308
  },
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.264
  },
  {
   "key": "tmdb:10218",
   "workId": "f-tmdb10218",
   "title": "Тусовщики",
   "year": 1996,
   "similarity": 0.259
  }
 ],
 "tmdb:22596": [
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.399
  },
  {
   "key": "tmdb:961",
   "workId": "f-tmdb961",
   "title": "Паровоз Генерал",
   "year": 1926,
   "similarity": 0.393
  },
  {
   "key": "tmdb:992",
   "workId": "f-tmdb992",
   "title": "Шерлок младший",
   "year": 1924,
   "similarity": 0.37
  },
  {
   "key": "tmdb:3082",
   "workId": "f-tmdb3082",
   "title": "Новые времена",
   "year": 1936,
   "similarity": 0.362
  },
  {
   "key": "tmdb:962",
   "workId": "f-tmdb962",
   "title": "Золотая лихорадка",
   "year": 1925,
   "similarity": 0.329
  }
 ],
 "tmdb:2260": [
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.377
  },
  {
   "key": "tmdb:10683",
   "workId": "f-tmdb10683",
   "title": "Счастье",
   "year": 1998,
   "similarity": 0.334
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.303
  },
  {
   "key": "tmdb:63579",
   "workId": "f-tmdb63579",
   "title": "Project Nim",
   "year": 2011,
   "similarity": 0.296
  },
  {
   "key": "tmdb:46738",
   "workId": "c-incendies",
   "title": "Пожары",
   "year": 2010,
   "similarity": 0.291
  }
 ],
 "tmdb:22825": [
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.536
  },
  {
   "key": "tmdb:29917",
   "workId": "u-kp418762",
   "title": "Экзамен",
   "year": 2009,
   "similarity": 0.534
  },
  {
   "key": "tmdb:26466",
   "workId": "l-tmdb26466",
   "title": "Треугольник",
   "year": 2009,
   "similarity": 0.437
  },
  {
   "key": "tmdb:74",
   "workId": "f-tmdb74",
   "title": "Война миров",
   "year": 2005,
   "similarity": 0.423
  },
  {
   "key": "tmdb:75656",
   "workId": "u-kp522892",
   "title": "Иллюзия обмана",
   "year": 2013,
   "similarity": 0.416
  }
 ],
 "tmdb:2292": [
  {
   "key": "tmdb:2255",
   "workId": "f-tmdb2255",
   "title": "В погоне за Эми",
   "year": 1997,
   "similarity": 0.575
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.337
  },
  {
   "key": "tmdb:9388",
   "workId": "f-tmdb9388",
   "title": "Здесь курят",
   "year": 2005,
   "similarity": 0.326
  },
  {
   "key": "tmdb:4638",
   "workId": "u-kp93377",
   "title": "Типа крутые легавые",
   "year": 2007,
   "similarity": 0.309
  },
  {
   "key": "tmdb:22970",
   "workId": "l-tmdb22970",
   "title": "Хижина в лесу",
   "year": 2012,
   "similarity": 0.291
  }
 ],
 "tmdb:22947": [
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.379
  },
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.325
  },
  {
   "key": "tmdb:9675",
   "workId": "f-tmdb9675",
   "title": "На обочине",
   "year": 2004,
   "similarity": 0.324
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.323
  },
  {
   "key": "tmdb:380",
   "workId": "f-tmdb380",
   "title": "Человек дождя",
   "year": 1988,
   "similarity": 0.32
  }
 ],
 "tmdb:22954": [
  {
   "key": "tmdb:10858",
   "workId": "f-tmdb10858",
   "title": "Никсон",
   "year": 1995,
   "similarity": 0.477
  },
  {
   "key": "tmdb:462",
   "workId": "f-tmdb462",
   "title": "Эрин Брокович",
   "year": 2000,
   "similarity": 0.461
  },
  {
   "key": "tmdb:72976",
   "workId": "f-tmdb72976",
   "title": "Линкольн",
   "year": 2012,
   "similarity": 0.397
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.362
  },
  {
   "key": "tmdb:855",
   "workId": "f-tmdb855",
   "title": "Чёрный ястреб",
   "year": 2001,
   "similarity": 0.341
  }
 ],
 "tmdb:22970": [
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.431
  },
  {
   "key": "tmdb:10331",
   "workId": "f-tmdb10331",
   "title": "Ночь живых мертвецов",
   "year": 1968,
   "similarity": 0.424
  },
  {
   "key": "tmdb:923",
   "workId": "f-tmdb923",
   "title": "Рассвет мертвецов",
   "year": 1978,
   "similarity": 0.413
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.41
  },
  {
   "key": "tmdb:4638",
   "workId": "u-kp93377",
   "title": "Типа крутые легавые",
   "year": 2007,
   "similarity": 0.403
  }
 ],
 "tmdb:23168": [
  {
   "key": "tmdb:949",
   "workId": "f-tmdb949",
   "title": "Схватка",
   "year": 1995,
   "similarity": 0.477
  },
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.47
  },
  {
   "key": "tmdb:322",
   "workId": "f-tmdb322",
   "title": "Таинственная река",
   "year": 2003,
   "similarity": 0.417
  },
  {
   "key": "tmdb:1422",
   "workId": "f-tmdb1422",
   "title": "Отступники",
   "year": 2006,
   "similarity": 0.409
  },
  {
   "key": "tmdb:1538",
   "workId": "f-tmdb1538",
   "title": "Соучастник",
   "year": 2004,
   "similarity": 0.401
  }
 ],
 "tmdb:2321": [
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.579
  },
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.548
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.526
  },
  {
   "key": "tmdb:11300",
   "workId": "f-tmdb11300",
   "title": "Дикая штучка",
   "year": 1986,
   "similarity": 0.522
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.514
  }
 ],
 "tmdb:2323": [
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.432
  },
  {
   "key": "tmdb:744",
   "workId": "f-tmdb744",
   "title": "Лучший стрелок",
   "year": 1986,
   "similarity": 0.383
  },
  {
   "key": "tmdb:1585",
   "workId": "f-tmdb1585",
   "title": "Эта замечательная жизнь",
   "year": 1946,
   "similarity": 0.381
  },
  {
   "key": "tmdb:881",
   "workId": "f-tmdb881",
   "title": "Несколько хороших парней",
   "year": 1992,
   "similarity": 0.373
  },
  {
   "key": "tmdb:601",
   "workId": "f-tmdb601",
   "title": "Инопланетянин",
   "year": 1982,
   "similarity": 0.354
  }
 ],
 "tmdb:234": [
  {
   "key": "tmdb:26317",
   "workId": "f-tmdb26317",
   "title": "Человек с киноаппаратом",
   "year": 1929,
   "similarity": 0.501
  },
  {
   "key": "tmdb:832",
   "workId": "f-tmdb832",
   "title": "М убийца",
   "year": 1931,
   "similarity": 0.498
  },
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.428
  },
  {
   "key": "tmdb:539",
   "workId": "f-tmdb539",
   "title": "Психо",
   "year": 1960,
   "similarity": 0.417
  },
  {
   "key": "tmdb:64720",
   "workId": "f-tmdb64720",
   "title": "Укрытие",
   "year": 2011,
   "similarity": 0.402
  }
 ],
 "tmdb:23488": [
  {
   "key": "tmdb:41215",
   "workId": "l-tmdb41215",
   "title": "Черная смерть",
   "year": 2010,
   "similarity": 0.65
  },
  {
   "key": "tmdb:11976",
   "workId": "l-tmdb11976",
   "title": "Легенда",
   "year": 1985,
   "similarity": 0.349
  },
  {
   "key": "tmdb:32985",
   "workId": "l-tmdb32985",
   "title": "Соломон Кейн",
   "year": 2009,
   "similarity": 0.331
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.316
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.315
  }
 ],
 "tmdb:235": [
  {
   "key": "tmdb:11216",
   "workId": "f-tmdb11216",
   "title": "Новый кинотеатр «Парадизо»",
   "year": 1988,
   "similarity": 0.513
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.5
  },
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.485
  },
  {
   "key": "tmdb:207",
   "workId": "f-tmdb207",
   "title": "Общество мёртвых поэтов",
   "year": 1989,
   "similarity": 0.472
  },
  {
   "key": "tmdb:838",
   "workId": "f-tmdb838",
   "title": "Американские граффити",
   "year": 1973,
   "similarity": 0.471
  }
 ],
 "tmdb:238": [
  {
   "key": "tmdb:240",
   "workId": "f-tmdb240",
   "title": "Крёстный отец 2",
   "year": 1974,
   "similarity": 0.695
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.645
  },
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.5
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.468
  },
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.453
  }
 ],
 "tmdb:239": [
  {
   "key": "tmdb:3086",
   "workId": "f-tmdb3086",
   "title": "Леди Ева",
   "year": 1941,
   "similarity": 0.357
  },
  {
   "key": "tmdb:900",
   "workId": "f-tmdb900",
   "title": "Воспитание крошки",
   "year": 1938,
   "similarity": 0.348
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.32
  },
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.317
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.317
  }
 ],
 "tmdb:240": [
  {
   "key": "tmdb:238",
   "workId": "f-tmdb238",
   "title": "Крёстный отец",
   "year": 1972,
   "similarity": 0.695
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.513
  },
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.482
  },
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.426
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.421
  }
 ],
 "tmdb:241": [
  {
   "key": "tmdb:837",
   "workId": "f-tmdb837",
   "title": "Видеодром",
   "year": 1983,
   "similarity": 0.372
  },
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.367
  },
  {
   "key": "tmdb:73567",
   "workId": "u-kp568374",
   "title": "Киллер Джо",
   "year": 2011,
   "similarity": 0.363
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.348
  },
  {
   "key": "tmdb:185",
   "workId": "f-tmdb185",
   "title": "Заводной апельсин",
   "year": 1971,
   "similarity": 0.336
  }
 ],
 "tmdb:24128": [
  {
   "key": "tmdb:84334",
   "workId": "f-tmdb84334",
   "title": "В поисках Сахарного Человека",
   "year": 2012,
   "similarity": 0.543
  },
  {
   "key": "tmdb:19542",
   "workId": "f-tmdb19542",
   "title": "Красные башмачки",
   "year": 1948,
   "similarity": 0.321
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.311
  },
  {
   "key": "tmdb:11009",
   "workId": "f-tmdb11009",
   "title": "Лихорадка субботнего вечера",
   "year": 1977,
   "similarity": 0.3
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.292
  }
 ],
 "tmdb:24192": [
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.642
  },
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.556
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.545
  },
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.527
  },
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.513
  }
 ],
 "tmdb:244": [
  {
   "key": "tmdb:254",
   "workId": "f-tmdb254",
   "title": "Кинг Конг",
   "year": 2005,
   "similarity": 0.401
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.382
  },
  {
   "key": "tmdb:630",
   "workId": "f-tmdb630",
   "title": "Волшебник страны Оз",
   "year": 1939,
   "similarity": 0.36
  },
  {
   "key": "tmdb:571",
   "workId": "f-tmdb571",
   "title": "Птицы",
   "year": 1963,
   "similarity": 0.358
  },
  {
   "key": "tmdb:578",
   "workId": "f-tmdb578",
   "title": "Челюсти",
   "year": 1975,
   "similarity": 0.329
  }
 ],
 "tmdb:2440": [
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.573
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.517
  },
  {
   "key": "tmdb:31657",
   "workId": "f-tmdb31657",
   "title": "Возвращение домой",
   "year": 1978,
   "similarity": 0.47
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.427
  },
  {
   "key": "tmdb:46738",
   "workId": "c-incendies",
   "title": "Пожары",
   "year": 2010,
   "similarity": 0.421
  }
 ],
 "tmdb:24428": [
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.812
  },
  {
   "key": "tmdb:49521",
   "workId": "f-tmdb49521",
   "title": "Человек из стали",
   "year": 2013,
   "similarity": 0.771
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.761
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.755
  },
  {
   "key": "tmdb:1724",
   "workId": "f-tmdb1724",
   "title": "Невероятный Халк",
   "year": 2008,
   "similarity": 0.733
  }
 ],
 "tmdb:24469": [
  {
   "key": "tmdb:695",
   "workId": "f-tmdb695",
   "title": "Короткий монтаж",
   "year": 1993,
   "similarity": 0.406
  },
  {
   "key": "tmdb:25188",
   "workId": "f-tmdb25188",
   "title": "Последний киносеанс",
   "year": 1971,
   "similarity": 0.384
  },
  {
   "key": "tmdb:157386",
   "workId": "f-tmdb157386",
   "title": "Захватывающее время",
   "year": 2013,
   "similarity": 0.36
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.352
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.34
  }
 ],
 "tmdb:24657": [
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.621
  },
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.613
  },
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.562
  },
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.545
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.528
  }
 ],
 "tmdb:2493": [
  {
   "key": "tmdb:22",
   "workId": "f-tmdb22",
   "title": "Пираты Карибского моря: Проклятие Чёрной жемчужины",
   "year": 2003,
   "similarity": 0.614
  },
  {
   "key": "tmdb:620",
   "workId": "f-tmdb620",
   "title": "Охотники за привидениями",
   "year": 1984,
   "similarity": 0.42
  },
  {
   "key": "tmdb:105",
   "workId": "f-tmdb105",
   "title": "Назад в будущее",
   "year": 1985,
   "similarity": 0.388
  },
  {
   "key": "tmdb:85",
   "workId": "f-tmdb85",
   "title": "Индиана Джонс: В поисках утраченного ковчега",
   "year": 1981,
   "similarity": 0.386
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.353
  }
 ],
 "tmdb:2501": [
  {
   "key": "tmdb:2503",
   "workId": "f-tmdb2503",
   "title": "Ультиматум Борна",
   "year": 2007,
   "similarity": 0.876
  },
  {
   "key": "tmdb:2502",
   "workId": "f-tmdb2502",
   "title": "Превосходство Борна",
   "year": 2004,
   "similarity": 0.851
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.572
  },
  {
   "key": "tmdb:11963",
   "workId": "f-tmdb11963",
   "title": "Три дня Кондора",
   "year": 1975,
   "similarity": 0.511
  },
  {
   "key": "tmdb:37724",
   "workId": "f-tmdb37724",
   "title": "007: Координаты «Скайфолл»",
   "year": 2012,
   "similarity": 0.449
  }
 ],
 "tmdb:2502": [
  {
   "key": "tmdb:2503",
   "workId": "f-tmdb2503",
   "title": "Ультиматум Борна",
   "year": 2007,
   "similarity": 0.91
  },
  {
   "key": "tmdb:2501",
   "workId": "f-tmdb2501",
   "title": "Идентификация Борна",
   "year": 2002,
   "similarity": 0.851
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.626
  },
  {
   "key": "tmdb:11963",
   "workId": "f-tmdb11963",
   "title": "Три дня Кондора",
   "year": 1975,
   "similarity": 0.56
  },
  {
   "key": "tmdb:36955",
   "workId": "f-tmdb36955",
   "title": "Правдивая ложь",
   "year": 1994,
   "similarity": 0.478
  }
 ],
 "tmdb:2503": [
  {
   "key": "tmdb:2502",
   "workId": "f-tmdb2502",
   "title": "Превосходство Борна",
   "year": 2004,
   "similarity": 0.91
  },
  {
   "key": "tmdb:2501",
   "workId": "f-tmdb2501",
   "title": "Идентификация Борна",
   "year": 2002,
   "similarity": 0.876
  },
  {
   "key": "tmdb:11963",
   "workId": "f-tmdb11963",
   "title": "Три дня Кондора",
   "year": 1975,
   "similarity": 0.585
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.571
  },
  {
   "key": "tmdb:37724",
   "workId": "f-tmdb37724",
   "title": "007: Координаты «Скайфолл»",
   "year": 2012,
   "similarity": 0.537
  }
 ],
 "tmdb:25188": [
  {
   "key": "tmdb:1391",
   "workId": "f-tmdb1391",
   "title": "И твою маму тоже",
   "year": 2001,
   "similarity": 0.437
  },
  {
   "key": "tmdb:68924",
   "workId": "f-tmdb68924",
   "title": "Ледяной ветер",
   "year": 1997,
   "similarity": 0.42
  },
  {
   "key": "tmdb:221",
   "workId": "f-tmdb221",
   "title": "Бунтарь без идеала",
   "year": 1955,
   "similarity": 0.4
  },
  {
   "key": "tmdb:24469",
   "workId": "f-tmdb24469",
   "title": "Аквариум",
   "year": 2009,
   "similarity": 0.384
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.383
  }
 ],
 "tmdb:25364": [
  {
   "key": "tmdb:10774",
   "workId": "f-tmdb10774",
   "title": "Телесеть",
   "year": 1976,
   "similarity": 0.507
  },
  {
   "key": "tmdb:976",
   "workId": "f-tmdb976",
   "title": "Сладкий запах успеха",
   "year": 1957,
   "similarity": 0.431
  },
  {
   "key": "tmdb:12493",
   "workId": "f-tmdb12493",
   "title": "Рай и ад",
   "year": 1963,
   "similarity": 0.419
  },
  {
   "key": "tmdb:934",
   "workId": "f-tmdb934",
   "title": "Мужские разборки",
   "year": 1955,
   "similarity": 0.408
  },
  {
   "key": "tmdb:15794",
   "workId": "f-tmdb15794",
   "title": "Белая горячка",
   "year": 1949,
   "similarity": 0.398
  }
 ],
 "tmdb:254": [
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.537
  },
  {
   "key": "tmdb:22",
   "workId": "f-tmdb22",
   "title": "Пираты Карибского моря: Проклятие Чёрной жемчужины",
   "year": 2003,
   "similarity": 0.507
  },
  {
   "key": "tmdb:558",
   "workId": "f-tmdb558",
   "title": "Человек-паук 2",
   "year": 2004,
   "similarity": 0.491
  },
  {
   "key": "tmdb:557",
   "workId": "f-tmdb557",
   "title": "Человек-паук",
   "year": 2002,
   "similarity": 0.481
  },
  {
   "key": "tmdb:49521",
   "workId": "f-tmdb49521",
   "title": "Человек из стали",
   "year": 2013,
   "similarity": 0.455
  }
 ],
 "tmdb:25468": [
  {
   "key": "tmdb:121986",
   "workId": "f-tmdb121986",
   "title": "Милая Фрэнсис",
   "year": 2013,
   "similarity": 0.439
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.414
  },
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.386
  },
  {
   "key": "tmdb:1398",
   "workId": "l-tmdb1398",
   "title": "Сталкер",
   "year": 1979,
   "similarity": 0.37
  },
  {
   "key": "tmdb:144",
   "workId": "f-tmdb144",
   "title": "Небо над Берлином",
   "year": 1987,
   "similarity": 0.367
  }
 ],
 "tmdb:2567": [
  {
   "key": "tmdb:76203",
   "workId": "f-tmdb76203",
   "title": "12 лет рабства",
   "year": 2013,
   "similarity": 0.349
  },
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.342
  },
  {
   "key": "tmdb:380",
   "workId": "f-tmdb380",
   "title": "Человек дождя",
   "year": 1988,
   "similarity": 0.342
  },
  {
   "key": "tmdb:4922",
   "workId": "f-tmdb4922",
   "title": "Загадочная история Бенджамина Баттона",
   "year": 2008,
   "similarity": 0.339
  },
  {
   "key": "tmdb:640",
   "workId": "f-tmdb640",
   "title": "Поймай меня, если сможешь",
   "year": 2002,
   "similarity": 0.329
  }
 ],
 "tmdb:257": [
  {
   "key": "tmdb:630",
   "workId": "f-tmdb630",
   "title": "Волшебник страны Оз",
   "year": 1939,
   "similarity": 0.432
  },
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.331
  },
  {
   "key": "tmdb:2323",
   "workId": "f-tmdb2323",
   "title": "Поле чудес",
   "year": 1989,
   "similarity": 0.326
  },
  {
   "key": "tmdb:909",
   "workId": "f-tmdb909",
   "title": "Встреть меня в Сент-Луисе",
   "year": 1944,
   "similarity": 0.316
  },
  {
   "key": "tmdb:601",
   "workId": "f-tmdb601",
   "title": "Инопланетянин",
   "year": 1982,
   "similarity": 0.307
  }
 ],
 "tmdb:25736": [
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.543
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.515
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.491
  },
  {
   "key": "tmdb:17057",
   "workId": "f-tmdb17057",
   "title": "В укромном месте",
   "year": 1950,
   "similarity": 0.488
  },
  {
   "key": "tmdb:3309",
   "workId": "f-tmdb3309",
   "title": "Милдред Пирс",
   "year": 1945,
   "similarity": 0.479
  }
 ],
 "tmdb:25768": [
  {
   "key": "tmdb:962",
   "workId": "f-tmdb962",
   "title": "Золотая лихорадка",
   "year": 1925,
   "similarity": 0.525
  },
  {
   "key": "tmdb:3090",
   "workId": "f-tmdb3090",
   "title": "Сокровища Сьерра Мадре",
   "year": 1948,
   "similarity": 0.479
  },
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.44
  },
  {
   "key": "tmdb:488",
   "workId": "f-tmdb488",
   "title": "Африканская королева",
   "year": 1952,
   "similarity": 0.433
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.421
  }
 ],
 "tmdb:26039": [
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.491
  },
  {
   "key": "tmdb:17365",
   "workId": "f-tmdb17365",
   "title": "Заговор «Параллакс»",
   "year": 1974,
   "similarity": 0.468
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.45
  },
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.422
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.406
  }
 ],
 "tmdb:2604": [
  {
   "key": "tmdb:31657",
   "workId": "f-tmdb31657",
   "title": "Возвращение домой",
   "year": 1978,
   "similarity": 0.618
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.518
  },
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.515
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.499
  },
  {
   "key": "tmdb:12162",
   "workId": "f-tmdb12162",
   "title": "Повелитель бури",
   "year": 2008,
   "similarity": 0.441
  }
 ],
 "tmdb:262": [
  {
   "key": "tmdb:10774",
   "workId": "f-tmdb10774",
   "title": "Телесеть",
   "year": 1976,
   "similarity": 0.386
  },
  {
   "key": "tmdb:10778",
   "workId": "f-tmdb10778",
   "title": "Человек, которого не было",
   "year": 2001,
   "similarity": 0.335
  },
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.333
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.3
  },
  {
   "key": "tmdb:378",
   "workId": "f-tmdb378",
   "title": "Воспитание Аризоны",
   "year": 1987,
   "similarity": 0.288
  }
 ],
 "tmdb:26317": [
  {
   "key": "tmdb:234",
   "workId": "f-tmdb234",
   "title": "Кабинет доктора Калигари",
   "year": 1920,
   "similarity": 0.501
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.492
  },
  {
   "key": "tmdb:5991",
   "workId": "f-tmdb5991",
   "title": "Последний человек",
   "year": 1924,
   "similarity": 0.417
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.401
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.398
  }
 ],
 "tmdb:26466": [
  {
   "key": "tmdb:29917",
   "workId": "u-kp418762",
   "title": "Экзамен",
   "year": 2009,
   "similarity": 0.556
  },
  {
   "key": "tmdb:14139",
   "workId": "c-timecrimes",
   "title": "Временная петля",
   "year": 2007,
   "similarity": 0.522
  },
  {
   "key": "tmdb:14337",
   "workId": "c-primer",
   "title": "Детонатор",
   "year": 2004,
   "similarity": 0.457
  },
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.455
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.441
  }
 ],
 "tmdb:2649": [
  {
   "key": "tmdb:29917",
   "workId": "u-kp418762",
   "title": "Экзамен",
   "year": 2009,
   "similarity": 0.475
  },
  {
   "key": "tmdb:11324",
   "workId": "u-kp397667",
   "title": "Остров проклятых",
   "year": 2009,
   "similarity": 0.435
  },
  {
   "key": "tmdb:1124",
   "workId": "u-kp195334",
   "title": "Престиж",
   "year": 2006,
   "similarity": 0.411
  },
  {
   "key": "tmdb:70670",
   "workId": "u-kp526812",
   "title": "Охотники за головами",
   "year": 2011,
   "similarity": 0.407
  },
  {
   "key": "tmdb:1538",
   "workId": "f-tmdb1538",
   "title": "Соучастник",
   "year": 2004,
   "similarity": 0.392
  }
 ],
 "tmdb:26517": [
  {
   "key": "tmdb:10212",
   "workId": "l-tmdb10212",
   "title": "Людоед",
   "year": 1999,
   "similarity": 0.596
  },
  {
   "key": "tmdb:779",
   "workId": "f-tmdb779",
   "title": "Вампир: Сон Алена Грея",
   "year": 1932,
   "similarity": 0.529
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.494
  },
  {
   "key": "tmdb:653",
   "workId": "f-tmdb653",
   "title": "Носферату, симфония ужаса",
   "year": 1922,
   "similarity": 0.472
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.468
  }
 ],
 "tmdb:2652": [
  {
   "key": "tmdb:29917",
   "workId": "u-kp418762",
   "title": "Экзамен",
   "year": 2009,
   "similarity": 0.417
  },
  {
   "key": "tmdb:86825",
   "workId": "f-tmdb86825",
   "title": "Порочные игры",
   "year": 2013,
   "similarity": 0.388
  },
  {
   "key": "tmdb:49797",
   "workId": "f-tmdb49797",
   "title": "Я видел дьявола",
   "year": 2010,
   "similarity": 0.352
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.345
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.332
  }
 ],
 "tmdb:26596": [
  {
   "key": "tmdb:11698",
   "workId": "f-tmdb11698",
   "title": "Строшек",
   "year": 1977,
   "similarity": 0.49
  },
  {
   "key": "tmdb:8073",
   "workId": "f-tmdb8073",
   "title": "Банда аутсайдеров",
   "year": 1964,
   "similarity": 0.473
  },
  {
   "key": "tmdb:7857",
   "workId": "f-tmdb7857",
   "title": "Амаркорд",
   "year": 1973,
   "similarity": 0.422
  },
  {
   "key": "tmdb:29005",
   "workId": "f-tmdb29005",
   "title": "МакКейб и миссис Миллер",
   "year": 1971,
   "similarity": 0.422
  },
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.405
  }
 ],
 "tmdb:266": [
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.555
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.523
  },
  {
   "key": "tmdb:649",
   "workId": "f-tmdb649",
   "title": "Дневная красавица",
   "year": 1967,
   "similarity": 0.504
  },
  {
   "key": "tmdb:5781",
   "workId": "f-tmdb5781",
   "title": "Этот смутный объект желания",
   "year": 1977,
   "similarity": 0.469
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.458
  }
 ],
 "tmdb:26617": [
  {
   "key": "tmdb:115",
   "workId": "f-tmdb115",
   "title": "Большой Лебовски",
   "year": 1998,
   "similarity": 0.281
  },
  {
   "key": "tmdb:14886",
   "workId": "f-tmdb14886",
   "title": "Последний наряд",
   "year": 1973,
   "similarity": 0.277
  },
  {
   "key": "tmdb:29005",
   "workId": "f-tmdb29005",
   "title": "МакКейб и миссис Миллер",
   "year": 1971,
   "similarity": 0.267
  },
  {
   "key": "tmdb:25188",
   "workId": "f-tmdb25188",
   "title": "Последний киносеанс",
   "year": 1971,
   "similarity": 0.259
  },
  {
   "key": "tmdb:624",
   "workId": "f-tmdb624",
   "title": "Беспечный ездок",
   "year": 1969,
   "similarity": 0.253
  }
 ],
 "tmdb:2666": [
  {
   "key": "tmdb:78",
   "workId": "f-tmdb78",
   "title": "Бегущий по лезвию",
   "year": 1982,
   "similarity": 0.515
  },
  {
   "key": "tmdb:63",
   "workId": "f-tmdb63",
   "title": "12 обезьян",
   "year": 1995,
   "similarity": 0.497
  },
  {
   "key": "tmdb:17431",
   "workId": "l-tmdb17431",
   "title": "Луна 2112",
   "year": 2009,
   "similarity": 0.493
  },
  {
   "key": "tmdb:281",
   "workId": "f-tmdb281",
   "title": "Странные дни",
   "year": 1995,
   "similarity": 0.488
  },
  {
   "key": "tmdb:902",
   "workId": "f-tmdb902",
   "title": "Город потерянных детей",
   "year": 1995,
   "similarity": 0.477
  }
 ],
 "tmdb:2668": [
  {
   "key": "tmdb:9495",
   "workId": "f-tmdb9495",
   "title": "Ворон",
   "year": 1994,
   "similarity": 0.479
  },
  {
   "key": "tmdb:1933",
   "workId": "c-others",
   "title": "Другие",
   "year": 2001,
   "similarity": 0.448
  },
  {
   "key": "tmdb:6312",
   "workId": "l-tmdb6312",
   "title": "Братство волка",
   "year": 2001,
   "similarity": 0.397
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.374
  },
  {
   "key": "tmdb:902",
   "workId": "f-tmdb902",
   "title": "Город потерянных детей",
   "year": 1995,
   "similarity": 0.353
  }
 ],
 "tmdb:26744": [
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.393
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.356
  },
  {
   "key": "tmdb:29005",
   "workId": "f-tmdb29005",
   "title": "МакКейб и миссис Миллер",
   "year": 1971,
   "similarity": 0.32
  },
  {
   "key": "tmdb:7500",
   "workId": "f-tmdb7500",
   "title": "Сонатина",
   "year": 1993,
   "similarity": 0.308
  },
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.306
  }
 ],
 "tmdb:269": [
  {
   "key": "tmdb:8073",
   "workId": "f-tmdb8073",
   "title": "Банда аутсайдеров",
   "year": 1964,
   "similarity": 0.561
  },
  {
   "key": "tmdb:1818",
   "workId": "f-tmdb1818",
   "title": "Стреляйте в пианиста",
   "year": 1960,
   "similarity": 0.536
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.469
  },
  {
   "key": "tmdb:934",
   "workId": "f-tmdb934",
   "title": "Мужские разборки",
   "year": 1955,
   "similarity": 0.457
  },
  {
   "key": "tmdb:2786",
   "workId": "f-tmdb2786",
   "title": "Безумный Пьеро",
   "year": 1965,
   "similarity": 0.442
  }
 ],
 "tmdb:272": [
  {
   "key": "tmdb:49026",
   "workId": "f-tmdb49026",
   "title": "Тёмный рыцарь: Возрождение легенды",
   "year": 2012,
   "similarity": 0.807
  },
  {
   "key": "tmdb:155",
   "workId": "f-tmdb155",
   "title": "Тёмный рыцарь",
   "year": 2008,
   "similarity": 0.791
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.693
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.688
  },
  {
   "key": "tmdb:13183",
   "workId": "f-tmdb13183",
   "title": "Хранители",
   "year": 2009,
   "similarity": 0.688
  }
 ],
 "tmdb:27205": [
  {
   "key": "tmdb:603",
   "workId": "f-tmdb603",
   "title": "Матрица",
   "year": 1999,
   "similarity": 0.566
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.534
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.531
  },
  {
   "key": "tmdb:180",
   "workId": "f-tmdb180",
   "title": "Особое мнение",
   "year": 2002,
   "similarity": 0.485
  },
  {
   "key": "tmdb:1124",
   "workId": "u-kp195334",
   "title": "Престиж",
   "year": 2006,
   "similarity": 0.475
  }
 ],
 "tmdb:27236": [
  {
   "key": "tmdb:11951",
   "workId": "f-tmdb11951",
   "title": "Исчезающая точка",
   "year": 1971,
   "similarity": 0.599
  },
  {
   "key": "tmdb:931",
   "workId": "u-kp6268",
   "title": "А теперь не смотри",
   "year": 1973,
   "similarity": 0.434
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.419
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.415
  },
  {
   "key": "tmdb:11300",
   "workId": "f-tmdb11300",
   "title": "Дикая штучка",
   "year": 1986,
   "similarity": 0.406
  }
 ],
 "tmdb:27327": [
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.502
  },
  {
   "key": "tmdb:11300",
   "workId": "f-tmdb11300",
   "title": "Дикая штучка",
   "year": 1986,
   "similarity": 0.494
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.48
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.453
  },
  {
   "key": "tmdb:26517",
   "workId": "f-tmdb26517",
   "title": "Мартин",
   "year": 1978,
   "similarity": 0.443
  }
 ],
 "tmdb:27375": [
  {
   "key": "tmdb:5991",
   "workId": "f-tmdb5991",
   "title": "Последний человек",
   "year": 1924,
   "similarity": 0.508
  },
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.424
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.408
  },
  {
   "key": "tmdb:26317",
   "workId": "f-tmdb26317",
   "title": "Человек с киноаппаратом",
   "year": 1929,
   "similarity": 0.396
  },
  {
   "key": "tmdb:15244",
   "workId": "f-tmdb15244",
   "title": "Приговоренный к смерти бежал, или Дух веет, где хочет",
   "year": 1956,
   "similarity": 0.378
  }
 ],
 "tmdb:274": [
  {
   "key": "tmdb:539",
   "workId": "f-tmdb539",
   "title": "Психо",
   "year": 1960,
   "similarity": 0.529
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.478
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.449
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.401
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.4
  }
 ],
 "tmdb:2755": [
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.54
  },
  {
   "key": "tmdb:9675",
   "workId": "f-tmdb9675",
   "title": "На обочине",
   "year": 2004,
   "similarity": 0.525
  },
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.446
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.431
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.43
  }
 ],
 "tmdb:2756": [
  {
   "key": "tmdb:840",
   "workId": "f-tmdb840",
   "title": "Близкие контакты третьей степени",
   "year": 1977,
   "similarity": 0.482
  },
  {
   "key": "tmdb:14372",
   "workId": "f-tmdb14372",
   "title": "Левиафан",
   "year": 1989,
   "similarity": 0.408
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.4
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.397
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.384
  }
 ],
 "tmdb:2757": [
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.592
  },
  {
   "key": "tmdb:8051",
   "workId": "f-tmdb8051",
   "title": "Любовь, сбивающая с ног",
   "year": 2002,
   "similarity": 0.42
  },
  {
   "key": "tmdb:492",
   "workId": "f-tmdb492",
   "title": "Быть Джоном Малковичем",
   "year": 1999,
   "similarity": 0.416
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.388
  },
  {
   "key": "tmdb:10403",
   "workId": "f-tmdb10403",
   "title": "Игрок",
   "year": 1992,
   "similarity": 0.365
  }
 ],
 "tmdb:278": [
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.62
  },
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.567
  },
  {
   "key": "tmdb:13",
   "workId": "f-tmdb13",
   "title": "Форрест Гамп",
   "year": 1994,
   "similarity": 0.558
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.54
  },
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.526
  }
 ],
 "tmdb:27845": [
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.459
  },
  {
   "key": "tmdb:157386",
   "workId": "f-tmdb157386",
   "title": "Захватывающее время",
   "year": 2013,
   "similarity": 0.456
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.441
  },
  {
   "key": "tmdb:11446",
   "workId": "f-tmdb11446",
   "title": "Добро пожаловать в кукольный дом",
   "year": 1996,
   "similarity": 0.424
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.408
  }
 ],
 "tmdb:2786": [
  {
   "key": "tmdb:8073",
   "workId": "f-tmdb8073",
   "title": "Банда аутсайдеров",
   "year": 1964,
   "similarity": 0.463
  },
  {
   "key": "tmdb:269",
   "workId": "f-tmdb269",
   "title": "На последнем дыхании",
   "year": 1960,
   "similarity": 0.442
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.417
  },
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.408
  },
  {
   "key": "tmdb:422",
   "workId": "f-tmdb422",
   "title": "8 с половиной",
   "year": 1963,
   "similarity": 0.396
  }
 ],
 "tmdb:279": [
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.423
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.341
  },
  {
   "key": "tmdb:15",
   "workId": "f-tmdb15",
   "title": "Гражданин Кейн",
   "year": 1941,
   "similarity": 0.338
  },
  {
   "key": "tmdb:887",
   "workId": "f-tmdb887",
   "title": "Лучшие годы нашей жизни",
   "year": 1946,
   "similarity": 0.331
  },
  {
   "key": "tmdb:84334",
   "workId": "f-tmdb84334",
   "title": "В поисках Сахарного Человека",
   "year": 2012,
   "similarity": 0.326
  }
 ],
 "tmdb:28": [
  {
   "key": "tmdb:11778",
   "workId": "f-tmdb11778",
   "title": "Охотник на оленей",
   "year": 1978,
   "similarity": 0.635
  },
  {
   "key": "tmdb:792",
   "workId": "f-tmdb792",
   "title": "Взвод",
   "year": 1986,
   "similarity": 0.584
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.386
  },
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.35
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.343
  }
 ],
 "tmdb:280": [
  {
   "key": "tmdb:218",
   "workId": "f-tmdb218",
   "title": "Терминатор",
   "year": 1984,
   "similarity": 0.896
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.639
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.598
  },
  {
   "key": "tmdb:603",
   "workId": "f-tmdb603",
   "title": "Матрица",
   "year": 1999,
   "similarity": 0.59
  },
  {
   "key": "tmdb:5548",
   "workId": "l-tmdb5548",
   "title": "Робокоп",
   "year": 1987,
   "similarity": 0.556
  }
 ],
 "tmdb:281": [
  {
   "key": "tmdb:180",
   "workId": "f-tmdb180",
   "title": "Особое мнение",
   "year": 2002,
   "similarity": 0.559
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.537
  },
  {
   "key": "tmdb:782",
   "workId": "u-kp5012",
   "title": "Гаттака",
   "year": 1997,
   "similarity": 0.5
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.488
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.473
  }
 ],
 "tmdb:284": [
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.5
  },
  {
   "key": "tmdb:705",
   "workId": "f-tmdb705",
   "title": "Все о Еве",
   "year": 1950,
   "similarity": 0.493
  },
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.479
  },
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.475
  },
  {
   "key": "tmdb:900",
   "workId": "f-tmdb900",
   "title": "Воспитание крошки",
   "year": 1938,
   "similarity": 0.436
  }
 ],
 "tmdb:28580": [
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.571
  },
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.521
  },
  {
   "key": "tmdb:990",
   "workId": "f-tmdb990",
   "title": "Бильярдист",
   "year": 1961,
   "similarity": 0.509
  },
  {
   "key": "tmdb:3090",
   "workId": "f-tmdb3090",
   "title": "Сокровища Сьерра Мадре",
   "year": 1948,
   "similarity": 0.413
  },
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.41
  }
 ],
 "tmdb:288": [
  {
   "key": "tmdb:995",
   "workId": "f-tmdb995",
   "title": "Дилижанс",
   "year": 1939,
   "similarity": 0.459
  },
  {
   "key": "tmdb:3114",
   "workId": "f-tmdb3114",
   "title": "Искатели",
   "year": 1956,
   "similarity": 0.456
  },
  {
   "key": "tmdb:903",
   "workId": "f-tmdb903",
   "title": "Хладнокровный Люк",
   "year": 1967,
   "similarity": 0.403
  },
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.377
  },
  {
   "key": "tmdb:33",
   "workId": "f-tmdb33",
   "title": "Непрощённый",
   "year": 1992,
   "similarity": 0.364
  }
 ],
 "tmdb:289": [
  {
   "key": "tmdb:11426",
   "workId": "f-tmdb11426",
   "title": "Отныне и во веки веков",
   "year": 1953,
   "similarity": 0.459
  },
  {
   "key": "tmdb:887",
   "workId": "f-tmdb887",
   "title": "Лучшие годы нашей жизни",
   "year": 1946,
   "similarity": 0.419
  },
  {
   "key": "tmdb:705",
   "workId": "f-tmdb705",
   "title": "Все о Еве",
   "year": 1950,
   "similarity": 0.379
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.369
  },
  {
   "key": "tmdb:3083",
   "workId": "f-tmdb3083",
   "title": "Мистер Смит едет в Вашингтон",
   "year": 1939,
   "similarity": 0.368
  }
 ],
 "tmdb:290": [
  {
   "key": "tmdb:2757",
   "workId": "f-tmdb2757",
   "title": "Адаптация",
   "year": 2002,
   "similarity": 0.592
  },
  {
   "key": "tmdb:1018",
   "workId": "c-mulholland",
   "title": "Малхолланд Драйв",
   "year": 2001,
   "similarity": 0.475
  },
  {
   "key": "tmdb:10778",
   "workId": "f-tmdb10778",
   "title": "Человек, которого не было",
   "year": 2001,
   "similarity": 0.467
  },
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.43
  },
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.421
  }
 ],
 "tmdb:29005": [
  {
   "key": "tmdb:26596",
   "workId": "f-tmdb26596",
   "title": "Джонни-гитара",
   "year": 1954,
   "similarity": 0.422
  },
  {
   "key": "tmdb:27236",
   "workId": "f-tmdb27236",
   "title": "Двухполосное шоссе",
   "year": 1971,
   "similarity": 0.39
  },
  {
   "key": "tmdb:16642",
   "workId": "f-tmdb16642",
   "title": "Дни жатвы",
   "year": 1978,
   "similarity": 0.351
  },
  {
   "key": "tmdb:69605",
   "workId": "f-tmdb69605",
   "title": "Слова, написанные на ветру",
   "year": 1956,
   "similarity": 0.345
  },
  {
   "key": "tmdb:10935",
   "workId": "f-tmdb10935",
   "title": "Врата рая",
   "year": 1980,
   "similarity": 0.34
  }
 ],
 "tmdb:29263": [
  {
   "key": "tmdb:42102",
   "workId": "f-tmdb42102",
   "title": "Воскресенье за городом",
   "year": 1984,
   "similarity": 0.318
  },
  {
   "key": "tmdb:31657",
   "workId": "f-tmdb31657",
   "title": "Возвращение домой",
   "year": 1978,
   "similarity": 0.304
  },
  {
   "key": "tmdb:4495",
   "workId": "f-tmdb4495",
   "title": "Дух улья",
   "year": 1973,
   "similarity": 0.29
  },
  {
   "key": "tmdb:37903",
   "workId": "f-tmdb37903",
   "title": "Белая лента",
   "year": 2009,
   "similarity": 0.284
  },
  {
   "key": "tmdb:2440",
   "workId": "f-tmdb2440",
   "title": "Объединённая зона безопасности",
   "year": 2000,
   "similarity": 0.28
  }
 ],
 "tmdb:29264": [
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.563
  },
  {
   "key": "tmdb:4497",
   "workId": "f-tmdb4497",
   "title": "Виридиана",
   "year": 1962,
   "similarity": 0.559
  },
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.466
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.456
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.445
  }
 ],
 "tmdb:29376": [
  {
   "key": "tmdb:3080",
   "workId": "f-tmdb3080",
   "title": "Цилиндр",
   "year": 1935,
   "similarity": 0.65
  },
  {
   "key": "tmdb:20325",
   "workId": "f-tmdb20325",
   "title": "Время свинга",
   "year": 1936,
   "similarity": 0.578
  },
  {
   "key": "tmdb:872",
   "workId": "f-tmdb872",
   "title": "Поющие под дождём",
   "year": 1952,
   "similarity": 0.557
  },
  {
   "key": "tmdb:11009",
   "workId": "f-tmdb11009",
   "title": "Лихорадка субботнего вечера",
   "year": 1977,
   "similarity": 0.554
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.483
  }
 ],
 "tmdb:29455": [
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.72
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.613
  },
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.527
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.515
  },
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.513
  }
 ],
 "tmdb:29917": [
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.558
  },
  {
   "key": "tmdb:26466",
   "workId": "l-tmdb26466",
   "title": "Треугольник",
   "year": 2009,
   "similarity": 0.556
  },
  {
   "key": "tmdb:22825",
   "workId": "u-kp1762",
   "title": "Посылка",
   "year": 2009,
   "similarity": 0.534
  },
  {
   "key": "tmdb:2649",
   "workId": "u-kp12198",
   "title": "Игра",
   "year": 1997,
   "similarity": 0.475
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.442
  }
 ],
 "tmdb:301": [
  {
   "key": "tmdb:26596",
   "workId": "f-tmdb26596",
   "title": "Джонни-гитара",
   "year": 1954,
   "similarity": 0.391
  },
  {
   "key": "tmdb:642",
   "workId": "f-tmdb642",
   "title": "Буч Кэссиди и Сандэнс Кид",
   "year": 1969,
   "similarity": 0.361
  },
  {
   "key": "tmdb:14295",
   "workId": "f-tmdb14295",
   "title": "Можешь рассчитывать на меня",
   "year": 2000,
   "similarity": 0.325
  },
  {
   "key": "tmdb:3114",
   "workId": "f-tmdb3114",
   "title": "Искатели",
   "year": 1956,
   "similarity": 0.325
  },
  {
   "key": "tmdb:995",
   "workId": "f-tmdb995",
   "title": "Дилижанс",
   "year": 1939,
   "similarity": 0.315
  }
 ],
 "tmdb:303": [
  {
   "key": "tmdb:213",
   "workId": "f-tmdb213",
   "title": "На север через северо-запад",
   "year": 1959,
   "similarity": 0.478
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.401
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.373
  },
  {
   "key": "tmdb:592",
   "workId": "f-tmdb592",
   "title": "Разговор",
   "year": 1974,
   "similarity": 0.37
  },
  {
   "key": "tmdb:11963",
   "workId": "f-tmdb11963",
   "title": "Три дня Кондора",
   "year": 1975,
   "similarity": 0.366
  }
 ],
 "tmdb:30497": [
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.694
  },
  {
   "key": "tmdb:948",
   "workId": "f-tmdb948",
   "title": "Хэллоуин",
   "year": 1978,
   "similarity": 0.639
  },
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.616
  },
  {
   "key": "tmdb:10331",
   "workId": "f-tmdb10331",
   "title": "Ночь живых мертвецов",
   "year": 1968,
   "similarity": 0.599
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.583
  }
 ],
 "tmdb:3059": [
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.464
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.429
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.422
  },
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.411
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.361
  }
 ],
 "tmdb:3063": [
  {
   "key": "tmdb:1859",
   "workId": "f-tmdb1859",
   "title": "Ниночка",
   "year": 1939,
   "similarity": 0.541
  },
  {
   "key": "tmdb:961",
   "workId": "f-tmdb961",
   "title": "Паровоз Генерал",
   "year": 1926,
   "similarity": 0.525
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.504
  },
  {
   "key": "tmdb:3082",
   "workId": "f-tmdb3082",
   "title": "Новые времена",
   "year": 1936,
   "similarity": 0.5
  },
  {
   "key": "tmdb:651",
   "workId": "f-tmdb651",
   "title": "Военно-полевой госпиталь М.Э.Ш.",
   "year": 1970,
   "similarity": 0.466
  }
 ],
 "tmdb:3078": [
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.608
  },
  {
   "key": "tmdb:3086",
   "workId": "f-tmdb3086",
   "title": "Леди Ева",
   "year": 1941,
   "similarity": 0.571
  },
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.553
  },
  {
   "key": "tmdb:900",
   "workId": "f-tmdb900",
   "title": "Воспитание крошки",
   "year": 1938,
   "similarity": 0.541
  },
  {
   "key": "tmdb:3529",
   "workId": "f-tmdb3529",
   "title": "Тонкий человек",
   "year": 1934,
   "similarity": 0.513
  }
 ],
 "tmdb:3080": [
  {
   "key": "tmdb:20325",
   "workId": "f-tmdb20325",
   "title": "Время свинга",
   "year": 1936,
   "similarity": 0.723
  },
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.65
  },
  {
   "key": "tmdb:872",
   "workId": "f-tmdb872",
   "title": "Поющие под дождём",
   "year": 1952,
   "similarity": 0.537
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.506
  },
  {
   "key": "tmdb:909",
   "workId": "f-tmdb909",
   "title": "Встреть меня в Сент-Луисе",
   "year": 1944,
   "similarity": 0.485
  }
 ],
 "tmdb:3082": [
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.598
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.51
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.5
  },
  {
   "key": "tmdb:962",
   "workId": "f-tmdb962",
   "title": "Золотая лихорадка",
   "year": 1925,
   "similarity": 0.499
  },
  {
   "key": "tmdb:16305",
   "workId": "f-tmdb16305",
   "title": "Странствия Салливана",
   "year": 1941,
   "similarity": 0.456
  }
 ],
 "tmdb:3083": [
  {
   "key": "tmdb:488",
   "workId": "f-tmdb488",
   "title": "Африканская королева",
   "year": 1952,
   "similarity": 0.489
  },
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.445
  },
  {
   "key": "tmdb:595",
   "workId": "f-tmdb595",
   "title": "Убить пересмешника",
   "year": 1962,
   "similarity": 0.429
  },
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.428
  },
  {
   "key": "tmdb:900",
   "workId": "f-tmdb900",
   "title": "Воспитание крошки",
   "year": 1938,
   "similarity": 0.427
  }
 ],
 "tmdb:3085": [
  {
   "key": "tmdb:900",
   "workId": "f-tmdb900",
   "title": "Воспитание крошки",
   "year": 1938,
   "similarity": 0.544
  },
  {
   "key": "tmdb:3529",
   "workId": "f-tmdb3529",
   "title": "Тонкий человек",
   "year": 1934,
   "similarity": 0.503
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.491
  },
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.477
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.437
  }
 ],
 "tmdb:3086": [
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.571
  },
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.513
  },
  {
   "key": "tmdb:16305",
   "workId": "f-tmdb16305",
   "title": "Странствия Салливана",
   "year": 1941,
   "similarity": 0.468
  },
  {
   "key": "tmdb:20325",
   "workId": "f-tmdb20325",
   "title": "Время свинга",
   "year": 1936,
   "similarity": 0.449
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.408
  }
 ],
 "tmdb:3090": [
  {
   "key": "tmdb:25768",
   "workId": "f-tmdb25768",
   "title": "Пароходный Билл",
   "year": 1928,
   "similarity": 0.479
  },
  {
   "key": "tmdb:28580",
   "workId": "f-tmdb28580",
   "title": "Потерянный уик-энд",
   "year": 1945,
   "similarity": 0.413
  },
  {
   "key": "tmdb:33",
   "workId": "f-tmdb33",
   "title": "Непрощённый",
   "year": 1992,
   "similarity": 0.397
  },
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.379
  },
  {
   "key": "tmdb:599",
   "workId": "f-tmdb599",
   "title": "Сансет бульвар",
   "year": 1950,
   "similarity": 0.374
  }
 ],
 "tmdb:30959": [
  {
   "key": "tmdb:931",
   "workId": "u-kp6268",
   "title": "А теперь не смотри",
   "year": 1973,
   "similarity": 0.47
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.418
  },
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.404
  },
  {
   "key": "tmdb:779",
   "workId": "f-tmdb779",
   "title": "Вампир: Сон Алена Грея",
   "year": 1932,
   "similarity": 0.396
  },
  {
   "key": "tmdb:18333",
   "workId": "f-tmdb18333",
   "title": "Час волка",
   "year": 1968,
   "similarity": 0.374
  }
 ],
 "tmdb:3109": [
  {
   "key": "tmdb:581",
   "workId": "f-tmdb581",
   "title": "Танцующий с волками",
   "year": 1990,
   "similarity": 0.355
  },
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.305
  },
  {
   "key": "tmdb:3114",
   "workId": "f-tmdb3114",
   "title": "Искатели",
   "year": 1956,
   "similarity": 0.294
  },
  {
   "key": "tmdb:642",
   "workId": "f-tmdb642",
   "title": "Буч Кэссиди и Сандэнс Кид",
   "year": 1969,
   "similarity": 0.286
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.274
  }
 ],
 "tmdb:3112": [
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.437
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.397
  },
  {
   "key": "tmdb:16391",
   "workId": "f-tmdb16391",
   "title": "Чёрный нарцисс",
   "year": 1947,
   "similarity": 0.372
  },
  {
   "key": "tmdb:3133",
   "workId": "f-tmdb3133",
   "title": "Пустоши",
   "year": 1973,
   "similarity": 0.358
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.357
  }
 ],
 "tmdb:31121": [
  {
   "key": "tmdb:1412",
   "workId": "f-tmdb1412",
   "title": "Секс, ложь и видео",
   "year": 1989,
   "similarity": 0.482
  },
  {
   "key": "tmdb:9576",
   "workId": "f-tmdb9576",
   "title": "Тутси",
   "year": 1982,
   "similarity": 0.466
  },
  {
   "key": "tmdb:11300",
   "workId": "f-tmdb11300",
   "title": "Дикая штучка",
   "year": 1986,
   "similarity": 0.45
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.412
  },
  {
   "key": "tmdb:13891",
   "workId": "f-tmdb13891",
   "title": "Гражданка Рут",
   "year": 1996,
   "similarity": 0.375
  }
 ],
 "tmdb:3114": [
  {
   "key": "tmdb:995",
   "workId": "f-tmdb995",
   "title": "Дилижанс",
   "year": 1939,
   "similarity": 0.573
  },
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.507
  },
  {
   "key": "tmdb:288",
   "workId": "f-tmdb288",
   "title": "Ровно в полдень",
   "year": 1952,
   "similarity": 0.456
  },
  {
   "key": "tmdb:33",
   "workId": "f-tmdb33",
   "title": "Непрощённый",
   "year": 1992,
   "similarity": 0.42
  },
  {
   "key": "tmdb:44264",
   "workId": "f-tmdb44264",
   "title": "Железная хватка",
   "year": 2010,
   "similarity": 0.394
  }
 ],
 "tmdb:3116": [
  {
   "key": "tmdb:702",
   "workId": "f-tmdb702",
   "title": "Трамвай «Желание»",
   "year": 1951,
   "similarity": 0.322
  },
  {
   "key": "tmdb:79120",
   "workId": "f-tmdb79120",
   "title": "Уикенд",
   "year": 2011,
   "similarity": 0.321
  },
  {
   "key": "tmdb:968",
   "workId": "f-tmdb968",
   "title": "Собачий полдень",
   "year": 1975,
   "similarity": 0.292
  },
  {
   "key": "tmdb:25188",
   "workId": "f-tmdb25188",
   "title": "Последний киносеанс",
   "year": 1971,
   "similarity": 0.289
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.288
  }
 ],
 "tmdb:3121": [
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.358
  },
  {
   "key": "tmdb:266",
   "workId": "f-tmdb266",
   "title": "Презрение",
   "year": 1963,
   "similarity": 0.349
  },
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.344
  },
  {
   "key": "tmdb:26596",
   "workId": "f-tmdb26596",
   "title": "Джонни-гитара",
   "year": 1954,
   "similarity": 0.343
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.321
  }
 ],
 "tmdb:31225": [
  {
   "key": "tmdb:11703",
   "workId": "f-tmdb11703",
   "title": "Поцелуй женщины-паука",
   "year": 1985,
   "similarity": 0.579
  },
  {
   "key": "tmdb:9576",
   "workId": "f-tmdb9576",
   "title": "Тутси",
   "year": 1982,
   "similarity": 0.533
  },
  {
   "key": "tmdb:79120",
   "workId": "f-tmdb79120",
   "title": "Уикенд",
   "year": 2011,
   "similarity": 0.524
  },
  {
   "key": "tmdb:47620",
   "workId": "f-tmdb47620",
   "title": "Отрава",
   "year": 1991,
   "similarity": 0.448
  },
  {
   "key": "tmdb:18620",
   "workId": "f-tmdb18620",
   "title": "Go Fish",
   "year": 1994,
   "similarity": 0.42
  }
 ],
 "tmdb:3131": [
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.367
  },
  {
   "key": "tmdb:238",
   "workId": "f-tmdb238",
   "title": "Крёстный отец",
   "year": 1972,
   "similarity": 0.352
  },
  {
   "key": "tmdb:1422",
   "workId": "f-tmdb1422",
   "title": "Отступники",
   "year": 2006,
   "similarity": 0.343
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.334
  },
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.318
  }
 ],
 "tmdb:3133": [
  {
   "key": "tmdb:16642",
   "workId": "f-tmdb16642",
   "title": "Дни жатвы",
   "year": 1978,
   "similarity": 0.469
  },
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.424
  },
  {
   "key": "tmdb:405",
   "workId": "f-tmdb405",
   "title": "Дорога",
   "year": 1954,
   "similarity": 0.42
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.385
  },
  {
   "key": "tmdb:26039",
   "workId": "f-tmdb26039",
   "title": "В упор",
   "year": 1967,
   "similarity": 0.364
  }
 ],
 "tmdb:31442": [
  {
   "key": "tmdb:15244",
   "workId": "f-tmdb15244",
   "title": "Приговоренный к смерти бежал, или Дух веет, где хочет",
   "year": 1956,
   "similarity": 0.449
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.446
  },
  {
   "key": "tmdb:803",
   "workId": "f-tmdb803",
   "title": "Ночь и туман",
   "year": 1956,
   "similarity": 0.444
  },
  {
   "key": "tmdb:5544",
   "workId": "f-tmdb5544",
   "title": "Хиросима, любовь моя",
   "year": 1959,
   "similarity": 0.422
  },
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.408
  }
 ],
 "tmdb:31657": [
  {
   "key": "tmdb:2604",
   "workId": "f-tmdb2604",
   "title": "Рождённый четвёртого июля",
   "year": 1989,
   "similarity": 0.618
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.571
  },
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.52
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.502
  },
  {
   "key": "tmdb:2440",
   "workId": "f-tmdb2440",
   "title": "Объединённая зона безопасности",
   "year": 2000,
   "similarity": 0.47
  }
 ],
 "tmdb:3175": [
  {
   "key": "tmdb:16642",
   "workId": "f-tmdb16642",
   "title": "Дни жатвы",
   "year": 1978,
   "similarity": 0.304
  },
  {
   "key": "tmdb:10404",
   "workId": "f-tmdb10404",
   "title": "Подними красный фонарь",
   "year": 1991,
   "similarity": 0.252
  }
 ],
 "tmdb:320": [
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.392
  },
  {
   "key": "tmdb:2118",
   "workId": "f-tmdb2118",
   "title": "Секреты Лос-Анджелеса",
   "year": 1997,
   "similarity": 0.357
  },
  {
   "key": "tmdb:10795",
   "workId": "u-kp22936",
   "title": "Не говори никому",
   "year": 2006,
   "similarity": 0.353
  },
  {
   "key": "tmdb:1538",
   "workId": "f-tmdb1538",
   "title": "Соучастник",
   "year": 2004,
   "similarity": 0.345
  },
  {
   "key": "tmdb:65754",
   "workId": "f-tmdb65754",
   "title": "Девушка с татуировкой дракона",
   "year": 2011,
   "similarity": 0.321
  }
 ],
 "tmdb:32044": [
  {
   "key": "tmdb:26039",
   "workId": "f-tmdb26039",
   "title": "В упор",
   "year": 1967,
   "similarity": 0.32
  },
  {
   "key": "tmdb:29005",
   "workId": "f-tmdb29005",
   "title": "МакКейб и миссис Миллер",
   "year": 1971,
   "similarity": 0.303
  },
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.287
  },
  {
   "key": "tmdb:8052",
   "workId": "f-tmdb8052",
   "title": "Роковая восьмерка",
   "year": 1997,
   "similarity": 0.27
  },
  {
   "key": "tmdb:17365",
   "workId": "f-tmdb17365",
   "title": "Заговор «Параллакс»",
   "year": 1974,
   "similarity": 0.265
  }
 ],
 "tmdb:322": [
  {
   "key": "tmdb:1422",
   "workId": "f-tmdb1422",
   "title": "Отступники",
   "year": 2006,
   "similarity": 0.554
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.548
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.487
  },
  {
   "key": "tmdb:470",
   "workId": "f-tmdb470",
   "title": "21 грамм",
   "year": 2003,
   "similarity": 0.485
  },
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.478
  }
 ],
 "tmdb:32646": [
  {
   "key": "tmdb:452",
   "workId": "f-tmdb452",
   "title": "Идиоты",
   "year": 1998,
   "similarity": 0.452
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.392
  },
  {
   "key": "tmdb:38810",
   "workId": "f-tmdb38810",
   "title": "Клык",
   "year": 2009,
   "similarity": 0.379
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.362
  },
  {
   "key": "tmdb:42113",
   "workId": "f-tmdb42113",
   "title": "Легенда о Нараяме",
   "year": 1983,
   "similarity": 0.345
  }
 ],
 "tmdb:329": [
  {
   "key": "tmdb:254",
   "workId": "f-tmdb254",
   "title": "Кинг Конг",
   "year": 2005,
   "similarity": 0.537
  },
  {
   "key": "tmdb:620",
   "workId": "f-tmdb620",
   "title": "Охотники за привидениями",
   "year": 1984,
   "similarity": 0.513
  },
  {
   "key": "tmdb:601",
   "workId": "f-tmdb601",
   "title": "Инопланетянин",
   "year": 1982,
   "similarity": 0.506
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.496
  },
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.479
  }
 ],
 "tmdb:32985": [
  {
   "key": "tmdb:11976",
   "workId": "l-tmdb11976",
   "title": "Легенда",
   "year": 1985,
   "similarity": 0.474
  },
  {
   "key": "tmdb:1487",
   "workId": "f-tmdb1487",
   "title": "Хеллбой: Герой из пекла",
   "year": 2004,
   "similarity": 0.465
  },
  {
   "key": "tmdb:1495",
   "workId": "f-tmdb1495",
   "title": "Царство небесное",
   "year": 2005,
   "similarity": 0.459
  },
  {
   "key": "tmdb:38319",
   "workId": "l-tmdb38319",
   "title": "Храбрые перцем",
   "year": 2011,
   "similarity": 0.449
  },
  {
   "key": "tmdb:9593",
   "workId": "f-tmdb9593",
   "title": "Последний киногерой",
   "year": 1993,
   "similarity": 0.417
  }
 ],
 "tmdb:33": [
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.506
  },
  {
   "key": "tmdb:995",
   "workId": "f-tmdb995",
   "title": "Дилижанс",
   "year": 1939,
   "similarity": 0.454
  },
  {
   "key": "tmdb:68718",
   "workId": "f-tmdb68718",
   "title": "Джанго освобождённый",
   "year": 2012,
   "similarity": 0.439
  },
  {
   "key": "tmdb:903",
   "workId": "f-tmdb903",
   "title": "Хладнокровный Люк",
   "year": 1967,
   "similarity": 0.426
  },
  {
   "key": "tmdb:3114",
   "workId": "f-tmdb3114",
   "title": "Искатели",
   "year": 1956,
   "similarity": 0.42
  }
 ],
 "tmdb:3309": [
  {
   "key": "tmdb:25736",
   "workId": "f-tmdb25736",
   "title": "Почтальон всегда звонит дважды",
   "year": 1946,
   "similarity": 0.479
  },
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.451
  },
  {
   "key": "tmdb:223",
   "workId": "f-tmdb223",
   "title": "Ребекка",
   "year": 1940,
   "similarity": 0.434
  },
  {
   "key": "tmdb:17057",
   "workId": "f-tmdb17057",
   "title": "В укромном месте",
   "year": 1950,
   "similarity": 0.399
  },
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.395
  }
 ],
 "tmdb:33324": [
  {
   "key": "tmdb:669",
   "workId": "f-tmdb669",
   "title": "Нанук с Севера",
   "year": 1922,
   "similarity": 0.316
  },
  {
   "key": "tmdb:20108",
   "workId": "f-tmdb20108",
   "title": "Наудачу, Бальтазар",
   "year": 1966,
   "similarity": 0.302
  },
  {
   "key": "tmdb:14285",
   "workId": "f-tmdb14285",
   "title": "Тонкая голубая линия",
   "year": 1988,
   "similarity": 0.273
  },
  {
   "key": "tmdb:29005",
   "workId": "f-tmdb29005",
   "title": "МакКейб и миссис Миллер",
   "year": 1971,
   "similarity": 0.269
  },
  {
   "key": "tmdb:27375",
   "workId": "f-tmdb27375",
   "title": "Коммивояжер",
   "year": 1969,
   "similarity": 0.263
  }
 ],
 "tmdb:334": [
  {
   "key": "tmdb:14",
   "workId": "f-tmdb14",
   "title": "Красота по-американски",
   "year": 1999,
   "similarity": 0.513
  },
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.476
  },
  {
   "key": "tmdb:470",
   "workId": "f-tmdb470",
   "title": "21 грамм",
   "year": 2003,
   "similarity": 0.45
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.436
  },
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.43
  }
 ],
 "tmdb:33680": [
  {
   "key": "tmdb:20325",
   "workId": "f-tmdb20325",
   "title": "Время свинга",
   "year": 1936,
   "similarity": 0.433
  },
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.413
  },
  {
   "key": "tmdb:851",
   "workId": "f-tmdb851",
   "title": "Короткая встреча",
   "year": 1945,
   "similarity": 0.403
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.401
  },
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.383
  }
 ],
 "tmdb:343": [
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.483
  },
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.447
  },
  {
   "key": "tmdb:1382",
   "workId": "f-tmdb1382",
   "title": "Я и ты и все, кого мы знаем",
   "year": 2005,
   "similarity": 0.435
  },
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.395
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.392
  }
 ],
 "tmdb:346": [
  {
   "key": "tmdb:11878",
   "workId": "f-tmdb11878",
   "title": "Телохранитель",
   "year": 1961,
   "similarity": 0.641
  },
  {
   "key": "tmdb:11953",
   "workId": "f-tmdb11953",
   "title": "Кагемуся: Тень воина",
   "year": 1980,
   "similarity": 0.577
  },
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.527
  },
  {
   "key": "tmdb:548",
   "workId": "w02",
   "title": "Расёмон",
   "year": 1950,
   "similarity": 0.518
  },
  {
   "key": "tmdb:11712",
   "workId": "f-tmdb11712",
   "title": "Телохранитель 2: Отважный Сандзюро",
   "year": 1962,
   "similarity": 0.471
  }
 ],
 "tmdb:3509": [
  {
   "key": "tmdb:9081",
   "workId": "f-tmdb9081",
   "title": "Пробуждение жизни",
   "year": 2001,
   "similarity": 0.507
  },
  {
   "key": "tmdb:10494",
   "workId": "c-perfect-blue",
   "title": "Идеальная грусть",
   "year": 1997,
   "similarity": 0.44
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.419
  },
  {
   "key": "tmdb:63",
   "workId": "f-tmdb63",
   "title": "12 обезьян",
   "year": 1995,
   "similarity": 0.36
  },
  {
   "key": "tmdb:281",
   "workId": "f-tmdb281",
   "title": "Странные дни",
   "year": 1995,
   "similarity": 0.358
  }
 ],
 "tmdb:3529": [
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.513
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.503
  },
  {
   "key": "tmdb:900",
   "workId": "f-tmdb900",
   "title": "Воспитание крошки",
   "year": 1938,
   "similarity": 0.486
  },
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.476
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.437
  }
 ],
 "tmdb:36657": [
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.882
  },
  {
   "key": "tmdb:558",
   "workId": "f-tmdb558",
   "title": "Человек-паук 2",
   "year": 2004,
   "similarity": 0.787
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.779
  },
  {
   "key": "tmdb:1724",
   "workId": "f-tmdb1724",
   "title": "Невероятный Халк",
   "year": 2008,
   "similarity": 0.775
  },
  {
   "key": "tmdb:557",
   "workId": "f-tmdb557",
   "title": "Человек-паук",
   "year": 2002,
   "similarity": 0.764
  }
 ],
 "tmdb:36658": [
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.882
  },
  {
   "key": "tmdb:558",
   "workId": "f-tmdb558",
   "title": "Человек-паук 2",
   "year": 2004,
   "similarity": 0.829
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.801
  },
  {
   "key": "tmdb:1724",
   "workId": "f-tmdb1724",
   "title": "Невероятный Халк",
   "year": 2008,
   "similarity": 0.793
  },
  {
   "key": "tmdb:557",
   "workId": "f-tmdb557",
   "title": "Человек-паук",
   "year": 2002,
   "similarity": 0.789
  }
 ],
 "tmdb:36955": [
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.675
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.652
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.609
  },
  {
   "key": "tmdb:754",
   "workId": "f-tmdb754",
   "title": "Без лица",
   "year": 1997,
   "similarity": 0.584
  },
  {
   "key": "tmdb:9593",
   "workId": "f-tmdb9593",
   "title": "Последний киногерой",
   "year": 1993,
   "similarity": 0.547
  }
 ],
 "tmdb:37080": [
  {
   "key": "tmdb:452",
   "workId": "f-tmdb452",
   "title": "Идиоты",
   "year": 1998,
   "similarity": 0.466
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.44
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.439
  },
  {
   "key": "tmdb:11159",
   "workId": "f-tmdb11159",
   "title": "Тайны и ложь",
   "year": 1996,
   "similarity": 0.435
  },
  {
   "key": "tmdb:10436",
   "workId": "f-tmdb10436",
   "title": "Эпоха невинности",
   "year": 1993,
   "similarity": 0.425
  }
 ],
 "tmdb:37165": [
  {
   "key": "tmdb:782",
   "workId": "u-kp5012",
   "title": "Гаттака",
   "year": 1997,
   "similarity": 0.445
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.359
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.339
  },
  {
   "key": "tmdb:27205",
   "workId": "w08",
   "title": "Начало",
   "year": 2010,
   "similarity": 0.335
  },
  {
   "key": "tmdb:180",
   "workId": "f-tmdb180",
   "title": "Особое мнение",
   "year": 2002,
   "similarity": 0.319
  }
 ],
 "tmdb:37247": [
  {
   "key": "tmdb:284",
   "workId": "f-tmdb284",
   "title": "Квартира",
   "year": 1960,
   "similarity": 0.364
  },
  {
   "key": "tmdb:343",
   "workId": "f-tmdb343",
   "title": "Гарольд и Мод",
   "year": 1971,
   "similarity": 0.34
  },
  {
   "key": "tmdb:25188",
   "workId": "f-tmdb25188",
   "title": "Последний киносеанс",
   "year": 1971,
   "similarity": 0.33
  },
  {
   "key": "tmdb:838",
   "workId": "f-tmdb838",
   "title": "Американские граффити",
   "year": 1973,
   "similarity": 0.318
  },
  {
   "key": "tmdb:1391",
   "workId": "f-tmdb1391",
   "title": "И твою маму тоже",
   "year": 2001,
   "similarity": 0.314
  }
 ],
 "tmdb:37257": [
  {
   "key": "tmdb:93",
   "workId": "f-tmdb93",
   "title": "Анатомия убийства",
   "year": 1959,
   "similarity": 0.585
  },
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.574
  },
  {
   "key": "tmdb:993",
   "workId": "c-sleuth",
   "title": "Сыщик",
   "year": 1972,
   "similarity": 0.528
  },
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.48
  },
  {
   "key": "tmdb:845",
   "workId": "f-tmdb845",
   "title": "Незнакомцы в поезде",
   "year": 1951,
   "similarity": 0.454
  }
 ],
 "tmdb:37724": [
  {
   "key": "tmdb:2503",
   "workId": "f-tmdb2503",
   "title": "Ультиматум Борна",
   "year": 2007,
   "similarity": 0.537
  },
  {
   "key": "tmdb:2502",
   "workId": "f-tmdb2502",
   "title": "Превосходство Борна",
   "year": 2004,
   "similarity": 0.472
  },
  {
   "key": "tmdb:2501",
   "workId": "f-tmdb2501",
   "title": "Идентификация Борна",
   "year": 2002,
   "similarity": 0.449
  },
  {
   "key": "tmdb:11963",
   "workId": "f-tmdb11963",
   "title": "Три дня Кондора",
   "year": 1975,
   "similarity": 0.42
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.39
  }
 ],
 "tmdb:37799": [
  {
   "key": "tmdb:380",
   "workId": "f-tmdb380",
   "title": "Человек дождя",
   "year": 1988,
   "similarity": 0.428
  },
  {
   "key": "tmdb:453",
   "workId": "f-tmdb453",
   "title": "Игры разума",
   "year": 2001,
   "similarity": 0.339
  },
  {
   "key": "tmdb:2567",
   "workId": "f-tmdb2567",
   "title": "Авиатор",
   "year": 2004,
   "similarity": 0.322
  },
  {
   "key": "tmdb:106646",
   "workId": "f-tmdb106646",
   "title": "Волк с Уолл-стрит",
   "year": 2013,
   "similarity": 0.321
  },
  {
   "key": "tmdb:22947",
   "workId": "f-tmdb22947",
   "title": "Мне бы в небо",
   "year": 2009,
   "similarity": 0.291
  }
 ],
 "tmdb:378": [
  {
   "key": "tmdb:992",
   "workId": "f-tmdb992",
   "title": "Шерлок младший",
   "year": 1924,
   "similarity": 0.398
  },
  {
   "key": "tmdb:4638",
   "workId": "u-kp93377",
   "title": "Типа крутые легавые",
   "year": 2007,
   "similarity": 0.379
  },
  {
   "key": "tmdb:134",
   "workId": "f-tmdb134",
   "title": "О, где же ты, брат?",
   "year": 2000,
   "similarity": 0.371
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.369
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.357
  }
 ],
 "tmdb:3780": [
  {
   "key": "tmdb:11712",
   "workId": "f-tmdb11712",
   "title": "Телохранитель 2: Отважный Сандзюро",
   "year": 1962,
   "similarity": 0.563
  },
  {
   "key": "tmdb:12493",
   "workId": "f-tmdb12493",
   "title": "Рай и ад",
   "year": 1963,
   "similarity": 0.562
  },
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.523
  },
  {
   "key": "tmdb:548",
   "workId": "w02",
   "title": "Расёмон",
   "year": 1950,
   "similarity": 0.488
  },
  {
   "key": "tmdb:11878",
   "workId": "f-tmdb11878",
   "title": "Телохранитель",
   "year": 1961,
   "similarity": 0.486
  }
 ],
 "tmdb:379": [
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.603
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.569
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.516
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.513
  },
  {
   "key": "tmdb:26039",
   "workId": "f-tmdb26039",
   "title": "В упор",
   "year": 1967,
   "similarity": 0.491
  }
 ],
 "tmdb:37903": [
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.463
  },
  {
   "key": "tmdb:11710",
   "workId": "f-tmdb11710",
   "title": "Каждый за себя, а Бог против всех",
   "year": 1974,
   "similarity": 0.44
  },
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.431
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.428
  },
  {
   "key": "tmdb:4495",
   "workId": "f-tmdb4495",
   "title": "Дух улья",
   "year": 1973,
   "similarity": 0.426
  }
 ],
 "tmdb:38": [
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.516
  },
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.502
  },
  {
   "key": "tmdb:492",
   "workId": "f-tmdb492",
   "title": "Быть Джоном Малковичем",
   "year": 1999,
   "similarity": 0.451
  },
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.449
  },
  {
   "key": "tmdb:334",
   "workId": "f-tmdb334",
   "title": "Магнолия",
   "year": 1999,
   "similarity": 0.436
  }
 ],
 "tmdb:380": [
  {
   "key": "tmdb:453",
   "workId": "f-tmdb453",
   "title": "Игры разума",
   "year": 2001,
   "similarity": 0.544
  },
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.432
  },
  {
   "key": "tmdb:37799",
   "workId": "f-tmdb37799",
   "title": "Социальная сеть",
   "year": 2010,
   "similarity": 0.428
  },
  {
   "key": "tmdb:13",
   "workId": "f-tmdb13",
   "title": "Форрест Гамп",
   "year": 1994,
   "similarity": 0.423
  },
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.397
  }
 ],
 "tmdb:38319": [
  {
   "key": "tmdb:9593",
   "workId": "f-tmdb9593",
   "title": "Последний киногерой",
   "year": 1993,
   "similarity": 0.575
  },
  {
   "key": "tmdb:32985",
   "workId": "l-tmdb32985",
   "title": "Соломон Кейн",
   "year": 2009,
   "similarity": 0.449
  },
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.43
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.417
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.408
  }
 ],
 "tmdb:38810": [
  {
   "key": "tmdb:452",
   "workId": "f-tmdb452",
   "title": "Идиоты",
   "year": 1998,
   "similarity": 0.515
  },
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.495
  },
  {
   "key": "tmdb:17609",
   "workId": "f-tmdb17609",
   "title": "Антихрист",
   "year": 2009,
   "similarity": 0.462
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.445
  },
  {
   "key": "tmdb:649",
   "workId": "f-tmdb649",
   "title": "Дневная красавица",
   "year": 1967,
   "similarity": 0.439
  }
 ],
 "tmdb:389": [
  {
   "key": "tmdb:595",
   "workId": "f-tmdb595",
   "title": "Убить пересмешника",
   "year": 1962,
   "similarity": 0.536
  },
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.518
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.483
  },
  {
   "key": "tmdb:37257",
   "workId": "f-tmdb37257",
   "title": "Свидетель обвинения",
   "year": 1957,
   "similarity": 0.48
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.477
  }
 ],
 "tmdb:39538": [
  {
   "key": "tmdb:4547",
   "workId": "f-tmdb4547",
   "title": "Комната страха",
   "year": 2002,
   "similarity": 0.391
  },
  {
   "key": "tmdb:29917",
   "workId": "u-kp418762",
   "title": "Экзамен",
   "year": 2009,
   "similarity": 0.346
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.311
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.301
  },
  {
   "key": "tmdb:6947",
   "workId": "l-tmdb6947",
   "title": "Таинственный лес",
   "year": 2004,
   "similarity": 0.299
  }
 ],
 "tmdb:396": [
  {
   "key": "tmdb:492",
   "workId": "f-tmdb492",
   "title": "Быть Джоном Малковичем",
   "year": 1999,
   "similarity": 0.328
  },
  {
   "key": "tmdb:10774",
   "workId": "f-tmdb10774",
   "title": "Телесеть",
   "year": 1976,
   "similarity": 0.311
  },
  {
   "key": "tmdb:1919",
   "workId": "f-tmdb1919",
   "title": "Вдали от неё",
   "year": 2007,
   "similarity": 0.277
  },
  {
   "key": "tmdb:702",
   "workId": "f-tmdb702",
   "title": "Трамвай «Желание»",
   "year": 1951,
   "similarity": 0.274
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.273
  }
 ],
 "tmdb:401": [
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.543
  },
  {
   "key": "tmdb:14",
   "workId": "f-tmdb14",
   "title": "Красота по-американски",
   "year": 1999,
   "similarity": 0.487
  },
  {
   "key": "tmdb:334",
   "workId": "f-tmdb334",
   "title": "Магнолия",
   "year": 1999,
   "similarity": 0.476
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.449
  },
  {
   "key": "tmdb:82693",
   "workId": "f-tmdb82693",
   "title": "Мой парень – псих",
   "year": 2012,
   "similarity": 0.41
  }
 ],
 "tmdb:402": [
  {
   "key": "tmdb:10998",
   "workId": "f-tmdb10998",
   "title": "Роковое влечение",
   "year": 1987,
   "similarity": 0.521
  },
  {
   "key": "tmdb:11033",
   "workId": "f-tmdb11033",
   "title": "Бритва",
   "year": 1980,
   "similarity": 0.481
  },
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.45
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.407
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.396
  }
 ],
 "tmdb:4024": [
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.697
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.579
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.579
  },
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.574
  },
  {
   "key": "tmdb:144",
   "workId": "f-tmdb144",
   "title": "Небо над Берлином",
   "year": 1987,
   "similarity": 0.548
  }
 ],
 "tmdb:404": [
  {
   "key": "tmdb:2013",
   "workId": "f-tmdb2013",
   "title": "Скафандр и бабочка",
   "year": 2007,
   "similarity": 0.356
  },
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.321
  },
  {
   "key": "tmdb:1919",
   "workId": "f-tmdb1919",
   "title": "Вдали от неё",
   "year": 2007,
   "similarity": 0.29
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.285
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.285
  }
 ],
 "tmdb:405": [
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.518
  },
  {
   "key": "tmdb:439",
   "workId": "f-tmdb439",
   "title": "Сладкая жизнь",
   "year": 1960,
   "similarity": 0.498
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.493
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.475
  },
  {
   "key": "tmdb:147",
   "workId": "f-tmdb147",
   "title": "Четыреста ударов",
   "year": 1959,
   "similarity": 0.466
  }
 ],
 "tmdb:406": [
  {
   "key": "tmdb:216",
   "workId": "f-tmdb216",
   "title": "Страх съедает душу",
   "year": 1974,
   "similarity": 0.313
  },
  {
   "key": "tmdb:147",
   "workId": "f-tmdb147",
   "title": "Четыреста ударов",
   "year": 1959,
   "similarity": 0.288
  },
  {
   "key": "tmdb:8321",
   "workId": "u-kp276295",
   "title": "Залечь на дно в Брюгге",
   "year": 2007,
   "similarity": 0.276
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.268
  },
  {
   "key": "tmdb:553",
   "workId": "f-tmdb553",
   "title": "Догвилль",
   "year": 2003,
   "similarity": 0.255
  }
 ],
 "tmdb:41050": [
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.605
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.577
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.476
  },
  {
   "key": "tmdb:266",
   "workId": "f-tmdb266",
   "title": "Презрение",
   "year": 1963,
   "similarity": 0.458
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.43
  }
 ],
 "tmdb:41215": [
  {
   "key": "tmdb:23488",
   "workId": "l-tmdb23488",
   "title": "Дориан Грей",
   "year": 2009,
   "similarity": 0.65
  },
  {
   "key": "tmdb:32985",
   "workId": "l-tmdb32985",
   "title": "Соломон Кейн",
   "year": 2009,
   "similarity": 0.332
  },
  {
   "key": "tmdb:8619",
   "workId": "f-tmdb8619",
   "title": "Хозяин морей: На краю Земли",
   "year": 2003,
   "similarity": 0.32
  },
  {
   "key": "tmdb:82507",
   "workId": "l-tmdb82507",
   "title": "Синистер",
   "year": 2012,
   "similarity": 0.307
  },
  {
   "key": "tmdb:1495",
   "workId": "f-tmdb1495",
   "title": "Царство небесное",
   "year": 2005,
   "similarity": 0.294
  }
 ],
 "tmdb:41662": [
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.601
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.539
  },
  {
   "key": "tmdb:18333",
   "workId": "f-tmdb18333",
   "title": "Час волка",
   "year": 1968,
   "similarity": 0.517
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.493
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.491
  }
 ],
 "tmdb:42102": [
  {
   "key": "tmdb:29263",
   "workId": "f-tmdb29263",
   "title": "Официальная версия",
   "year": 1985,
   "similarity": 0.318
  },
  {
   "key": "tmdb:42113",
   "workId": "f-tmdb42113",
   "title": "Легенда о Нараяме",
   "year": 1983,
   "similarity": 0.292
  },
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.276
  }
 ],
 "tmdb:42113": [
  {
   "key": "tmdb:9764",
   "workId": "f-tmdb9764",
   "title": "Дерсу Узала",
   "year": 1975,
   "similarity": 0.456
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.419
  },
  {
   "key": "tmdb:669",
   "workId": "f-tmdb669",
   "title": "Нанук с Севера",
   "year": 1922,
   "similarity": 0.409
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.399
  },
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.389
  }
 ],
 "tmdb:42148": [
  {
   "key": "tmdb:666",
   "workId": "f-tmdb666",
   "title": "Центральный вокзал",
   "year": 1998,
   "similarity": 0.345
  },
  {
   "key": "tmdb:11703",
   "workId": "f-tmdb11703",
   "title": "Поцелуй женщины-паука",
   "year": 1985,
   "similarity": 0.311
  },
  {
   "key": "tmdb:31225",
   "workId": "f-tmdb31225",
   "title": "Париж в огне",
   "year": 1991,
   "similarity": 0.305
  },
  {
   "key": "tmdb:21450",
   "workId": "f-tmdb21450",
   "title": "Обнаженная",
   "year": 1993,
   "similarity": 0.298
  },
  {
   "key": "tmdb:20108",
   "workId": "f-tmdb20108",
   "title": "Наудачу, Бальтазар",
   "year": 1966,
   "similarity": 0.297
  }
 ],
 "tmdb:422": [
  {
   "key": "tmdb:439",
   "workId": "f-tmdb439",
   "title": "Сладкая жизнь",
   "year": 1960,
   "similarity": 0.428
  },
  {
   "key": "tmdb:2786",
   "workId": "f-tmdb2786",
   "title": "Безумный Пьеро",
   "year": 1965,
   "similarity": 0.396
  },
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.392
  },
  {
   "key": "tmdb:7857",
   "workId": "f-tmdb7857",
   "title": "Амаркорд",
   "year": 1973,
   "similarity": 0.377
  },
  {
   "key": "tmdb:132344",
   "workId": "f-tmdb132344",
   "title": "Перед полуночью",
   "year": 2013,
   "similarity": 0.377
  }
 ],
 "tmdb:423": [
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.727
  },
  {
   "key": "tmdb:637",
   "workId": "f-tmdb637",
   "title": "Жизнь прекрасна",
   "year": 1997,
   "similarity": 0.607
  },
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.59
  },
  {
   "key": "tmdb:1251",
   "workId": "f-tmdb1251",
   "title": "Письма с Иводзимы",
   "year": 2006,
   "similarity": 0.509
  },
  {
   "key": "tmdb:76203",
   "workId": "f-tmdb76203",
   "title": "12 лет рабства",
   "year": 2013,
   "similarity": 0.469
  }
 ],
 "tmdb:424": [
  {
   "key": "tmdb:637",
   "workId": "f-tmdb637",
   "title": "Жизнь прекрасна",
   "year": 1997,
   "similarity": 0.734
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.727
  },
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.679
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.525
  },
  {
   "key": "tmdb:887",
   "workId": "f-tmdb887",
   "title": "Лучшие годы нашей жизни",
   "year": 1946,
   "similarity": 0.507
  }
 ],
 "tmdb:426": [
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.582
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.575
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.564
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.545
  },
  {
   "key": "tmdb:567",
   "workId": "f-tmdb567",
   "title": "Окно во двор",
   "year": 1954,
   "similarity": 0.523
  }
 ],
 "tmdb:427": [
  {
   "key": "tmdb:10227",
   "workId": "f-tmdb10227",
   "title": "Время развлечений",
   "year": 1967,
   "similarity": 0.514
  },
  {
   "key": "tmdb:669",
   "workId": "f-tmdb669",
   "title": "Нанук с Севера",
   "year": 1922,
   "similarity": 0.319
  },
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.316
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.284
  },
  {
   "key": "tmdb:7857",
   "workId": "f-tmdb7857",
   "title": "Амаркорд",
   "year": 1973,
   "similarity": 0.281
  }
 ],
 "tmdb:439": [
  {
   "key": "tmdb:405",
   "workId": "f-tmdb405",
   "title": "Дорога",
   "year": 1954,
   "similarity": 0.498
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.488
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.487
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.463
  },
  {
   "key": "tmdb:5156",
   "workId": "f-tmdb5156",
   "title": "Похитители велосипедов",
   "year": 1948,
   "similarity": 0.441
  }
 ],
 "tmdb:44264": [
  {
   "key": "tmdb:3114",
   "workId": "f-tmdb3114",
   "title": "Искатели",
   "year": 1956,
   "similarity": 0.394
  },
  {
   "key": "tmdb:33",
   "workId": "f-tmdb33",
   "title": "Непрощённый",
   "year": 1992,
   "similarity": 0.387
  },
  {
   "key": "tmdb:68718",
   "workId": "f-tmdb68718",
   "title": "Джанго освобождённый",
   "year": 2012,
   "similarity": 0.361
  },
  {
   "key": "tmdb:995",
   "workId": "f-tmdb995",
   "title": "Дилижанс",
   "year": 1939,
   "similarity": 0.346
  },
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.339
  }
 ],
 "tmdb:44754": [
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.463
  },
  {
   "key": "tmdb:157386",
   "workId": "f-tmdb157386",
   "title": "Захватывающее время",
   "year": 2013,
   "similarity": 0.455
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.449
  },
  {
   "key": "tmdb:27845",
   "workId": "f-tmdb27845",
   "title": "Истина в вине",
   "year": 1996,
   "similarity": 0.441
  },
  {
   "key": "tmdb:11300",
   "workId": "f-tmdb11300",
   "title": "Дикая штучка",
   "year": 1986,
   "similarity": 0.429
  }
 ],
 "tmdb:44826": [
  {
   "key": "tmdb:4922",
   "workId": "f-tmdb4922",
   "title": "Загадочная история Бенджамина Баттона",
   "year": 2008,
   "similarity": 0.351
  },
  {
   "key": "tmdb:19995",
   "workId": "f-tmdb19995",
   "title": "Аватар",
   "year": 2009,
   "similarity": 0.326
  },
  {
   "key": "tmdb:194",
   "workId": "f-tmdb194",
   "title": "Амели",
   "year": 2001,
   "similarity": 0.316
  },
  {
   "key": "tmdb:601",
   "workId": "f-tmdb601",
   "title": "Инопланетянин",
   "year": 1982,
   "similarity": 0.313
  },
  {
   "key": "tmdb:49047",
   "workId": "f-tmdb49047",
   "title": "Гравитация",
   "year": 2013,
   "similarity": 0.307
  }
 ],
 "tmdb:4488": [
  {
   "key": "tmdb:948",
   "workId": "f-tmdb948",
   "title": "Хэллоуин",
   "year": 1978,
   "similarity": 0.756
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.64
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.616
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.531
  },
  {
   "key": "tmdb:7340",
   "workId": "f-tmdb7340",
   "title": "Кэрри",
   "year": 1976,
   "similarity": 0.478
  }
 ],
 "tmdb:4495": [
  {
   "key": "tmdb:5801",
   "workId": "f-tmdb5801",
   "title": "Песнь дороги",
   "year": 1955,
   "similarity": 0.466
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.43
  },
  {
   "key": "tmdb:37903",
   "workId": "f-tmdb37903",
   "title": "Белая лента",
   "year": 2009,
   "similarity": 0.426
  },
  {
   "key": "tmdb:20108",
   "workId": "f-tmdb20108",
   "title": "Наудачу, Бальтазар",
   "year": 1966,
   "similarity": 0.411
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.392
  }
 ],
 "tmdb:4497": [
  {
   "key": "tmdb:29264",
   "workId": "f-tmdb29264",
   "title": "Ангел-истребитель",
   "year": 1962,
   "similarity": 0.559
  },
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.421
  },
  {
   "key": "tmdb:25364",
   "workId": "f-tmdb25364",
   "title": "Туз в рукаве",
   "year": 1951,
   "similarity": 0.395
  },
  {
   "key": "tmdb:16391",
   "workId": "f-tmdb16391",
   "title": "Чёрный нарцисс",
   "year": 1947,
   "similarity": 0.394
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.391
  }
 ],
 "tmdb:452": [
  {
   "key": "tmdb:38810",
   "workId": "f-tmdb38810",
   "title": "Клык",
   "year": 2009,
   "similarity": 0.515
  },
  {
   "key": "tmdb:145",
   "workId": "f-tmdb145",
   "title": "Рассекая волны",
   "year": 1996,
   "similarity": 0.5
  },
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.499
  },
  {
   "key": "tmdb:37080",
   "workId": "f-tmdb37080",
   "title": "Мать и дитя",
   "year": 2009,
   "similarity": 0.466
  },
  {
   "key": "tmdb:32646",
   "workId": "f-tmdb32646",
   "title": "Спасение",
   "year": 1995,
   "similarity": 0.452
  }
 ],
 "tmdb:453": [
  {
   "key": "tmdb:380",
   "workId": "f-tmdb380",
   "title": "Человек дождя",
   "year": 1988,
   "similarity": 0.544
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.348
  },
  {
   "key": "tmdb:37799",
   "workId": "f-tmdb37799",
   "title": "Социальная сеть",
   "year": 2010,
   "similarity": 0.339
  },
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.339
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.332
  }
 ],
 "tmdb:45317": [
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.526
  },
  {
   "key": "tmdb:157354",
   "workId": "f-tmdb157354",
   "title": "Станция «Фрутвейл»",
   "year": 2013,
   "similarity": 0.442
  },
  {
   "key": "tmdb:322",
   "workId": "f-tmdb322",
   "title": "Таинственная река",
   "year": 2003,
   "similarity": 0.441
  },
  {
   "key": "tmdb:1578",
   "workId": "f-tmdb1578",
   "title": "Бешеный бык",
   "year": 1980,
   "similarity": 0.41
  },
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.348
  }
 ],
 "tmdb:4547": [
  {
   "key": "tmdb:754",
   "workId": "f-tmdb754",
   "title": "Без лица",
   "year": 1997,
   "similarity": 0.457
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.431
  },
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.41
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.401
  },
  {
   "key": "tmdb:74",
   "workId": "f-tmdb74",
   "title": "Война миров",
   "year": 2005,
   "similarity": 0.399
  }
 ],
 "tmdb:4588": [
  {
   "key": "tmdb:8055",
   "workId": "f-tmdb8055",
   "title": "Чтец",
   "year": 2008,
   "similarity": 0.414
  },
  {
   "key": "tmdb:582",
   "workId": "f-tmdb582",
   "title": "Жизнь других",
   "year": 2006,
   "similarity": 0.342
  },
  {
   "key": "tmdb:661",
   "workId": "f-tmdb661",
   "title": "Замужество Марии Браун",
   "year": 1979,
   "similarity": 0.34
  },
  {
   "key": "tmdb:803",
   "workId": "f-tmdb803",
   "title": "Ночь и туман",
   "year": 1956,
   "similarity": 0.32
  },
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.311
  }
 ],
 "tmdb:4593": [
  {
   "key": "tmdb:5781",
   "workId": "f-tmdb5781",
   "title": "Этот смутный объект желания",
   "year": 1977,
   "similarity": 0.582
  },
  {
   "key": "tmdb:29264",
   "workId": "f-tmdb29264",
   "title": "Ангел-истребитель",
   "year": 1962,
   "similarity": 0.563
  },
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.455
  },
  {
   "key": "tmdb:18333",
   "workId": "f-tmdb18333",
   "title": "Час волка",
   "year": 1968,
   "similarity": 0.436
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.436
  }
 ],
 "tmdb:462": [
  {
   "key": "tmdb:9800",
   "workId": "f-tmdb9800",
   "title": "Филадельфия",
   "year": 1993,
   "similarity": 0.472
  },
  {
   "key": "tmdb:11050",
   "workId": "f-tmdb11050",
   "title": "Язык нежности",
   "year": 1983,
   "similarity": 0.467
  },
  {
   "key": "tmdb:22954",
   "workId": "f-tmdb22954",
   "title": "Непокорённый",
   "year": 2009,
   "similarity": 0.461
  },
  {
   "key": "tmdb:881",
   "workId": "f-tmdb881",
   "title": "Несколько хороших парней",
   "year": 1992,
   "similarity": 0.459
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.447
  }
 ],
 "tmdb:4638": [
  {
   "key": "tmdb:22970",
   "workId": "l-tmdb22970",
   "title": "Хижина в лесу",
   "year": 2012,
   "similarity": 0.403
  },
  {
   "key": "tmdb:378",
   "workId": "f-tmdb378",
   "title": "Воспитание Аризоны",
   "year": 1987,
   "similarity": 0.379
  },
  {
   "key": "tmdb:2292",
   "workId": "f-tmdb2292",
   "title": "Клерки",
   "year": 1994,
   "similarity": 0.309
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.309
  },
  {
   "key": "tmdb:620",
   "workId": "f-tmdb620",
   "title": "Охотники за привидениями",
   "year": 1984,
   "similarity": 0.303
  }
 ],
 "tmdb:46705": [
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.45
  },
  {
   "key": "tmdb:121986",
   "workId": "f-tmdb121986",
   "title": "Милая Фрэнсис",
   "year": 2013,
   "similarity": 0.437
  },
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.435
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.433
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.431
  }
 ],
 "tmdb:46738": [
  {
   "key": "tmdb:2440",
   "workId": "f-tmdb2440",
   "title": "Объединённая зона безопасности",
   "year": 2000,
   "similarity": 0.421
  },
  {
   "key": "tmdb:470",
   "workId": "f-tmdb470",
   "title": "21 грамм",
   "year": 2003,
   "similarity": 0.388
  },
  {
   "key": "tmdb:975",
   "workId": "f-tmdb975",
   "title": "Тропы славы",
   "year": 1957,
   "similarity": 0.373
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.365
  },
  {
   "key": "tmdb:322",
   "workId": "f-tmdb322",
   "title": "Таинственная река",
   "year": 2003,
   "similarity": 0.362
  }
 ],
 "tmdb:4689": [
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.519
  },
  {
   "key": "tmdb:11423",
   "workId": "c-memories",
   "title": "Воспоминания об убийстве",
   "year": 2003,
   "similarity": 0.476
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.42
  },
  {
   "key": "tmdb:49797",
   "workId": "f-tmdb49797",
   "title": "Я видел дьявола",
   "year": 2010,
   "similarity": 0.411
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.401
  }
 ],
 "tmdb:470": [
  {
   "key": "tmdb:322",
   "workId": "f-tmdb322",
   "title": "Таинственная река",
   "year": 2003,
   "similarity": 0.485
  },
  {
   "key": "tmdb:334",
   "workId": "f-tmdb334",
   "title": "Магнолия",
   "year": 1999,
   "similarity": 0.45
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.392
  },
  {
   "key": "tmdb:46738",
   "workId": "c-incendies",
   "title": "Пожары",
   "year": 2010,
   "similarity": 0.388
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.377
  }
 ],
 "tmdb:475": [
  {
   "key": "tmdb:1578",
   "workId": "f-tmdb1578",
   "title": "Бешеный бык",
   "year": 1980,
   "similarity": 0.479
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.457
  },
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.399
  },
  {
   "key": "tmdb:903",
   "workId": "f-tmdb903",
   "title": "Хладнокровный Люк",
   "year": 1967,
   "similarity": 0.391
  },
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.366
  }
 ],
 "tmdb:47620": [
  {
   "key": "tmdb:31225",
   "workId": "f-tmdb31225",
   "title": "Париж в огне",
   "year": 1991,
   "similarity": 0.448
  },
  {
   "key": "tmdb:79120",
   "workId": "f-tmdb79120",
   "title": "Уикенд",
   "year": 2011,
   "similarity": 0.406
  },
  {
   "key": "tmdb:11703",
   "workId": "f-tmdb11703",
   "title": "Поцелуй женщины-паука",
   "year": 1985,
   "similarity": 0.394
  },
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.383
  },
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.325
  }
 ],
 "tmdb:488": [
  {
   "key": "tmdb:3083",
   "workId": "f-tmdb3083",
   "title": "Мистер Смит едет в Вашингтон",
   "year": 1939,
   "similarity": 0.489
  },
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.436
  },
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.434
  },
  {
   "key": "tmdb:25768",
   "workId": "f-tmdb25768",
   "title": "Пароходный Билл",
   "year": 1928,
   "similarity": 0.433
  },
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.398
  }
 ],
 "tmdb:490": [
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.494
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.464
  },
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.462
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.455
  },
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.431
  }
 ],
 "tmdb:49026": [
  {
   "key": "tmdb:272",
   "workId": "f-tmdb272",
   "title": "Бэтмен: Начало",
   "year": 2005,
   "similarity": 0.807
  },
  {
   "key": "tmdb:155",
   "workId": "f-tmdb155",
   "title": "Тёмный рыцарь",
   "year": 2008,
   "similarity": 0.802
  },
  {
   "key": "tmdb:13183",
   "workId": "f-tmdb13183",
   "title": "Хранители",
   "year": 2009,
   "similarity": 0.693
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.693
  },
  {
   "key": "tmdb:49521",
   "workId": "f-tmdb49521",
   "title": "Человек из стали",
   "year": 2013,
   "similarity": 0.674
  }
 ],
 "tmdb:49047": [
  {
   "key": "tmdb:568",
   "workId": "f-tmdb568",
   "title": "Аполлон 13",
   "year": 1995,
   "similarity": 0.468
  },
  {
   "key": "tmdb:686",
   "workId": "f-tmdb686",
   "title": "Контакт",
   "year": 1997,
   "similarity": 0.439
  },
  {
   "key": "tmdb:19995",
   "workId": "f-tmdb19995",
   "title": "Аватар",
   "year": 2009,
   "similarity": 0.432
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.426
  },
  {
   "key": "tmdb:95",
   "workId": "f-tmdb95",
   "title": "Армагеддон",
   "year": 1998,
   "similarity": 0.39
  }
 ],
 "tmdb:492": [
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.451
  },
  {
   "key": "tmdb:2757",
   "workId": "f-tmdb2757",
   "title": "Адаптация",
   "year": 2002,
   "similarity": 0.416
  },
  {
   "key": "tmdb:14",
   "workId": "f-tmdb14",
   "title": "Красота по-американски",
   "year": 1999,
   "similarity": 0.41
  },
  {
   "key": "tmdb:1018",
   "workId": "c-mulholland",
   "title": "Малхолланд Драйв",
   "year": 2001,
   "similarity": 0.388
  },
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.379
  }
 ],
 "tmdb:4922": [
  {
   "key": "tmdb:80",
   "workId": "f-tmdb80",
   "title": "Перед закатом",
   "year": 2004,
   "similarity": 0.361
  },
  {
   "key": "tmdb:44826",
   "workId": "f-tmdb44826",
   "title": "Хранитель времени",
   "year": 2011,
   "similarity": 0.351
  },
  {
   "key": "tmdb:2567",
   "workId": "f-tmdb2567",
   "title": "Авиатор",
   "year": 2004,
   "similarity": 0.339
  },
  {
   "key": "tmdb:1640",
   "workId": "f-tmdb1640",
   "title": "Столкновение",
   "year": 2005,
   "similarity": 0.296
  },
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.274
  }
 ],
 "tmdb:4935": [
  {
   "key": "tmdb:129",
   "workId": "f-tmdb129",
   "title": "Унесённые призраками",
   "year": 2001,
   "similarity": 0.791
  },
  {
   "key": "tmdb:17962",
   "workId": "f-tmdb17962",
   "title": "После жизни",
   "year": 1999,
   "similarity": 0.331
  },
  {
   "key": "tmdb:630",
   "workId": "f-tmdb630",
   "title": "Волшебник страны Оз",
   "year": 1939,
   "similarity": 0.295
  },
  {
   "key": "tmdb:194",
   "workId": "f-tmdb194",
   "title": "Амели",
   "year": 2001,
   "similarity": 0.276
  },
  {
   "key": "tmdb:44826",
   "workId": "f-tmdb44826",
   "title": "Хранитель времени",
   "year": 2011,
   "similarity": 0.264
  }
 ],
 "tmdb:4944": [
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.471
  },
  {
   "key": "tmdb:10778",
   "workId": "f-tmdb10778",
   "title": "Человек, которого не было",
   "year": 2001,
   "similarity": 0.442
  },
  {
   "key": "tmdb:11323",
   "workId": "f-tmdb11323",
   "title": "Информатор!",
   "year": 2009,
   "similarity": 0.388
  },
  {
   "key": "tmdb:1599",
   "workId": "f-tmdb1599",
   "title": "Взломщики сердец",
   "year": 2004,
   "similarity": 0.365
  },
  {
   "key": "tmdb:115",
   "workId": "f-tmdb115",
   "title": "Большой Лебовски",
   "year": 1998,
   "similarity": 0.358
  }
 ],
 "tmdb:49521": [
  {
   "key": "tmdb:1724",
   "workId": "f-tmdb1724",
   "title": "Невероятный Халк",
   "year": 2008,
   "similarity": 0.818
  },
  {
   "key": "tmdb:24428",
   "workId": "f-tmdb24428",
   "title": "Мстители",
   "year": 2012,
   "similarity": 0.771
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.736
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.717
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.715
  }
 ],
 "tmdb:49527": [
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.657
  },
  {
   "key": "tmdb:75656",
   "workId": "u-kp522892",
   "title": "Иллюзия обмана",
   "year": 2013,
   "similarity": 0.608
  },
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.583
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.571
  },
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.554
  }
 ],
 "tmdb:497": [
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.62
  },
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.486
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.479
  },
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.477
  },
  {
   "key": "tmdb:13223",
   "workId": "f-tmdb13223",
   "title": "Гран Торино",
   "year": 2008,
   "similarity": 0.475
  }
 ],
 "tmdb:49797": [
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.435
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.412
  },
  {
   "key": "tmdb:4689",
   "workId": "f-tmdb4689",
   "title": "Сочувствие господину Месть",
   "year": 2002,
   "similarity": 0.411
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.406
  },
  {
   "key": "tmdb:1991",
   "workId": "f-tmdb1991",
   "title": "Доказательство смерти",
   "year": 2007,
   "similarity": 0.406
  }
 ],
 "tmdb:4982": [
  {
   "key": "tmdb:23168",
   "workId": "f-tmdb23168",
   "title": "Город воров",
   "year": 2010,
   "similarity": 0.47
  },
  {
   "key": "tmdb:10673",
   "workId": "f-tmdb10673",
   "title": "Уолл-стрит",
   "year": 1987,
   "similarity": 0.467
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.467
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.459
  },
  {
   "key": "tmdb:168672",
   "workId": "f-tmdb168672",
   "title": "Афера по-американски",
   "year": 2013,
   "similarity": 0.444
  }
 ],
 "tmdb:4995": [
  {
   "key": "tmdb:334",
   "workId": "f-tmdb334",
   "title": "Магнолия",
   "year": 1999,
   "similarity": 0.324
  },
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.323
  },
  {
   "key": "tmdb:2757",
   "workId": "f-tmdb2757",
   "title": "Адаптация",
   "year": 2002,
   "similarity": 0.311
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.308
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.305
  }
 ],
 "tmdb:500": [
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.776
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.627
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.564
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.558
  },
  {
   "key": "tmdb:16869",
   "workId": "f-tmdb16869",
   "title": "Бесславные ублюдки",
   "year": 2009,
   "similarity": 0.542
  }
 ],
 "tmdb:501": [
  {
   "key": "tmdb:9764",
   "workId": "f-tmdb9764",
   "title": "Дерсу Узала",
   "year": 1975,
   "similarity": 0.365
  },
  {
   "key": "tmdb:669",
   "workId": "f-tmdb669",
   "title": "Нанук с Севера",
   "year": 1922,
   "similarity": 0.343
  },
  {
   "key": "tmdb:20108",
   "workId": "f-tmdb20108",
   "title": "Наудачу, Бальтазар",
   "year": 1966,
   "similarity": 0.316
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.306
  },
  {
   "key": "tmdb:14048",
   "workId": "f-tmdb14048",
   "title": "Канатоходец",
   "year": 2008,
   "similarity": 0.279
  }
 ],
 "tmdb:506": [
  {
   "key": "tmdb:8066",
   "workId": "l-tmdb8066",
   "title": "Останься",
   "year": 2005,
   "similarity": 0.434
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.329
  },
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.315
  },
  {
   "key": "tmdb:11033",
   "workId": "f-tmdb11033",
   "title": "Бритва",
   "year": 1980,
   "similarity": 0.305
  },
  {
   "key": "tmdb:13528",
   "workId": "f-tmdb13528",
   "title": "Газовый свет",
   "year": 1944,
   "similarity": 0.304
  }
 ],
 "tmdb:510": [
  {
   "key": "tmdb:70",
   "workId": "f-tmdb70",
   "title": "Малышка на миллион",
   "year": 2004,
   "similarity": 0.577
  },
  {
   "key": "tmdb:28580",
   "workId": "f-tmdb28580",
   "title": "Потерянный уик-энд",
   "year": 1945,
   "similarity": 0.571
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.567
  },
  {
   "key": "tmdb:322",
   "workId": "f-tmdb322",
   "title": "Таинственная река",
   "year": 2003,
   "similarity": 0.478
  },
  {
   "key": "tmdb:550",
   "workId": "u-kp361",
   "title": "Бойцовский клуб",
   "year": 1999,
   "similarity": 0.478
  }
 ],
 "tmdb:5156": [
  {
   "key": "tmdb:405",
   "workId": "f-tmdb405",
   "title": "Дорога",
   "year": 1954,
   "similarity": 0.459
  },
  {
   "key": "tmdb:439",
   "workId": "f-tmdb439",
   "title": "Сладкая жизнь",
   "year": 1960,
   "similarity": 0.441
  },
  {
   "key": "tmdb:147",
   "workId": "f-tmdb147",
   "title": "Четыреста ударов",
   "year": 1959,
   "similarity": 0.438
  },
  {
   "key": "tmdb:18148",
   "workId": "f-tmdb18148",
   "title": "Токийская повесть",
   "year": 1953,
   "similarity": 0.406
  },
  {
   "key": "tmdb:4497",
   "workId": "f-tmdb4497",
   "title": "Виридиана",
   "year": 1962,
   "similarity": 0.381
  }
 ],
 "tmdb:5165": [
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.666
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.577
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.571
  },
  {
   "key": "tmdb:266",
   "workId": "f-tmdb266",
   "title": "Презрение",
   "year": 1963,
   "similarity": 0.555
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.517
  }
 ],
 "tmdb:521": [
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.584
  },
  {
   "key": "tmdb:993",
   "workId": "c-sleuth",
   "title": "Сыщик",
   "year": 1972,
   "similarity": 0.58
  },
  {
   "key": "tmdb:37257",
   "workId": "f-tmdb37257",
   "title": "Свидетель обвинения",
   "year": 1957,
   "similarity": 0.574
  },
  {
   "key": "tmdb:223",
   "workId": "f-tmdb223",
   "title": "Ребекка",
   "year": 1940,
   "similarity": 0.522
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.51
  }
 ],
 "tmdb:524": [
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.518
  },
  {
   "key": "tmdb:8052",
   "workId": "f-tmdb8052",
   "title": "Роковая восьмерка",
   "year": 1997,
   "similarity": 0.457
  },
  {
   "key": "tmdb:238",
   "workId": "f-tmdb238",
   "title": "Крёстный отец",
   "year": 1972,
   "similarity": 0.453
  },
  {
   "key": "tmdb:240",
   "workId": "f-tmdb240",
   "title": "Крёстный отец 2",
   "year": 1974,
   "similarity": 0.426
  },
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.421
  }
 ],
 "tmdb:539": [
  {
   "key": "tmdb:274",
   "workId": "u-kp345",
   "title": "Молчание ягнят",
   "year": 1990,
   "similarity": 0.529
  },
  {
   "key": "tmdb:426",
   "workId": "f-tmdb426",
   "title": "Головокружение",
   "year": 1958,
   "similarity": 0.506
  },
  {
   "key": "tmdb:694",
   "workId": "f-tmdb694",
   "title": "Сияние",
   "year": 1980,
   "similarity": 0.478
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.444
  },
  {
   "key": "tmdb:234",
   "workId": "f-tmdb234",
   "title": "Кабинет доктора Калигари",
   "year": 1920,
   "similarity": 0.417
  }
 ],
 "tmdb:541": [
  {
   "key": "tmdb:27845",
   "workId": "f-tmdb27845",
   "title": "Истина в вине",
   "year": 1996,
   "similarity": 0.256
  }
 ],
 "tmdb:548": [
  {
   "key": "tmdb:12493",
   "workId": "f-tmdb12493",
   "title": "Рай и ад",
   "year": 1963,
   "similarity": 0.592
  },
  {
   "key": "tmdb:11878",
   "workId": "f-tmdb11878",
   "title": "Телохранитель",
   "year": 1961,
   "similarity": 0.585
  },
  {
   "key": "tmdb:14537",
   "workId": "f-tmdb14537",
   "title": "Харакири",
   "year": 1962,
   "similarity": 0.582
  },
  {
   "key": "tmdb:11712",
   "workId": "f-tmdb11712",
   "title": "Телохранитель 2: Отважный Сандзюро",
   "year": 1962,
   "similarity": 0.567
  },
  {
   "key": "tmdb:346",
   "workId": "f-tmdb346",
   "title": "Семь Самураев",
   "year": 1954,
   "similarity": 0.518
  }
 ],
 "tmdb:55": [
  {
   "key": "tmdb:1900",
   "workId": "f-tmdb1900",
   "title": "Траффик",
   "year": 2000,
   "similarity": 0.433
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.395
  },
  {
   "key": "tmdb:598",
   "workId": "f-tmdb598",
   "title": "Город бога",
   "year": 2002,
   "similarity": 0.353
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.336
  },
  {
   "key": "tmdb:1391",
   "workId": "f-tmdb1391",
   "title": "И твою маму тоже",
   "year": 2001,
   "similarity": 0.333
  }
 ],
 "tmdb:550": [
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.56
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.549
  },
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.478
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.473
  },
  {
   "key": "tmdb:14",
   "workId": "f-tmdb14",
   "title": "Красота по-американски",
   "year": 1999,
   "similarity": 0.451
  }
 ],
 "tmdb:5503": [
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.54
  },
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.479
  },
  {
   "key": "tmdb:9802",
   "workId": "f-tmdb9802",
   "title": "Скала",
   "year": 1996,
   "similarity": 0.459
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.457
  },
  {
   "key": "tmdb:161",
   "workId": "f-tmdb161",
   "title": "Одиннадцать друзей Оушена",
   "year": 2001,
   "similarity": 0.454
  }
 ],
 "tmdb:553": [
  {
   "key": "tmdb:16",
   "workId": "f-tmdb16",
   "title": "Танцующая в темноте",
   "year": 2000,
   "similarity": 0.378
  },
  {
   "key": "tmdb:10683",
   "workId": "f-tmdb10683",
   "title": "Счастье",
   "year": 1998,
   "similarity": 0.294
  },
  {
   "key": "tmdb:452",
   "workId": "f-tmdb452",
   "title": "Идиоты",
   "year": 1998,
   "similarity": 0.292
  },
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.283
  },
  {
   "key": "tmdb:68722",
   "workId": "f-tmdb68722",
   "title": "Мастер",
   "year": 2012,
   "similarity": 0.28
  }
 ],
 "tmdb:5544": [
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.479
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.479
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.47
  },
  {
   "key": "tmdb:1628",
   "workId": "f-tmdb1628",
   "title": "Жюль и Джим",
   "year": 1962,
   "similarity": 0.463
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.443
  }
 ],
 "tmdb:5548": [
  {
   "key": "tmdb:218",
   "workId": "f-tmdb218",
   "title": "Терминатор",
   "year": 1984,
   "similarity": 0.565
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.556
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.545
  },
  {
   "key": "tmdb:1103",
   "workId": "f-tmdb1103",
   "title": "Побег из Нью-Йорка",
   "year": 1981,
   "similarity": 0.531
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.494
  }
 ],
 "tmdb:557": [
  {
   "key": "tmdb:558",
   "workId": "f-tmdb558",
   "title": "Человек-паук 2",
   "year": 2004,
   "similarity": 0.882
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.789
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.764
  },
  {
   "key": "tmdb:24428",
   "workId": "f-tmdb24428",
   "title": "Мстители",
   "year": 2012,
   "similarity": 0.713
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.707
  }
 ],
 "tmdb:558": [
  {
   "key": "tmdb:557",
   "workId": "f-tmdb557",
   "title": "Человек-паук",
   "year": 2002,
   "similarity": 0.882
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.829
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.787
  },
  {
   "key": "tmdb:1724",
   "workId": "f-tmdb1724",
   "title": "Невероятный Халк",
   "year": 2008,
   "similarity": 0.759
  },
  {
   "key": "tmdb:1726",
   "workId": "f-tmdb1726",
   "title": "Железный человек",
   "year": 2008,
   "similarity": 0.739
  }
 ],
 "tmdb:562": [
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.719
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.533
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.533
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.499
  },
  {
   "key": "tmdb:218",
   "workId": "f-tmdb218",
   "title": "Терминатор",
   "year": 1984,
   "similarity": 0.494
  }
 ],
 "tmdb:56292": [
  {
   "key": "tmdb:2502",
   "workId": "f-tmdb2502",
   "title": "Превосходство Борна",
   "year": 2004,
   "similarity": 0.626
  },
  {
   "key": "tmdb:36955",
   "workId": "f-tmdb36955",
   "title": "Правдивая ложь",
   "year": 1994,
   "similarity": 0.609
  },
  {
   "key": "tmdb:2501",
   "workId": "f-tmdb2501",
   "title": "Идентификация Борна",
   "year": 2002,
   "similarity": 0.572
  },
  {
   "key": "tmdb:2503",
   "workId": "f-tmdb2503",
   "title": "Ультиматум Борна",
   "year": 2007,
   "similarity": 0.571
  },
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.56
  }
 ],
 "tmdb:563": [
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.506
  },
  {
   "key": "tmdb:607",
   "workId": "f-tmdb607",
   "title": "Люди в чёрном",
   "year": 1997,
   "similarity": 0.481
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.451
  },
  {
   "key": "tmdb:18",
   "workId": "f-tmdb18",
   "title": "Пятый элемент",
   "year": 1997,
   "similarity": 0.43
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.41
  }
 ],
 "tmdb:567": [
  {
   "key": "tmdb:426",
   "workId": "f-tmdb426",
   "title": "Головокружение",
   "year": 1958,
   "similarity": 0.523
  },
  {
   "key": "tmdb:845",
   "workId": "f-tmdb845",
   "title": "Незнакомцы в поезде",
   "year": 1951,
   "similarity": 0.51
  },
  {
   "key": "tmdb:213",
   "workId": "f-tmdb213",
   "title": "На север через северо-запад",
   "year": 1959,
   "similarity": 0.487
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.467
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.435
  }
 ],
 "tmdb:568": [
  {
   "key": "tmdb:95",
   "workId": "f-tmdb95",
   "title": "Армагеддон",
   "year": 1998,
   "similarity": 0.506
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.471
  },
  {
   "key": "tmdb:49047",
   "workId": "f-tmdb49047",
   "title": "Гравитация",
   "year": 2013,
   "similarity": 0.468
  },
  {
   "key": "tmdb:601",
   "workId": "f-tmdb601",
   "title": "Инопланетянин",
   "year": 1982,
   "similarity": 0.412
  },
  {
   "key": "tmdb:8358",
   "workId": "f-tmdb8358",
   "title": "Изгой",
   "year": 2000,
   "similarity": 0.407
  }
 ],
 "tmdb:571": [
  {
   "key": "tmdb:578",
   "workId": "f-tmdb578",
   "title": "Челюсти",
   "year": 1975,
   "similarity": 0.404
  },
  {
   "key": "tmdb:244",
   "workId": "f-tmdb244",
   "title": "Кинг Конг",
   "year": 1933,
   "similarity": 0.358
  },
  {
   "key": "tmdb:539",
   "workId": "f-tmdb539",
   "title": "Психо",
   "year": 1960,
   "similarity": 0.321
  },
  {
   "key": "tmdb:1700",
   "workId": "f-tmdb1700",
   "title": "Мизери",
   "year": 1990,
   "similarity": 0.299
  },
  {
   "key": "tmdb:1091",
   "workId": "f-tmdb1091",
   "title": "Нечто",
   "year": 1982,
   "similarity": 0.292
  }
 ],
 "tmdb:57212": [
  {
   "key": "tmdb:95",
   "workId": "f-tmdb95",
   "title": "Армагеддон",
   "year": 1998,
   "similarity": 0.431
  },
  {
   "key": "tmdb:744",
   "workId": "f-tmdb744",
   "title": "Лучший стрелок",
   "year": 1986,
   "similarity": 0.423
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.422
  },
  {
   "key": "tmdb:616",
   "workId": "f-tmdb616",
   "title": "Последний самурай",
   "year": 2003,
   "similarity": 0.421
  },
  {
   "key": "tmdb:1495",
   "workId": "f-tmdb1495",
   "title": "Царство небесное",
   "year": 2005,
   "similarity": 0.409
  }
 ],
 "tmdb:576": [
  {
   "key": "tmdb:3114",
   "workId": "f-tmdb3114",
   "title": "Искатели",
   "year": 1956,
   "similarity": 0.507
  },
  {
   "key": "tmdb:33",
   "workId": "f-tmdb33",
   "title": "Непрощённый",
   "year": 1992,
   "similarity": 0.506
  },
  {
   "key": "tmdb:1578",
   "workId": "f-tmdb1578",
   "title": "Бешеный бык",
   "year": 1980,
   "similarity": 0.46
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.448
  },
  {
   "key": "tmdb:11878",
   "workId": "f-tmdb11878",
   "title": "Телохранитель",
   "year": 1961,
   "similarity": 0.435
  }
 ],
 "tmdb:578": [
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.468
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.444
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.439
  },
  {
   "key": "tmdb:571",
   "workId": "f-tmdb571",
   "title": "Птицы",
   "year": 1963,
   "similarity": 0.404
  },
  {
   "key": "tmdb:562",
   "workId": "f-tmdb562",
   "title": "Крепкий орешек",
   "year": 1988,
   "similarity": 0.398
  }
 ],
 "tmdb:5781": [
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.582
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.503
  },
  {
   "key": "tmdb:266",
   "workId": "f-tmdb266",
   "title": "Презрение",
   "year": 1963,
   "similarity": 0.469
  },
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.468
  },
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.449
  }
 ],
 "tmdb:5801": [
  {
   "key": "tmdb:4495",
   "workId": "f-tmdb4495",
   "title": "Дух улья",
   "year": 1973,
   "similarity": 0.466
  },
  {
   "key": "tmdb:9764",
   "workId": "f-tmdb9764",
   "title": "Дерсу Узала",
   "year": 1975,
   "similarity": 0.404
  },
  {
   "key": "tmdb:20108",
   "workId": "f-tmdb20108",
   "title": "Наудачу, Бальтазар",
   "year": 1966,
   "similarity": 0.403
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.4
  },
  {
   "key": "tmdb:42113",
   "workId": "f-tmdb42113",
   "title": "Легенда о Нараяме",
   "year": 1983,
   "similarity": 0.38
  }
 ],
 "tmdb:581": [
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.527
  },
  {
   "key": "tmdb:72976",
   "workId": "f-tmdb72976",
   "title": "Линкольн",
   "year": 2012,
   "similarity": 0.499
  },
  {
   "key": "tmdb:887",
   "workId": "f-tmdb887",
   "title": "Лучшие годы нашей жизни",
   "year": 1946,
   "similarity": 0.391
  },
  {
   "key": "tmdb:8619",
   "workId": "f-tmdb8619",
   "title": "Хозяин морей: На краю Земли",
   "year": 2003,
   "similarity": 0.38
  },
  {
   "key": "tmdb:616",
   "workId": "f-tmdb616",
   "title": "Последний самурай",
   "year": 2003,
   "similarity": 0.366
  }
 ],
 "tmdb:582": [
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.385
  },
  {
   "key": "tmdb:891",
   "workId": "f-tmdb891",
   "title": "Вся президентская рать",
   "year": 1976,
   "similarity": 0.346
  },
  {
   "key": "tmdb:9008",
   "workId": "f-tmdb9008",
   "title": "Свой человек",
   "year": 1999,
   "similarity": 0.346
  },
  {
   "key": "tmdb:4588",
   "workId": "f-tmdb4588",
   "title": "Вожделение",
   "year": 2007,
   "similarity": 0.342
  },
  {
   "key": "tmdb:982",
   "workId": "f-tmdb982",
   "title": "Маньчжурский кандидат",
   "year": 1962,
   "similarity": 0.306
  }
 ],
 "tmdb:5879": [
  {
   "key": "tmdb:649",
   "workId": "f-tmdb649",
   "title": "Дневная красавица",
   "year": 1967,
   "similarity": 0.516
  },
  {
   "key": "tmdb:452",
   "workId": "f-tmdb452",
   "title": "Идиоты",
   "year": 1998,
   "similarity": 0.499
  },
  {
   "key": "tmdb:1412",
   "workId": "f-tmdb1412",
   "title": "Секс, ложь и видео",
   "year": 1989,
   "similarity": 0.485
  },
  {
   "key": "tmdb:11033",
   "workId": "f-tmdb11033",
   "title": "Бритва",
   "year": 1980,
   "similarity": 0.459
  },
  {
   "key": "tmdb:402",
   "workId": "f-tmdb402",
   "title": "Основной инстинкт",
   "year": 1992,
   "similarity": 0.45
  }
 ],
 "tmdb:590": [
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.385
  },
  {
   "key": "tmdb:9800",
   "workId": "f-tmdb9800",
   "title": "Филадельфия",
   "year": 1993,
   "similarity": 0.383
  },
  {
   "key": "tmdb:1919",
   "workId": "f-tmdb1919",
   "title": "Вдали от неё",
   "year": 2007,
   "similarity": 0.364
  },
  {
   "key": "tmdb:79120",
   "workId": "f-tmdb79120",
   "title": "Уикенд",
   "year": 2011,
   "similarity": 0.353
  },
  {
   "key": "tmdb:16619",
   "workId": "f-tmdb16619",
   "title": "Обыкновенные люди",
   "year": 1980,
   "similarity": 0.342
  }
 ],
 "tmdb:5910": [
  {
   "key": "tmdb:7500",
   "workId": "f-tmdb7500",
   "title": "Сонатина",
   "year": 1993,
   "similarity": 0.53
  },
  {
   "key": "tmdb:18148",
   "workId": "f-tmdb18148",
   "title": "Токийская повесть",
   "year": 1953,
   "similarity": 0.439
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.4
  },
  {
   "key": "tmdb:17962",
   "workId": "f-tmdb17962",
   "title": "После жизни",
   "year": 1999,
   "similarity": 0.38
  },
  {
   "key": "tmdb:153",
   "workId": "f-tmdb153",
   "title": "Трудности перевода",
   "year": 2003,
   "similarity": 0.368
  }
 ],
 "tmdb:592": [
  {
   "key": "tmdb:17365",
   "workId": "f-tmdb17365",
   "title": "Заговор «Параллакс»",
   "year": 1974,
   "similarity": 0.501
  },
  {
   "key": "tmdb:426",
   "workId": "f-tmdb426",
   "title": "Головокружение",
   "year": 1958,
   "similarity": 0.496
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.495
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.485
  },
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.441
  }
 ],
 "tmdb:593": [
  {
   "key": "tmdb:1398",
   "workId": "l-tmdb1398",
   "title": "Сталкер",
   "year": 1979,
   "similarity": 0.615
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.502
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.501
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.429
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.414
  }
 ],
 "tmdb:59490": [
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.519
  },
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.482
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.457
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.453
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.446
  }
 ],
 "tmdb:595": [
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.536
  },
  {
   "key": "tmdb:596",
   "workId": "f-tmdb596",
   "title": "Гроздья гнева",
   "year": 1940,
   "similarity": 0.501
  },
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.467
  },
  {
   "key": "tmdb:3083",
   "workId": "f-tmdb3083",
   "title": "Мистер Смит едет в Вашингтон",
   "year": 1939,
   "similarity": 0.429
  },
  {
   "key": "tmdb:873",
   "workId": "f-tmdb873",
   "title": "Цветы лиловые полей",
   "year": 1985,
   "similarity": 0.427
  }
 ],
 "tmdb:596": [
  {
   "key": "tmdb:595",
   "workId": "f-tmdb595",
   "title": "Убить пересмешника",
   "year": 1962,
   "similarity": 0.501
  },
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.394
  },
  {
   "key": "tmdb:3083",
   "workId": "f-tmdb3083",
   "title": "Мистер Смит едет в Вашингтон",
   "year": 1939,
   "similarity": 0.387
  },
  {
   "key": "tmdb:887",
   "workId": "f-tmdb887",
   "title": "Лучшие годы нашей жизни",
   "year": 1946,
   "similarity": 0.366
  },
  {
   "key": "tmdb:288",
   "workId": "f-tmdb288",
   "title": "Ровно в полдень",
   "year": 1952,
   "similarity": 0.364
  }
 ],
 "tmdb:5961": [
  {
   "key": "tmdb:37903",
   "workId": "f-tmdb37903",
   "title": "Белая лента",
   "year": 2009,
   "similarity": 0.396
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.351
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.348
  },
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.347
  },
  {
   "key": "tmdb:5801",
   "workId": "f-tmdb5801",
   "title": "Песнь дороги",
   "year": 1955,
   "similarity": 0.342
  }
 ],
 "tmdb:598": [
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.482
  },
  {
   "key": "tmdb:1653",
   "workId": "f-tmdb1653",
   "title": "Дневники мотоциклиста",
   "year": 2004,
   "similarity": 0.407
  },
  {
   "key": "tmdb:627",
   "workId": "f-tmdb627",
   "title": "На игле",
   "year": 1996,
   "similarity": 0.392
  },
  {
   "key": "tmdb:6106",
   "workId": "f-tmdb6106",
   "title": "Сальвадор",
   "year": 1986,
   "similarity": 0.39
  },
  {
   "key": "tmdb:322",
   "workId": "f-tmdb322",
   "title": "Таинственная река",
   "year": 2003,
   "similarity": 0.387
  }
 ],
 "tmdb:599": [
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.614
  },
  {
   "key": "tmdb:705",
   "workId": "f-tmdb705",
   "title": "Все о Еве",
   "year": 1950,
   "similarity": 0.529
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.507
  },
  {
   "key": "tmdb:426",
   "workId": "f-tmdb426",
   "title": "Головокружение",
   "year": 1958,
   "similarity": 0.504
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.466
  }
 ],
 "tmdb:5991": [
  {
   "key": "tmdb:27375",
   "workId": "f-tmdb27375",
   "title": "Коммивояжер",
   "year": 1969,
   "similarity": 0.508
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.493
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.467
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.428
  },
  {
   "key": "tmdb:26317",
   "workId": "f-tmdb26317",
   "title": "Человек с киноаппаратом",
   "year": 1929,
   "similarity": 0.417
  }
 ],
 "tmdb:60033": [
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.294
  },
  {
   "key": "tmdb:38319",
   "workId": "l-tmdb38319",
   "title": "Храбрые перцем",
   "year": 2011,
   "similarity": 0.276
  },
  {
   "key": "tmdb:22825",
   "workId": "u-kp1762",
   "title": "Посылка",
   "year": 2009,
   "similarity": 0.27
  },
  {
   "key": "tmdb:32985",
   "workId": "l-tmdb32985",
   "title": "Соломон Кейн",
   "year": 2009,
   "similarity": 0.268
  },
  {
   "key": "tmdb:9593",
   "workId": "f-tmdb9593",
   "title": "Последний киногерой",
   "year": 1993,
   "similarity": 0.267
  }
 ],
 "tmdb:601": [
  {
   "key": "tmdb:840",
   "workId": "f-tmdb840",
   "title": "Близкие контакты третьей степени",
   "year": 1977,
   "similarity": 0.573
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.506
  },
  {
   "key": "tmdb:568",
   "workId": "f-tmdb568",
   "title": "Аполлон 13",
   "year": 1995,
   "similarity": 0.412
  },
  {
   "key": "tmdb:620",
   "workId": "f-tmdb620",
   "title": "Охотники за привидениями",
   "year": 1984,
   "similarity": 0.404
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.385
  }
 ],
 "tmdb:602": [
  {
   "key": "tmdb:95",
   "workId": "f-tmdb95",
   "title": "Армагеддон",
   "year": 1998,
   "similarity": 0.742
  },
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.642
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.627
  },
  {
   "key": "tmdb:9802",
   "workId": "f-tmdb9802",
   "title": "Скала",
   "year": 1996,
   "similarity": 0.575
  },
  {
   "key": "tmdb:744",
   "workId": "f-tmdb744",
   "title": "Лучший стрелок",
   "year": 1986,
   "similarity": 0.571
  }
 ],
 "tmdb:603": [
  {
   "key": "tmdb:604",
   "workId": "f-tmdb604",
   "title": "Матрица: Перезагрузка",
   "year": 2003,
   "similarity": 0.724
  },
  {
   "key": "tmdb:605",
   "workId": "f-tmdb605",
   "title": "Матрица: Революция",
   "year": 2003,
   "similarity": 0.64
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.59
  },
  {
   "key": "tmdb:27205",
   "workId": "w08",
   "title": "Начало",
   "year": 2010,
   "similarity": 0.566
  },
  {
   "key": "tmdb:218",
   "workId": "f-tmdb218",
   "title": "Терминатор",
   "year": 1984,
   "similarity": 0.552
  }
 ],
 "tmdb:604": [
  {
   "key": "tmdb:605",
   "workId": "f-tmdb605",
   "title": "Матрица: Революция",
   "year": 2003,
   "similarity": 0.894
  },
  {
   "key": "tmdb:603",
   "workId": "f-tmdb603",
   "title": "Матрица",
   "year": 1999,
   "similarity": 0.724
  },
  {
   "key": "tmdb:7299",
   "workId": "u-kp309",
   "title": "Эквилибриум",
   "year": 2002,
   "similarity": 0.524
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.508
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.505
  }
 ],
 "tmdb:605": [
  {
   "key": "tmdb:604",
   "workId": "f-tmdb604",
   "title": "Матрица: Перезагрузка",
   "year": 2003,
   "similarity": 0.894
  },
  {
   "key": "tmdb:603",
   "workId": "f-tmdb603",
   "title": "Матрица",
   "year": 1999,
   "similarity": 0.64
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.506
  },
  {
   "key": "tmdb:7299",
   "workId": "u-kp309",
   "title": "Эквилибриум",
   "year": 2002,
   "similarity": 0.501
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.5
  }
 ],
 "tmdb:607": [
  {
   "key": "tmdb:24428",
   "workId": "f-tmdb24428",
   "title": "Мстители",
   "year": 2012,
   "similarity": 0.645
  },
  {
   "key": "tmdb:36657",
   "workId": "f-tmdb36657",
   "title": "Люди Икс",
   "year": 2000,
   "similarity": 0.59
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.567
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.564
  },
  {
   "key": "tmdb:557",
   "workId": "f-tmdb557",
   "title": "Человек-паук",
   "year": 2002,
   "similarity": 0.562
  }
 ],
 "tmdb:6106": [
  {
   "key": "tmdb:1653",
   "workId": "f-tmdb1653",
   "title": "Дневники мотоциклиста",
   "year": 2004,
   "similarity": 0.532
  },
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.402
  },
  {
   "key": "tmdb:598",
   "workId": "f-tmdb598",
   "title": "Город бога",
   "year": 2002,
   "similarity": 0.39
  },
  {
   "key": "tmdb:2604",
   "workId": "f-tmdb2604",
   "title": "Рождённый четвёртого июля",
   "year": 1989,
   "similarity": 0.377
  },
  {
   "key": "tmdb:1372",
   "workId": "f-tmdb1372",
   "title": "Кровавый алмаз",
   "year": 2006,
   "similarity": 0.355
  }
 ],
 "tmdb:612": [
  {
   "key": "tmdb:97630",
   "workId": "f-tmdb97630",
   "title": "Цель номер один",
   "year": 2012,
   "similarity": 0.343
  },
  {
   "key": "tmdb:12162",
   "workId": "f-tmdb12162",
   "title": "Повелитель бури",
   "year": 2008,
   "similarity": 0.311
  },
  {
   "key": "tmdb:1372",
   "workId": "f-tmdb1372",
   "title": "Кровавый алмаз",
   "year": 2006,
   "similarity": 0.301
  },
  {
   "key": "tmdb:9008",
   "workId": "f-tmdb9008",
   "title": "Свой человек",
   "year": 1999,
   "similarity": 0.29
  },
  {
   "key": "tmdb:2604",
   "workId": "f-tmdb2604",
   "title": "Рождённый четвёртого июля",
   "year": 1989,
   "similarity": 0.274
  }
 ],
 "tmdb:616": [
  {
   "key": "tmdb:1495",
   "workId": "f-tmdb1495",
   "title": "Царство небесное",
   "year": 2005,
   "similarity": 0.477
  },
  {
   "key": "tmdb:98",
   "workId": "f-tmdb98",
   "title": "Гладиатор",
   "year": 2000,
   "similarity": 0.475
  },
  {
   "key": "tmdb:1271",
   "workId": "f-tmdb1271",
   "title": "300 спартанцев",
   "year": 2007,
   "similarity": 0.468
  },
  {
   "key": "tmdb:7299",
   "workId": "u-kp309",
   "title": "Эквилибриум",
   "year": 2002,
   "similarity": 0.446
  },
  {
   "key": "tmdb:855",
   "workId": "f-tmdb855",
   "title": "Чёрный ястреб",
   "year": 2001,
   "similarity": 0.442
  }
 ],
 "tmdb:618": [
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.624
  },
  {
   "key": "tmdb:72976",
   "workId": "f-tmdb72976",
   "title": "Линкольн",
   "year": 2012,
   "similarity": 0.42
  },
  {
   "key": "tmdb:595",
   "workId": "f-tmdb595",
   "title": "Убить пересмешника",
   "year": 1962,
   "similarity": 0.375
  },
  {
   "key": "tmdb:939",
   "workId": "f-tmdb939",
   "title": "Певец джаза",
   "year": 1927,
   "similarity": 0.366
  },
  {
   "key": "tmdb:581",
   "workId": "f-tmdb581",
   "title": "Танцующий с волками",
   "year": 1990,
   "similarity": 0.352
  }
 ],
 "tmdb:62": [
  {
   "key": "tmdb:593",
   "workId": "w06",
   "title": "Солярис",
   "year": 1972,
   "similarity": 0.413
  },
  {
   "key": "tmdb:17431",
   "workId": "l-tmdb17431",
   "title": "Луна 2112",
   "year": 2009,
   "similarity": 0.386
  },
  {
   "key": "tmdb:185",
   "workId": "f-tmdb185",
   "title": "Заводной апельсин",
   "year": 1971,
   "similarity": 0.376
  },
  {
   "key": "tmdb:644",
   "workId": "f-tmdb644",
   "title": "Искусственный разум",
   "year": 2001,
   "similarity": 0.366
  },
  {
   "key": "tmdb:78",
   "workId": "f-tmdb78",
   "title": "Бегущий по лезвию",
   "year": 1982,
   "similarity": 0.362
  }
 ],
 "tmdb:620": [
  {
   "key": "tmdb:105",
   "workId": "f-tmdb105",
   "title": "Назад в будущее",
   "year": 1985,
   "similarity": 0.523
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.513
  },
  {
   "key": "tmdb:607",
   "workId": "f-tmdb607",
   "title": "Люди в чёрном",
   "year": 1997,
   "similarity": 0.505
  },
  {
   "key": "tmdb:90",
   "workId": "f-tmdb90",
   "title": "Полицейский из Беверли-Хиллз",
   "year": 1984,
   "similarity": 0.481
  },
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.45
  }
 ],
 "tmdb:621": [
  {
   "key": "tmdb:15144",
   "workId": "f-tmdb15144",
   "title": "Шестнадцать свечей",
   "year": 1984,
   "similarity": 0.606
  },
  {
   "key": "tmdb:872",
   "workId": "f-tmdb872",
   "title": "Поющие под дождём",
   "year": 1952,
   "similarity": 0.564
  },
  {
   "key": "tmdb:1584",
   "workId": "f-tmdb1584",
   "title": "Школа рока",
   "year": 2003,
   "similarity": 0.535
  },
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.518
  },
  {
   "key": "tmdb:11009",
   "workId": "f-tmdb11009",
   "title": "Лихорадка субботнего вечера",
   "year": 1977,
   "similarity": 0.492
  }
 ],
 "tmdb:624": [
  {
   "key": "tmdb:185",
   "workId": "f-tmdb185",
   "title": "Заводной апельсин",
   "year": 1971,
   "similarity": 0.281
  },
  {
   "key": "tmdb:14886",
   "workId": "f-tmdb14886",
   "title": "Последний наряд",
   "year": 1973,
   "similarity": 0.279
  },
  {
   "key": "tmdb:3116",
   "workId": "f-tmdb3116",
   "title": "Полуночный ковбой",
   "year": 1969,
   "similarity": 0.276
  },
  {
   "key": "tmdb:11951",
   "workId": "f-tmdb11951",
   "title": "Исчезающая точка",
   "year": 1971,
   "similarity": 0.259
  },
  {
   "key": "tmdb:37247",
   "workId": "f-tmdb37247",
   "title": "Выпускник",
   "year": 1967,
   "similarity": 0.257
  }
 ],
 "tmdb:625": [
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.554
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.543
  },
  {
   "key": "tmdb:2604",
   "workId": "f-tmdb2604",
   "title": "Рождённый четвёртого июля",
   "year": 1989,
   "similarity": 0.518
  },
  {
   "key": "tmdb:31657",
   "workId": "f-tmdb31657",
   "title": "Возвращение домой",
   "year": 1978,
   "similarity": 0.502
  },
  {
   "key": "tmdb:1372",
   "workId": "f-tmdb1372",
   "title": "Кровавый алмаз",
   "year": 2006,
   "similarity": 0.476
  }
 ],
 "tmdb:627": [
  {
   "key": "tmdb:9905",
   "workId": "f-tmdb9905",
   "title": "Неглубокая могила",
   "year": 1994,
   "similarity": 0.415
  },
  {
   "key": "tmdb:598",
   "workId": "f-tmdb598",
   "title": "Город бога",
   "year": 2002,
   "similarity": 0.392
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.384
  },
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.382
  },
  {
   "key": "tmdb:185",
   "workId": "f-tmdb185",
   "title": "Заводной апельсин",
   "year": 1971,
   "similarity": 0.365
  }
 ],
 "tmdb:629": [
  {
   "key": "tmdb:2118",
   "workId": "f-tmdb2118",
   "title": "Секреты Лос-Анджелеса",
   "year": 1997,
   "similarity": 0.637
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.613
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.564
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.54
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.537
  }
 ],
 "tmdb:63": [
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.497
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.472
  },
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.455
  },
  {
   "key": "tmdb:17431",
   "workId": "l-tmdb17431",
   "title": "Луна 2112",
   "year": 2009,
   "similarity": 0.453
  },
  {
   "key": "tmdb:14139",
   "workId": "c-timecrimes",
   "title": "Временная петля",
   "year": 2007,
   "similarity": 0.45
  }
 ],
 "tmdb:630": [
  {
   "key": "tmdb:257",
   "workId": "f-tmdb257",
   "title": "Оливер Твист",
   "year": 2005,
   "similarity": 0.432
  },
  {
   "key": "tmdb:3083",
   "workId": "f-tmdb3083",
   "title": "Мистер Смит едет в Вашингтон",
   "year": 1939,
   "similarity": 0.368
  },
  {
   "key": "tmdb:856",
   "workId": "f-tmdb856",
   "title": "Кто подставил кролика Роджера",
   "year": 1988,
   "similarity": 0.36
  },
  {
   "key": "tmdb:244",
   "workId": "f-tmdb244",
   "title": "Кинг Конг",
   "year": 1933,
   "similarity": 0.36
  },
  {
   "key": "tmdb:909",
   "workId": "f-tmdb909",
   "title": "Встреть меня в Сент-Луисе",
   "year": 1944,
   "similarity": 0.344
  }
 ],
 "tmdb:631": [
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.589
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.571
  },
  {
   "key": "tmdb:11710",
   "workId": "f-tmdb11710",
   "title": "Каждый за себя, а Бог против всех",
   "year": 1974,
   "similarity": 0.529
  },
  {
   "key": "tmdb:405",
   "workId": "f-tmdb405",
   "title": "Дорога",
   "year": 1954,
   "similarity": 0.518
  },
  {
   "key": "tmdb:16642",
   "workId": "f-tmdb16642",
   "title": "Дни жатвы",
   "year": 1978,
   "similarity": 0.511
  }
 ],
 "tmdb:6312": [
  {
   "key": "tmdb:7299",
   "workId": "u-kp309",
   "title": "Эквилибриум",
   "year": 2002,
   "similarity": 0.433
  },
  {
   "key": "tmdb:2668",
   "workId": "l-tmdb2668",
   "title": "Сонная лощина",
   "year": 1999,
   "similarity": 0.397
  },
  {
   "key": "tmdb:1487",
   "workId": "f-tmdb1487",
   "title": "Хеллбой: Герой из пекла",
   "year": 2004,
   "similarity": 0.348
  },
  {
   "key": "tmdb:1271",
   "workId": "f-tmdb1271",
   "title": "300 спартанцев",
   "year": 2007,
   "similarity": 0.338
  },
  {
   "key": "tmdb:604",
   "workId": "f-tmdb604",
   "title": "Матрица: Перезагрузка",
   "year": 2003,
   "similarity": 0.328
  }
 ],
 "tmdb:635": [
  {
   "key": "tmdb:1813",
   "workId": "u-kp3797",
   "title": "Адвокат дьявола",
   "year": 1997,
   "similarity": 0.511
  },
  {
   "key": "tmdb:20126",
   "workId": "f-tmdb20126",
   "title": "Кроваво-красное",
   "year": 1975,
   "similarity": 0.353
  },
  {
   "key": "tmdb:11644",
   "workId": "f-tmdb11644",
   "title": "Прокол",
   "year": 1981,
   "similarity": 0.33
  },
  {
   "key": "tmdb:16307",
   "workId": "f-tmdb16307",
   "title": "Плетеный человек",
   "year": 1973,
   "similarity": 0.317
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.313
  }
 ],
 "tmdb:63579": [
  {
   "key": "tmdb:2260",
   "workId": "f-tmdb2260",
   "title": "Захват Фридманов",
   "year": 2003,
   "similarity": 0.296
  },
  {
   "key": "tmdb:598",
   "workId": "f-tmdb598",
   "title": "Город бога",
   "year": 2002,
   "similarity": 0.285
  },
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.277
  },
  {
   "key": "tmdb:501",
   "workId": "f-tmdb501",
   "title": "Человек гризли",
   "year": 2005,
   "similarity": 0.271
  },
  {
   "key": "tmdb:64720",
   "workId": "f-tmdb64720",
   "title": "Укрытие",
   "year": 2011,
   "similarity": 0.26
  }
 ],
 "tmdb:636": [
  {
   "key": "tmdb:19",
   "workId": "f-tmdb19",
   "title": "Метрополис",
   "year": 1927,
   "similarity": 0.51
  },
  {
   "key": "tmdb:281",
   "workId": "f-tmdb281",
   "title": "Странные дни",
   "year": 1995,
   "similarity": 0.465
  },
  {
   "key": "tmdb:644",
   "workId": "f-tmdb644",
   "title": "Искусственный разум",
   "year": 2001,
   "similarity": 0.442
  },
  {
   "key": "tmdb:78",
   "workId": "f-tmdb78",
   "title": "Бегущий по лезвию",
   "year": 1982,
   "similarity": 0.406
  },
  {
   "key": "tmdb:782",
   "workId": "u-kp5012",
   "title": "Гаттака",
   "year": 1997,
   "similarity": 0.38
  }
 ],
 "tmdb:637": [
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.734
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.607
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.472
  },
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.463
  },
  {
   "key": "tmdb:1786",
   "workId": "f-tmdb1786",
   "title": "До свидания, дети",
   "year": 1987,
   "similarity": 0.439
  }
 ],
 "tmdb:639": [
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.545
  },
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.53
  },
  {
   "key": "tmdb:11050",
   "workId": "f-tmdb11050",
   "title": "Язык нежности",
   "year": 1983,
   "similarity": 0.528
  },
  {
   "key": "tmdb:9576",
   "workId": "f-tmdb9576",
   "title": "Тутси",
   "year": 1982,
   "similarity": 0.509
  },
  {
   "key": "tmdb:621",
   "workId": "f-tmdb621",
   "title": "Бриолин",
   "year": 1978,
   "similarity": 0.485
  }
 ],
 "tmdb:640": [
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.384
  },
  {
   "key": "tmdb:462",
   "workId": "f-tmdb462",
   "title": "Эрин Брокович",
   "year": 2000,
   "similarity": 0.361
  },
  {
   "key": "tmdb:68734",
   "workId": "f-tmdb68734",
   "title": "Операция «Арго»",
   "year": 2012,
   "similarity": 0.338
  },
  {
   "key": "tmdb:2567",
   "workId": "f-tmdb2567",
   "title": "Авиатор",
   "year": 2004,
   "similarity": 0.329
  },
  {
   "key": "tmdb:22947",
   "workId": "f-tmdb22947",
   "title": "Мне бы в небо",
   "year": 2009,
   "similarity": 0.31
  }
 ],
 "tmdb:6415": [
  {
   "key": "tmdb:12162",
   "workId": "f-tmdb12162",
   "title": "Повелитель бури",
   "year": 2008,
   "similarity": 0.524
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.455
  },
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.451
  },
  {
   "key": "tmdb:1372",
   "workId": "f-tmdb1372",
   "title": "Кровавый алмаз",
   "year": 2006,
   "similarity": 0.414
  },
  {
   "key": "tmdb:2440",
   "workId": "f-tmdb2440",
   "title": "Объединённая зона безопасности",
   "year": 2000,
   "similarity": 0.409
  }
 ],
 "tmdb:642": [
  {
   "key": "tmdb:903",
   "workId": "f-tmdb903",
   "title": "Хладнокровный Люк",
   "year": 1967,
   "similarity": 0.425
  },
  {
   "key": "tmdb:68718",
   "workId": "f-tmdb68718",
   "title": "Джанго освобождённый",
   "year": 2012,
   "similarity": 0.421
  },
  {
   "key": "tmdb:995",
   "workId": "f-tmdb995",
   "title": "Дилижанс",
   "year": 1939,
   "similarity": 0.386
  },
  {
   "key": "tmdb:3083",
   "workId": "f-tmdb3083",
   "title": "Мистер Смит едет в Вашингтон",
   "year": 1939,
   "similarity": 0.373
  },
  {
   "key": "tmdb:11293",
   "workId": "f-tmdb11293",
   "title": "Бумажная луна",
   "year": 1973,
   "similarity": 0.367
  }
 ],
 "tmdb:643": [
  {
   "key": "tmdb:17295",
   "workId": "f-tmdb17295",
   "title": "Битва за Алжир",
   "year": 1966,
   "similarity": 0.386
  },
  {
   "key": "tmdb:26317",
   "workId": "f-tmdb26317",
   "title": "Человек с киноаппаратом",
   "year": 1929,
   "similarity": 0.358
  },
  {
   "key": "tmdb:596",
   "workId": "f-tmdb596",
   "title": "Гроздья гнева",
   "year": 1940,
   "similarity": 0.349
  },
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.343
  },
  {
   "key": "tmdb:123678",
   "workId": "f-tmdb123678",
   "title": "Акт убийства",
   "year": 2012,
   "similarity": 0.332
  }
 ],
 "tmdb:644": [
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.573
  },
  {
   "key": "tmdb:180",
   "workId": "f-tmdb180",
   "title": "Особое мнение",
   "year": 2002,
   "similarity": 0.507
  },
  {
   "key": "tmdb:782",
   "workId": "u-kp5012",
   "title": "Гаттака",
   "year": 1997,
   "similarity": 0.481
  },
  {
   "key": "tmdb:686",
   "workId": "f-tmdb686",
   "title": "Контакт",
   "year": 1997,
   "similarity": 0.473
  },
  {
   "key": "tmdb:74",
   "workId": "f-tmdb74",
   "title": "Война миров",
   "year": 2005,
   "similarity": 0.461
  }
 ],
 "tmdb:64720": [
  {
   "key": "tmdb:86825",
   "workId": "f-tmdb86825",
   "title": "Порочные игры",
   "year": 2013,
   "similarity": 0.416
  },
  {
   "key": "tmdb:10494",
   "workId": "c-perfect-blue",
   "title": "Идеальная грусть",
   "year": 1997,
   "similarity": 0.407
  },
  {
   "key": "tmdb:234",
   "workId": "f-tmdb234",
   "title": "Кабинет доктора Калигари",
   "year": 1920,
   "similarity": 0.402
  },
  {
   "key": "tmdb:8051",
   "workId": "f-tmdb8051",
   "title": "Любовь, сбивающая с ног",
   "year": 2002,
   "similarity": 0.392
  },
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.389
  }
 ],
 "tmdb:649": [
  {
   "key": "tmdb:5879",
   "workId": "f-tmdb5879",
   "title": "Империя чувств",
   "year": 1976,
   "similarity": 0.516
  },
  {
   "key": "tmdb:266",
   "workId": "f-tmdb266",
   "title": "Презрение",
   "year": 1963,
   "similarity": 0.504
  },
  {
   "key": "tmdb:1412",
   "workId": "f-tmdb1412",
   "title": "Секс, ложь и видео",
   "year": 1989,
   "similarity": 0.439
  },
  {
   "key": "tmdb:38810",
   "workId": "f-tmdb38810",
   "title": "Клык",
   "year": 2009,
   "similarity": 0.439
  },
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.433
  }
 ],
 "tmdb:651": [
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.466
  },
  {
   "key": "tmdb:1859",
   "workId": "f-tmdb1859",
   "title": "Ниночка",
   "year": 1939,
   "similarity": 0.442
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.393
  },
  {
   "key": "tmdb:872",
   "workId": "f-tmdb872",
   "title": "Поющие под дождём",
   "year": 1952,
   "similarity": 0.365
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.349
  }
 ],
 "tmdb:653": [
  {
   "key": "tmdb:779",
   "workId": "f-tmdb779",
   "title": "Вампир: Сон Алена Грея",
   "year": 1932,
   "similarity": 0.532
  },
  {
   "key": "tmdb:26517",
   "workId": "f-tmdb26517",
   "title": "Мартин",
   "year": 1978,
   "similarity": 0.472
  },
  {
   "key": "tmdb:10212",
   "workId": "l-tmdb10212",
   "title": "Людоед",
   "year": 1999,
   "similarity": 0.414
  },
  {
   "key": "tmdb:30959",
   "workId": "f-tmdb30959",
   "title": "Кайдан",
   "year": 1965,
   "similarity": 0.329
  },
  {
   "key": "tmdb:18333",
   "workId": "f-tmdb18333",
   "title": "Час волка",
   "year": 1968,
   "similarity": 0.326
  }
 ],
 "tmdb:654": [
  {
   "key": "tmdb:990",
   "workId": "f-tmdb990",
   "title": "Бильярдист",
   "year": 1961,
   "similarity": 0.526
  },
  {
   "key": "tmdb:28580",
   "workId": "f-tmdb28580",
   "title": "Потерянный уик-энд",
   "year": 1945,
   "similarity": 0.521
  },
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.518
  },
  {
   "key": "tmdb:238",
   "workId": "f-tmdb238",
   "title": "Крёстный отец",
   "year": 1972,
   "similarity": 0.5
  },
  {
   "key": "tmdb:240",
   "workId": "f-tmdb240",
   "title": "Крёстный отец 2",
   "year": 1974,
   "similarity": 0.482
  }
 ],
 "tmdb:655": [
  {
   "key": "tmdb:11104",
   "workId": "f-tmdb11104",
   "title": "Чунгкингский экспресс",
   "year": 1994,
   "similarity": 0.429
  },
  {
   "key": "tmdb:5165",
   "workId": "f-tmdb5165",
   "title": "Приключение",
   "year": 1960,
   "similarity": 0.37
  },
  {
   "key": "tmdb:16642",
   "workId": "f-tmdb16642",
   "title": "Дни жатвы",
   "year": 1978,
   "similarity": 0.356
  },
  {
   "key": "tmdb:10227",
   "workId": "f-tmdb10227",
   "title": "Время развлечений",
   "year": 1967,
   "similarity": 0.356
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.349
  }
 ],
 "tmdb:65754": [
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.386
  },
  {
   "key": "tmdb:11324",
   "workId": "u-kp397667",
   "title": "Остров проклятых",
   "year": 2009,
   "similarity": 0.356
  },
  {
   "key": "tmdb:10795",
   "workId": "u-kp22936",
   "title": "Не говори никому",
   "year": 2006,
   "similarity": 0.355
  },
  {
   "key": "tmdb:320",
   "workId": "f-tmdb320",
   "title": "Бессонница",
   "year": 2002,
   "similarity": 0.321
  },
  {
   "key": "tmdb:70670",
   "workId": "u-kp526812",
   "title": "Охотники за головами",
   "year": 2011,
   "similarity": 0.317
  }
 ],
 "tmdb:661": [
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.44
  },
  {
   "key": "tmdb:690",
   "workId": "f-tmdb690",
   "title": "Карманник",
   "year": 1959,
   "similarity": 0.42
  },
  {
   "key": "tmdb:15244",
   "workId": "f-tmdb15244",
   "title": "Приговоренный к смерти бежал, или Дух веет, где хочет",
   "year": 1956,
   "similarity": 0.405
  },
  {
   "key": "tmdb:31442",
   "workId": "f-tmdb31442",
   "title": "Иваново детство",
   "year": 1962,
   "similarity": 0.402
  },
  {
   "key": "tmdb:797",
   "workId": "f-tmdb797",
   "title": "Персона",
   "year": 1966,
   "similarity": 0.402
  }
 ],
 "tmdb:666": [
  {
   "key": "tmdb:1653",
   "workId": "f-tmdb1653",
   "title": "Дневники мотоциклиста",
   "year": 2004,
   "similarity": 0.396
  },
  {
   "key": "tmdb:42148",
   "workId": "f-tmdb42148",
   "title": "Пишоте: Закон самого слабого",
   "year": 1980,
   "similarity": 0.345
  },
  {
   "key": "tmdb:598",
   "workId": "f-tmdb598",
   "title": "Город бога",
   "year": 2002,
   "similarity": 0.342
  },
  {
   "key": "tmdb:11216",
   "workId": "f-tmdb11216",
   "title": "Новый кинотеатр «Парадизо»",
   "year": 1988,
   "similarity": 0.339
  },
  {
   "key": "tmdb:5156",
   "workId": "f-tmdb5156",
   "title": "Похитители велосипедов",
   "year": 1948,
   "similarity": 0.327
  }
 ],
 "tmdb:669": [
  {
   "key": "tmdb:9764",
   "workId": "f-tmdb9764",
   "title": "Дерсу Узала",
   "year": 1975,
   "similarity": 0.458
  },
  {
   "key": "tmdb:20108",
   "workId": "f-tmdb20108",
   "title": "Наудачу, Бальтазар",
   "year": 1966,
   "similarity": 0.431
  },
  {
   "key": "tmdb:42113",
   "workId": "f-tmdb42113",
   "title": "Легенда о Нараяме",
   "year": 1983,
   "similarity": 0.409
  },
  {
   "key": "tmdb:5801",
   "workId": "f-tmdb5801",
   "title": "Песнь дороги",
   "year": 1955,
   "similarity": 0.364
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.357
  }
 ],
 "tmdb:670": [
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.555
  },
  {
   "key": "tmdb:77",
   "workId": "w03",
   "title": "Помни",
   "year": 2000,
   "similarity": 0.52
  },
  {
   "key": "tmdb:4689",
   "workId": "f-tmdb4689",
   "title": "Сочувствие господину Месть",
   "year": 2002,
   "similarity": 0.519
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.513
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.511
  }
 ],
 "tmdb:678": [
  {
   "key": "tmdb:17057",
   "workId": "f-tmdb17057",
   "title": "В укромном месте",
   "year": 1950,
   "similarity": 0.623
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.614
  },
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.612
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.597
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.572
  }
 ],
 "tmdb:679": [
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.639
  },
  {
   "key": "tmdb:218",
   "workId": "f-tmdb218",
   "title": "Терминатор",
   "year": 1984,
   "similarity": 0.596
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.593
  },
  {
   "key": "tmdb:1091",
   "workId": "f-tmdb1091",
   "title": "Нечто",
   "year": 1982,
   "similarity": 0.534
  },
  {
   "key": "tmdb:11",
   "workId": "f-tmdb11",
   "title": "Звёздные войны: Эпизод 4 - Новая надежда",
   "year": 1977,
   "similarity": 0.518
  }
 ],
 "tmdb:680": [
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.776
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.517
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.517
  },
  {
   "key": "tmdb:68718",
   "workId": "f-tmdb68718",
   "title": "Джанго освобождённый",
   "year": 2012,
   "similarity": 0.507
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.503
  }
 ],
 "tmdb:686": [
  {
   "key": "tmdb:644",
   "workId": "f-tmdb644",
   "title": "Искусственный разум",
   "year": 2001,
   "similarity": 0.473
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.454
  },
  {
   "key": "tmdb:49047",
   "workId": "f-tmdb49047",
   "title": "Гравитация",
   "year": 2013,
   "similarity": 0.439
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.411
  },
  {
   "key": "tmdb:22825",
   "workId": "u-kp1762",
   "title": "Посылка",
   "year": 2009,
   "similarity": 0.391
  }
 ],
 "tmdb:68718": [
  {
   "key": "tmdb:16869",
   "workId": "f-tmdb16869",
   "title": "Бесславные ублюдки",
   "year": 2009,
   "similarity": 0.58
  },
  {
   "key": "tmdb:680",
   "workId": "f-tmdb680",
   "title": "Криминальное чтиво",
   "year": 1994,
   "similarity": 0.507
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.49
  },
  {
   "key": "tmdb:33",
   "workId": "f-tmdb33",
   "title": "Непрощённый",
   "year": 1992,
   "similarity": 0.439
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.436
  }
 ],
 "tmdb:68722": [
  {
   "key": "tmdb:145",
   "workId": "f-tmdb145",
   "title": "Рассекая волны",
   "year": 1996,
   "similarity": 0.529
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.497
  },
  {
   "key": "tmdb:17609",
   "workId": "f-tmdb17609",
   "title": "Антихрист",
   "year": 2009,
   "similarity": 0.469
  },
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.461
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.461
  }
 ],
 "tmdb:68734": [
  {
   "key": "tmdb:9008",
   "workId": "f-tmdb9008",
   "title": "Свой человек",
   "year": 1999,
   "similarity": 0.439
  },
  {
   "key": "tmdb:891",
   "workId": "f-tmdb891",
   "title": "Вся президентская рать",
   "year": 1976,
   "similarity": 0.436
  },
  {
   "key": "tmdb:820",
   "workId": "f-tmdb820",
   "title": "Джон Ф. Кеннеди: Выстрелы в Далласе",
   "year": 1991,
   "similarity": 0.421
  },
  {
   "key": "tmdb:23168",
   "workId": "f-tmdb23168",
   "title": "Город воров",
   "year": 2010,
   "similarity": 0.364
  },
  {
   "key": "tmdb:640",
   "workId": "f-tmdb640",
   "title": "Поймай меня, если сможешь",
   "year": 2002,
   "similarity": 0.338
  }
 ],
 "tmdb:68924": [
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.51
  },
  {
   "key": "tmdb:1443",
   "workId": "f-tmdb1443",
   "title": "Девственницы-самоубийцы",
   "year": 2000,
   "similarity": 0.507
  },
  {
   "key": "tmdb:25188",
   "workId": "f-tmdb25188",
   "title": "Последний киносеанс",
   "year": 1971,
   "similarity": 0.42
  },
  {
   "key": "tmdb:9451",
   "workId": "f-tmdb9451",
   "title": "Выскочка",
   "year": 1999,
   "similarity": 0.415
  },
  {
   "key": "tmdb:9675",
   "workId": "f-tmdb9675",
   "title": "На обочине",
   "year": 2004,
   "similarity": 0.405
  }
 ],
 "tmdb:690": [
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.549
  },
  {
   "key": "tmdb:1626",
   "workId": "f-tmdb1626",
   "title": "Жить своей жизнью",
   "year": 1962,
   "similarity": 0.529
  },
  {
   "key": "tmdb:21135",
   "workId": "f-tmdb21135",
   "title": "Затмение",
   "year": 1962,
   "similarity": 0.523
  },
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.515
  },
  {
   "key": "tmdb:15244",
   "workId": "f-tmdb15244",
   "title": "Приговоренный к смерти бежал, или Дух веет, где хочет",
   "year": 1956,
   "similarity": 0.514
  }
 ],
 "tmdb:694": [
  {
   "key": "tmdb:539",
   "workId": "f-tmdb539",
   "title": "Психо",
   "year": 1960,
   "similarity": 0.478
  },
  {
   "key": "tmdb:185",
   "workId": "f-tmdb185",
   "title": "Заводной апельсин",
   "year": 1971,
   "similarity": 0.473
  },
  {
   "key": "tmdb:1700",
   "workId": "f-tmdb1700",
   "title": "Мизери",
   "year": 1990,
   "similarity": 0.47
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.463
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.382
  }
 ],
 "tmdb:6947": [
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.478
  },
  {
   "key": "tmdb:22825",
   "workId": "u-kp1762",
   "title": "Посылка",
   "year": 2009,
   "similarity": 0.411
  },
  {
   "key": "tmdb:29917",
   "workId": "u-kp418762",
   "title": "Экзамен",
   "year": 2009,
   "similarity": 0.382
  },
  {
   "key": "tmdb:4547",
   "workId": "f-tmdb4547",
   "title": "Комната страха",
   "year": 2002,
   "similarity": 0.38
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.35
  }
 ],
 "tmdb:695": [
  {
   "key": "tmdb:24469",
   "workId": "f-tmdb24469",
   "title": "Аквариум",
   "year": 2009,
   "similarity": 0.406
  },
  {
   "key": "tmdb:27845",
   "workId": "f-tmdb27845",
   "title": "Истина в вине",
   "year": 1996,
   "similarity": 0.289
  },
  {
   "key": "tmdb:68722",
   "workId": "f-tmdb68722",
   "title": "Мастер",
   "year": 2012,
   "similarity": 0.266
  }
 ],
 "tmdb:69605": [
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.394
  },
  {
   "key": "tmdb:27845",
   "workId": "f-tmdb27845",
   "title": "Истина в вине",
   "year": 1996,
   "similarity": 0.377
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.373
  },
  {
   "key": "tmdb:10227",
   "workId": "f-tmdb10227",
   "title": "Время развлечений",
   "year": 1967,
   "similarity": 0.372
  },
  {
   "key": "tmdb:27236",
   "workId": "f-tmdb27236",
   "title": "Двухполосное шоссе",
   "year": 1971,
   "similarity": 0.369
  }
 ],
 "tmdb:6977": [
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.569
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.558
  },
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.544
  },
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.532
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.519
  }
 ],
 "tmdb:70": [
  {
   "key": "tmdb:510",
   "workId": "f-tmdb510",
   "title": "Пролетая над гнездом кукушки",
   "year": 1975,
   "similarity": 0.577
  },
  {
   "key": "tmdb:1640",
   "workId": "f-tmdb1640",
   "title": "Столкновение",
   "year": 2005,
   "similarity": 0.546
  },
  {
   "key": "tmdb:45317",
   "workId": "f-tmdb45317",
   "title": "Боец",
   "year": 2010,
   "similarity": 0.526
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.526
  },
  {
   "key": "tmdb:13223",
   "workId": "f-tmdb13223",
   "title": "Гран Торино",
   "year": 2008,
   "similarity": 0.524
  }
 ],
 "tmdb:702": [
  {
   "key": "tmdb:21734",
   "workId": "f-tmdb21734",
   "title": "Тень сомнения",
   "year": 1943,
   "similarity": 0.383
  },
  {
   "key": "tmdb:33680",
   "workId": "f-tmdb33680",
   "title": "Гранд Отель",
   "year": 1932,
   "similarity": 0.358
  },
  {
   "key": "tmdb:596",
   "workId": "f-tmdb596",
   "title": "Гроздья гнева",
   "year": 1940,
   "similarity": 0.327
  },
  {
   "key": "tmdb:3116",
   "workId": "f-tmdb3116",
   "title": "Полуночный ковбой",
   "year": 1969,
   "similarity": 0.322
  },
  {
   "key": "tmdb:705",
   "workId": "f-tmdb705",
   "title": "Все о Еве",
   "year": 1950,
   "similarity": 0.308
  }
 ],
 "tmdb:705": [
  {
   "key": "tmdb:599",
   "workId": "f-tmdb599",
   "title": "Сансет бульвар",
   "year": 1950,
   "similarity": 0.529
  },
  {
   "key": "tmdb:284",
   "workId": "f-tmdb284",
   "title": "Квартира",
   "year": 1960,
   "similarity": 0.493
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.404
  },
  {
   "key": "tmdb:15",
   "workId": "f-tmdb15",
   "title": "Гражданин Кейн",
   "year": 1941,
   "similarity": 0.394
  },
  {
   "key": "tmdb:872",
   "workId": "f-tmdb872",
   "title": "Поющие под дождём",
   "year": 1952,
   "similarity": 0.391
  }
 ],
 "tmdb:70670": [
  {
   "key": "tmdb:10795",
   "workId": "u-kp22936",
   "title": "Не говори никому",
   "year": 2006,
   "similarity": 0.521
  },
  {
   "key": "tmdb:2118",
   "workId": "f-tmdb2118",
   "title": "Секреты Лос-Анджелеса",
   "year": 1997,
   "similarity": 0.481
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.466
  },
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.463
  },
  {
   "key": "tmdb:146233",
   "workId": "f-tmdb146233",
   "title": "Пленницы",
   "year": 2013,
   "similarity": 0.46
  }
 ],
 "tmdb:72976": [
  {
   "key": "tmdb:76203",
   "workId": "f-tmdb76203",
   "title": "12 лет рабства",
   "year": 2013,
   "similarity": 0.558
  },
  {
   "key": "tmdb:581",
   "workId": "f-tmdb581",
   "title": "Танцующий с волками",
   "year": 1990,
   "similarity": 0.499
  },
  {
   "key": "tmdb:8619",
   "workId": "f-tmdb8619",
   "title": "Хозяин морей: На краю Земли",
   "year": 2003,
   "similarity": 0.434
  },
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.428
  },
  {
   "key": "tmdb:618",
   "workId": "f-tmdb618",
   "title": "Рождение нации",
   "year": 1915,
   "similarity": 0.42
  }
 ],
 "tmdb:7299": [
  {
   "key": "tmdb:180",
   "workId": "f-tmdb180",
   "title": "Особое мнение",
   "year": 2002,
   "similarity": 0.527
  },
  {
   "key": "tmdb:604",
   "workId": "f-tmdb604",
   "title": "Матрица: Перезагрузка",
   "year": 2003,
   "similarity": 0.524
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.52
  },
  {
   "key": "tmdb:605",
   "workId": "f-tmdb605",
   "title": "Матрица: Революция",
   "year": 2003,
   "similarity": 0.501
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.475
  }
 ],
 "tmdb:7340": [
  {
   "key": "tmdb:9552",
   "workId": "f-tmdb9552",
   "title": "Изгоняющий дьявола",
   "year": 1973,
   "similarity": 0.519
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.518
  },
  {
   "key": "tmdb:948",
   "workId": "f-tmdb948",
   "title": "Хэллоуин",
   "year": 1978,
   "similarity": 0.509
  },
  {
   "key": "tmdb:805",
   "workId": "f-tmdb805",
   "title": "Ребёнок Розмари",
   "year": 1968,
   "similarity": 0.482
  },
  {
   "key": "tmdb:16307",
   "workId": "f-tmdb16307",
   "title": "Плетеный человек",
   "year": 1973,
   "similarity": 0.479
  }
 ],
 "tmdb:7345": [
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.459
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.351
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.339
  },
  {
   "key": "tmdb:11423",
   "workId": "c-memories",
   "title": "Воспоминания об убийстве",
   "year": 2003,
   "similarity": 0.321
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.315
  }
 ],
 "tmdb:73567": [
  {
   "key": "tmdb:74725",
   "workId": "c-kill-list",
   "title": "Список смертников",
   "year": 2011,
   "similarity": 0.516
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.508
  },
  {
   "key": "tmdb:77987",
   "workId": "f-tmdb77987",
   "title": "Только бог простит",
   "year": 2013,
   "similarity": 0.432
  },
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.399
  },
  {
   "key": "tmdb:837",
   "workId": "f-tmdb837",
   "title": "Видеодром",
   "year": 1983,
   "similarity": 0.396
  }
 ],
 "tmdb:74": [
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.544
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.535
  },
  {
   "key": "tmdb:49521",
   "workId": "f-tmdb49521",
   "title": "Человек из стали",
   "year": 2013,
   "similarity": 0.483
  },
  {
   "key": "tmdb:605",
   "workId": "f-tmdb605",
   "title": "Матрица: Революция",
   "year": 2003,
   "similarity": 0.477
  },
  {
   "key": "tmdb:604",
   "workId": "f-tmdb604",
   "title": "Матрица: Перезагрузка",
   "year": 2003,
   "similarity": 0.473
  }
 ],
 "tmdb:744": [
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.633
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.572
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.571
  },
  {
   "key": "tmdb:95",
   "workId": "f-tmdb95",
   "title": "Армагеддон",
   "year": 1998,
   "similarity": 0.53
  },
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.506
  }
 ],
 "tmdb:745": [
  {
   "key": "tmdb:1933",
   "workId": "c-others",
   "title": "Другие",
   "year": 2001,
   "similarity": 0.535
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.47
  },
  {
   "key": "tmdb:1124",
   "workId": "u-kp195334",
   "title": "Престиж",
   "year": 2006,
   "similarity": 0.457
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.456
  },
  {
   "key": "tmdb:278",
   "workId": "f-tmdb278",
   "title": "Побег из Шоушенка",
   "year": 1994,
   "similarity": 0.426
  }
 ],
 "tmdb:74725": [
  {
   "key": "tmdb:73567",
   "workId": "u-kp568374",
   "title": "Киллер Джо",
   "year": 2011,
   "similarity": 0.516
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.497
  },
  {
   "key": "tmdb:77987",
   "workId": "f-tmdb77987",
   "title": "Только бог простит",
   "year": 2013,
   "similarity": 0.466
  },
  {
   "key": "tmdb:86825",
   "workId": "f-tmdb86825",
   "title": "Порочные игры",
   "year": 2013,
   "similarity": 0.464
  },
  {
   "key": "tmdb:17609",
   "workId": "f-tmdb17609",
   "title": "Антихрист",
   "year": 2009,
   "similarity": 0.438
  }
 ],
 "tmdb:7500": [
  {
   "key": "tmdb:5910",
   "workId": "f-tmdb5910",
   "title": "Фейерверк",
   "year": 1997,
   "similarity": 0.53
  },
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.415
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.353
  },
  {
   "key": "tmdb:8073",
   "workId": "f-tmdb8073",
   "title": "Банда аутсайдеров",
   "year": 1964,
   "similarity": 0.347
  },
  {
   "key": "tmdb:269",
   "workId": "f-tmdb269",
   "title": "На последнем дыхании",
   "year": 1960,
   "similarity": 0.333
  }
 ],
 "tmdb:752": [
  {
   "key": "tmdb:13183",
   "workId": "f-tmdb13183",
   "title": "Хранители",
   "year": 2009,
   "similarity": 0.686
  },
  {
   "key": "tmdb:49026",
   "workId": "f-tmdb49026",
   "title": "Тёмный рыцарь: Возрождение легенды",
   "year": 2012,
   "similarity": 0.6
  },
  {
   "key": "tmdb:272",
   "workId": "f-tmdb272",
   "title": "Бэтмен: Начало",
   "year": 2005,
   "similarity": 0.596
  },
  {
   "key": "tmdb:155",
   "workId": "f-tmdb155",
   "title": "Тёмный рыцарь",
   "year": 2008,
   "similarity": 0.578
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.486
  }
 ],
 "tmdb:754": [
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.693
  },
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.674
  },
  {
   "key": "tmdb:36955",
   "workId": "f-tmdb36955",
   "title": "Правдивая ложь",
   "year": 1994,
   "similarity": 0.584
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.523
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.505
  }
 ],
 "tmdb:75612": [
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.588
  },
  {
   "key": "tmdb:644",
   "workId": "f-tmdb644",
   "title": "Искусственный разум",
   "year": 2001,
   "similarity": 0.573
  },
  {
   "key": "tmdb:180",
   "workId": "f-tmdb180",
   "title": "Особое мнение",
   "year": 2002,
   "similarity": 0.573
  },
  {
   "key": "tmdb:74",
   "workId": "f-tmdb74",
   "title": "Война миров",
   "year": 2005,
   "similarity": 0.544
  },
  {
   "key": "tmdb:7299",
   "workId": "u-kp309",
   "title": "Эквилибриум",
   "year": 2002,
   "similarity": 0.52
  }
 ],
 "tmdb:75656": [
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.608
  },
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.523
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.479
  },
  {
   "key": "tmdb:161",
   "workId": "f-tmdb161",
   "title": "Одиннадцать друзей Оушена",
   "year": 2001,
   "similarity": 0.456
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.439
  }
 ],
 "tmdb:76": [
  {
   "key": "tmdb:132344",
   "workId": "f-tmdb132344",
   "title": "Перед полуночью",
   "year": 2013,
   "similarity": 0.613
  },
  {
   "key": "tmdb:80",
   "workId": "f-tmdb80",
   "title": "Перед закатом",
   "year": 2004,
   "similarity": 0.608
  },
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.482
  },
  {
   "key": "tmdb:11104",
   "workId": "f-tmdb11104",
   "title": "Чунгкингский экспресс",
   "year": 1994,
   "similarity": 0.373
  },
  {
   "key": "tmdb:851",
   "workId": "f-tmdb851",
   "title": "Короткая встреча",
   "year": 1945,
   "similarity": 0.365
  }
 ],
 "tmdb:76203": [
  {
   "key": "tmdb:72976",
   "workId": "f-tmdb72976",
   "title": "Линкольн",
   "year": 2012,
   "similarity": 0.558
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.469
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.441
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.436
  },
  {
   "key": "tmdb:1955",
   "workId": "f-tmdb1955",
   "title": "Человек-слон",
   "year": 1980,
   "similarity": 0.377
  }
 ],
 "tmdb:769": [
  {
   "key": "tmdb:238",
   "workId": "f-tmdb238",
   "title": "Крёстный отец",
   "year": 1972,
   "similarity": 0.645
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.627
  },
  {
   "key": "tmdb:1422",
   "workId": "f-tmdb1422",
   "title": "Отступники",
   "year": 2006,
   "similarity": 0.595
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.544
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.537
  }
 ],
 "tmdb:77": [
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.647
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.613
  },
  {
   "key": "tmdb:550",
   "workId": "u-kp361",
   "title": "Бойцовский клуб",
   "year": 1999,
   "similarity": 0.549
  },
  {
   "key": "tmdb:27205",
   "workId": "w08",
   "title": "Начало",
   "year": 2010,
   "similarity": 0.531
  },
  {
   "key": "tmdb:670",
   "workId": "u-kp75871",
   "title": "Олдбой",
   "year": 2003,
   "similarity": 0.52
  }
 ],
 "tmdb:770": [
  {
   "key": "tmdb:618",
   "workId": "f-tmdb618",
   "title": "Рождение нации",
   "year": 1915,
   "similarity": 0.624
  },
  {
   "key": "tmdb:581",
   "workId": "f-tmdb581",
   "title": "Танцующий с волками",
   "year": 1990,
   "similarity": 0.527
  },
  {
   "key": "tmdb:595",
   "workId": "f-tmdb595",
   "title": "Убить пересмешника",
   "year": 1962,
   "similarity": 0.467
  },
  {
   "key": "tmdb:72976",
   "workId": "f-tmdb72976",
   "title": "Линкольн",
   "year": 2012,
   "similarity": 0.428
  },
  {
   "key": "tmdb:887",
   "workId": "f-tmdb887",
   "title": "Лучшие годы нашей жизни",
   "year": 1946,
   "similarity": 0.427
  }
 ],
 "tmdb:773": [
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.543
  },
  {
   "key": "tmdb:343",
   "workId": "f-tmdb343",
   "title": "Гарольд и Мод",
   "year": 1971,
   "similarity": 0.483
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.479
  },
  {
   "key": "tmdb:14",
   "workId": "f-tmdb14",
   "title": "Красота по-американски",
   "year": 1999,
   "similarity": 0.469
  },
  {
   "key": "tmdb:334",
   "workId": "f-tmdb334",
   "title": "Магнолия",
   "year": 1999,
   "similarity": 0.43
  }
 ],
 "tmdb:77365": [
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.347
  },
  {
   "key": "tmdb:4689",
   "workId": "f-tmdb4689",
   "title": "Сочувствие господину Месть",
   "year": 2002,
   "similarity": 0.345
  },
  {
   "key": "tmdb:2260",
   "workId": "f-tmdb2260",
   "title": "Захват Фридманов",
   "year": 2003,
   "similarity": 0.268
  },
  {
   "key": "tmdb:7859",
   "workId": "f-tmdb7859",
   "title": "Полу-Нельсон",
   "year": 2006,
   "similarity": 0.252
  }
 ],
 "tmdb:775": [
  {
   "key": "tmdb:234",
   "workId": "f-tmdb234",
   "title": "Кабинет доктора Калигари",
   "year": 1920,
   "similarity": 0.337
  },
  {
   "key": "tmdb:593",
   "workId": "w06",
   "title": "Солярис",
   "year": 1972,
   "similarity": 0.326
  },
  {
   "key": "tmdb:840",
   "workId": "f-tmdb840",
   "title": "Близкие контакты третьей степени",
   "year": 1977,
   "similarity": 0.31
  },
  {
   "key": "tmdb:2756",
   "workId": "f-tmdb2756",
   "title": "Бездна",
   "year": 1989,
   "similarity": 0.289
  },
  {
   "key": "tmdb:62",
   "workId": "f-tmdb62",
   "title": "2001 год: Космическая одиссея",
   "year": 1968,
   "similarity": 0.255
  }
 ],
 "tmdb:779": [
  {
   "key": "tmdb:653",
   "workId": "f-tmdb653",
   "title": "Носферату, симфония ужаса",
   "year": 1922,
   "similarity": 0.532
  },
  {
   "key": "tmdb:26517",
   "workId": "f-tmdb26517",
   "title": "Мартин",
   "year": 1978,
   "similarity": 0.529
  },
  {
   "key": "tmdb:30959",
   "workId": "f-tmdb30959",
   "title": "Кайдан",
   "year": 1965,
   "similarity": 0.396
  },
  {
   "key": "tmdb:931",
   "workId": "u-kp6268",
   "title": "А теперь не смотри",
   "year": 1973,
   "similarity": 0.389
  },
  {
   "key": "tmdb:5991",
   "workId": "f-tmdb5991",
   "title": "Последний человек",
   "year": 1924,
   "similarity": 0.385
  }
 ],
 "tmdb:77987": [
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.584
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.508
  },
  {
   "key": "tmdb:74725",
   "workId": "c-kill-list",
   "title": "Список смертников",
   "year": 2011,
   "similarity": 0.466
  },
  {
   "key": "tmdb:17609",
   "workId": "f-tmdb17609",
   "title": "Антихрист",
   "year": 2009,
   "similarity": 0.459
  },
  {
   "key": "tmdb:86825",
   "workId": "f-tmdb86825",
   "title": "Порочные игры",
   "year": 2013,
   "similarity": 0.454
  }
 ],
 "tmdb:78": [
  {
   "key": "tmdb:218",
   "workId": "f-tmdb218",
   "title": "Терминатор",
   "year": 1984,
   "similarity": 0.558
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.547
  },
  {
   "key": "tmdb:17431",
   "workId": "l-tmdb17431",
   "title": "Луна 2112",
   "year": 2009,
   "similarity": 0.516
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.515
  },
  {
   "key": "tmdb:603",
   "workId": "f-tmdb603",
   "title": "Матрица",
   "year": 1999,
   "similarity": 0.504
  }
 ],
 "tmdb:780": [
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.642
  },
  {
   "key": "tmdb:895",
   "workId": "f-tmdb895",
   "title": "Андрей Рублёв",
   "year": 1966,
   "similarity": 0.578
  },
  {
   "key": "tmdb:11602",
   "workId": "f-tmdb11602",
   "title": "Сквозь темное стекло",
   "year": 1961,
   "similarity": 0.537
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.528
  },
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.513
  }
 ],
 "tmdb:782": [
  {
   "key": "tmdb:180",
   "workId": "f-tmdb180",
   "title": "Особое мнение",
   "year": 2002,
   "similarity": 0.513
  },
  {
   "key": "tmdb:281",
   "workId": "f-tmdb281",
   "title": "Странные дни",
   "year": 1995,
   "similarity": 0.5
  },
  {
   "key": "tmdb:644",
   "workId": "f-tmdb644",
   "title": "Искусственный разум",
   "year": 2001,
   "similarity": 0.481
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.477
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.476
  }
 ],
 "tmdb:7857": [
  {
   "key": "tmdb:11698",
   "workId": "f-tmdb11698",
   "title": "Строшек",
   "year": 1977,
   "similarity": 0.463
  },
  {
   "key": "tmdb:10227",
   "workId": "f-tmdb10227",
   "title": "Время развлечений",
   "year": 1967,
   "similarity": 0.423
  },
  {
   "key": "tmdb:26596",
   "workId": "f-tmdb26596",
   "title": "Джонни-гитара",
   "year": 1954,
   "similarity": 0.422
  },
  {
   "key": "tmdb:4593",
   "workId": "f-tmdb4593",
   "title": "Скромное обаяние буржуазии",
   "year": 1972,
   "similarity": 0.405
  },
  {
   "key": "tmdb:439",
   "workId": "f-tmdb439",
   "title": "Сладкая жизнь",
   "year": 1960,
   "similarity": 0.386
  }
 ],
 "tmdb:7859": [
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.414
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.403
  },
  {
   "key": "tmdb:14275",
   "workId": "f-tmdb14275",
   "title": "Баскетбольные мечты",
   "year": 1994,
   "similarity": 0.34
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.337
  },
  {
   "key": "tmdb:68924",
   "workId": "f-tmdb68924",
   "title": "Ледяной ветер",
   "year": 1997,
   "similarity": 0.337
  }
 ],
 "tmdb:79120": [
  {
   "key": "tmdb:31225",
   "workId": "f-tmdb31225",
   "title": "Париж в огне",
   "year": 1991,
   "similarity": 0.524
  },
  {
   "key": "tmdb:11703",
   "workId": "f-tmdb11703",
   "title": "Поцелуй женщины-паука",
   "year": 1985,
   "similarity": 0.417
  },
  {
   "key": "tmdb:47620",
   "workId": "f-tmdb47620",
   "title": "Отрава",
   "year": 1991,
   "similarity": 0.406
  },
  {
   "key": "tmdb:590",
   "workId": "f-tmdb590",
   "title": "Часы",
   "year": 2002,
   "similarity": 0.353
  },
  {
   "key": "tmdb:3116",
   "workId": "f-tmdb3116",
   "title": "Полуночный ковбой",
   "year": 1969,
   "similarity": 0.321
  }
 ],
 "tmdb:792": [
  {
   "key": "tmdb:11778",
   "workId": "f-tmdb11778",
   "title": "Охотник на оленей",
   "year": 1978,
   "similarity": 0.648
  },
  {
   "key": "tmdb:28",
   "workId": "f-tmdb28",
   "title": "Апокалипсис сегодня",
   "year": 1979,
   "similarity": 0.584
  },
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.535
  },
  {
   "key": "tmdb:1251",
   "workId": "f-tmdb1251",
   "title": "Письма с Иводзимы",
   "year": 2006,
   "similarity": 0.449
  },
  {
   "key": "tmdb:2604",
   "workId": "f-tmdb2604",
   "title": "Рождённый четвёртого июля",
   "year": 1989,
   "similarity": 0.427
  }
 ],
 "tmdb:793": [
  {
   "key": "tmdb:1018",
   "workId": "c-mulholland",
   "title": "Малхолланд Драйв",
   "year": 2001,
   "similarity": 0.55
  },
  {
   "key": "tmdb:73567",
   "workId": "u-kp568374",
   "title": "Киллер Джо",
   "year": 2011,
   "similarity": 0.508
  },
  {
   "key": "tmdb:837",
   "workId": "f-tmdb837",
   "title": "Видеодром",
   "year": 1983,
   "similarity": 0.481
  },
  {
   "key": "tmdb:68722",
   "workId": "f-tmdb68722",
   "title": "Мастер",
   "year": 2012,
   "similarity": 0.461
  },
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.456
  }
 ],
 "tmdb:797": [
  {
   "key": "tmdb:41662",
   "workId": "f-tmdb41662",
   "title": "3 женщины",
   "year": 1977,
   "similarity": 0.601
  },
  {
   "key": "tmdb:18333",
   "workId": "f-tmdb18333",
   "title": "Час волка",
   "year": 1968,
   "similarity": 0.595
  },
  {
   "key": "tmdb:16672",
   "workId": "f-tmdb16672",
   "title": "Женщина в песках",
   "year": 1964,
   "similarity": 0.577
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.574
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.572
  }
 ],
 "tmdb:80": [
  {
   "key": "tmdb:76",
   "workId": "f-tmdb76",
   "title": "Перед рассветом",
   "year": 1995,
   "similarity": 0.608
  },
  {
   "key": "tmdb:132344",
   "workId": "f-tmdb132344",
   "title": "Перед полуночью",
   "year": 2013,
   "similarity": 0.557
  },
  {
   "key": "tmdb:4922",
   "workId": "f-tmdb4922",
   "title": "Загадочная история Бенджамина Баттона",
   "year": 2008,
   "similarity": 0.361
  },
  {
   "key": "tmdb:194",
   "workId": "f-tmdb194",
   "title": "Амели",
   "year": 2001,
   "similarity": 0.338
  },
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.333
  }
 ],
 "tmdb:803": [
  {
   "key": "tmdb:15244",
   "workId": "f-tmdb15244",
   "title": "Приговоренный к смерти бежал, или Дух веет, где хочет",
   "year": 1956,
   "similarity": 0.469
  },
  {
   "key": "tmdb:1786",
   "workId": "f-tmdb1786",
   "title": "До свидания, дети",
   "year": 1987,
   "similarity": 0.459
  },
  {
   "key": "tmdb:31442",
   "workId": "f-tmdb31442",
   "title": "Иваново детство",
   "year": 1962,
   "similarity": 0.444
  },
  {
   "key": "tmdb:661",
   "workId": "f-tmdb661",
   "title": "Замужество Марии Браун",
   "year": 1979,
   "similarity": 0.398
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.367
  }
 ],
 "tmdb:804": [
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.608
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.545
  },
  {
   "key": "tmdb:900",
   "workId": "f-tmdb900",
   "title": "Воспитание крошки",
   "year": 1938,
   "similarity": 0.543
  },
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.486
  },
  {
   "key": "tmdb:284",
   "workId": "f-tmdb284",
   "title": "Квартира",
   "year": 1960,
   "similarity": 0.479
  }
 ],
 "tmdb:805": [
  {
   "key": "tmdb:9552",
   "workId": "f-tmdb9552",
   "title": "Изгоняющий дьявола",
   "year": 1973,
   "similarity": 0.495
  },
  {
   "key": "tmdb:7340",
   "workId": "f-tmdb7340",
   "title": "Кэрри",
   "year": 1976,
   "similarity": 0.482
  },
  {
   "key": "tmdb:16307",
   "workId": "f-tmdb16307",
   "title": "Плетеный человек",
   "year": 1973,
   "similarity": 0.438
  },
  {
   "key": "tmdb:694",
   "workId": "f-tmdb694",
   "title": "Сияние",
   "year": 1980,
   "similarity": 0.369
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.369
  }
 ],
 "tmdb:8051": [
  {
   "key": "tmdb:2757",
   "workId": "f-tmdb2757",
   "title": "Адаптация",
   "year": 2002,
   "similarity": 0.42
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.417
  },
  {
   "key": "tmdb:153",
   "workId": "f-tmdb153",
   "title": "Трудности перевода",
   "year": 2003,
   "similarity": 0.408
  },
  {
   "key": "tmdb:64720",
   "workId": "f-tmdb64720",
   "title": "Укрытие",
   "year": 2011,
   "similarity": 0.392
  },
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.388
  }
 ],
 "tmdb:8052": [
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.457
  },
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.359
  },
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.34
  },
  {
   "key": "tmdb:10778",
   "workId": "f-tmdb10778",
   "title": "Человек, которого не было",
   "year": 2001,
   "similarity": 0.323
  },
  {
   "key": "tmdb:10218",
   "workId": "f-tmdb10218",
   "title": "Тусовщики",
   "year": 1996,
   "similarity": 0.314
  }
 ],
 "tmdb:8055": [
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.44
  },
  {
   "key": "tmdb:637",
   "workId": "f-tmdb637",
   "title": "Жизнь прекрасна",
   "year": 1997,
   "similarity": 0.426
  },
  {
   "key": "tmdb:4588",
   "workId": "f-tmdb4588",
   "title": "Вожделение",
   "year": 2007,
   "similarity": 0.414
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.404
  },
  {
   "key": "tmdb:1786",
   "workId": "f-tmdb1786",
   "title": "До свидания, дети",
   "year": 1987,
   "similarity": 0.375
  }
 ],
 "tmdb:8066": [
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.497
  },
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.475
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.459
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.439
  },
  {
   "key": "tmdb:26466",
   "workId": "l-tmdb26466",
   "title": "Треугольник",
   "year": 2009,
   "similarity": 0.437
  }
 ],
 "tmdb:8072": [
  {
   "key": "tmdb:8284",
   "workId": "l-tmdb8284",
   "title": "Предел контроля",
   "year": 2009,
   "similarity": 0.42
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.399
  },
  {
   "key": "tmdb:636",
   "workId": "f-tmdb636",
   "title": "Галактика ТНХ-1138",
   "year": 1971,
   "similarity": 0.368
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.341
  },
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.34
  }
 ],
 "tmdb:8073": [
  {
   "key": "tmdb:269",
   "workId": "f-tmdb269",
   "title": "На последнем дыхании",
   "year": 1960,
   "similarity": 0.561
  },
  {
   "key": "tmdb:934",
   "workId": "f-tmdb934",
   "title": "Мужские разборки",
   "year": 1955,
   "similarity": 0.49
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.478
  },
  {
   "key": "tmdb:26596",
   "workId": "f-tmdb26596",
   "title": "Джонни-гитара",
   "year": 1954,
   "similarity": 0.473
  },
  {
   "key": "tmdb:2786",
   "workId": "f-tmdb2786",
   "title": "Безумный Пьеро",
   "year": 1965,
   "similarity": 0.463
  }
 ],
 "tmdb:82": [
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.56
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.402
  },
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.398
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.38
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.379
  }
 ],
 "tmdb:820": [
  {
   "key": "tmdb:891",
   "workId": "f-tmdb891",
   "title": "Вся президентская рать",
   "year": 1976,
   "similarity": 0.51
  },
  {
   "key": "tmdb:9008",
   "workId": "f-tmdb9008",
   "title": "Свой человек",
   "year": 1999,
   "similarity": 0.442
  },
  {
   "key": "tmdb:10858",
   "workId": "f-tmdb10858",
   "title": "Никсон",
   "year": 1995,
   "similarity": 0.427
  },
  {
   "key": "tmdb:68734",
   "workId": "f-tmdb68734",
   "title": "Операция «Арго»",
   "year": 2012,
   "similarity": 0.421
  },
  {
   "key": "tmdb:2604",
   "workId": "f-tmdb2604",
   "title": "Рождённый четвёртого июля",
   "year": 1989,
   "similarity": 0.415
  }
 ],
 "tmdb:82507": [
  {
   "key": "tmdb:11096",
   "workId": "l-tmdb11096",
   "title": "Игра в прятки",
   "year": 2005,
   "similarity": 0.534
  },
  {
   "key": "tmdb:10226",
   "workId": "u-kp34465",
   "title": "Кровавая жатва",
   "year": 2003,
   "similarity": 0.514
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.514
  },
  {
   "key": "tmdb:1933",
   "workId": "c-others",
   "title": "Другие",
   "year": 2001,
   "similarity": 0.5
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.488
  }
 ],
 "tmdb:82693": [
  {
   "key": "tmdb:401",
   "workId": "f-tmdb401",
   "title": "Страна садов",
   "year": 2004,
   "similarity": 0.41
  },
  {
   "key": "tmdb:10758",
   "workId": "f-tmdb10758",
   "title": "Официантка",
   "year": 2007,
   "similarity": 0.377
  },
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.376
  },
  {
   "key": "tmdb:207",
   "workId": "f-tmdb207",
   "title": "Общество мёртвых поэтов",
   "year": 1989,
   "similarity": 0.349
  },
  {
   "key": "tmdb:11050",
   "workId": "f-tmdb11050",
   "title": "Язык нежности",
   "year": 1983,
   "similarity": 0.332
  }
 ],
 "tmdb:8272": [
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.54
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.526
  },
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.479
  },
  {
   "key": "tmdb:1919",
   "workId": "f-tmdb1919",
   "title": "Вдали от неё",
   "year": 2007,
   "similarity": 0.479
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.433
  }
 ],
 "tmdb:8284": [
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.613
  },
  {
   "key": "tmdb:13998",
   "workId": "f-tmdb13998",
   "title": "Марго на свадьбе",
   "year": 2007,
   "similarity": 0.526
  },
  {
   "key": "tmdb:59490",
   "workId": "f-tmdb59490",
   "title": "Пещера забытых снов",
   "year": 2010,
   "similarity": 0.519
  },
  {
   "key": "tmdb:77987",
   "workId": "f-tmdb77987",
   "title": "Только бог простит",
   "year": 2013,
   "similarity": 0.508
  },
  {
   "key": "tmdb:4024",
   "workId": "f-tmdb4024",
   "title": "В прошлом году в Мариенбаде",
   "year": 1961,
   "similarity": 0.475
  }
 ],
 "tmdb:829": [
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.666
  },
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.585
  },
  {
   "key": "tmdb:426",
   "workId": "f-tmdb426",
   "title": "Головокружение",
   "year": 1958,
   "similarity": 0.575
  },
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.548
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.54
  }
 ],
 "tmdb:832": [
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.52
  },
  {
   "key": "tmdb:234",
   "workId": "f-tmdb234",
   "title": "Кабинет доктора Калигари",
   "year": 1920,
   "similarity": 0.498
  },
  {
   "key": "tmdb:15794",
   "workId": "f-tmdb15794",
   "title": "Белая горячка",
   "year": 1949,
   "similarity": 0.461
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.457
  },
  {
   "key": "tmdb:12493",
   "workId": "f-tmdb12493",
   "title": "Рай и ад",
   "year": 1963,
   "similarity": 0.443
  }
 ],
 "tmdb:8321": [
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.44
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.377
  },
  {
   "key": "tmdb:6977",
   "workId": "f-tmdb6977",
   "title": "Старикам тут не место",
   "year": 2007,
   "similarity": 0.365
  },
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.36
  },
  {
   "key": "tmdb:9905",
   "workId": "f-tmdb9905",
   "title": "Неглубокая могила",
   "year": 1994,
   "similarity": 0.342
  }
 ],
 "tmdb:8358": [
  {
   "key": "tmdb:1585",
   "workId": "f-tmdb1585",
   "title": "Эта замечательная жизнь",
   "year": 1946,
   "similarity": 0.407
  },
  {
   "key": "tmdb:568",
   "workId": "f-tmdb568",
   "title": "Аполлон 13",
   "year": 1995,
   "similarity": 0.407
  },
  {
   "key": "tmdb:49047",
   "workId": "f-tmdb49047",
   "title": "Гравитация",
   "year": 2013,
   "similarity": 0.307
  },
  {
   "key": "tmdb:462",
   "workId": "f-tmdb462",
   "title": "Эрин Брокович",
   "year": 2000,
   "similarity": 0.305
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.3
  }
 ],
 "tmdb:83666": [
  {
   "key": "tmdb:194",
   "workId": "f-tmdb194",
   "title": "Амели",
   "year": 2001,
   "similarity": 0.459
  },
  {
   "key": "tmdb:1382",
   "workId": "f-tmdb1382",
   "title": "Я и ты и все, кого мы знаем",
   "year": 2005,
   "similarity": 0.412
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.37
  },
  {
   "key": "tmdb:773",
   "workId": "f-tmdb773",
   "title": "Маленькая мисс Счастье",
   "year": 2006,
   "similarity": 0.364
  },
  {
   "key": "tmdb:343",
   "workId": "f-tmdb343",
   "title": "Гарольд и Мод",
   "year": 1971,
   "similarity": 0.36
  }
 ],
 "tmdb:837": [
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.532
  },
  {
   "key": "tmdb:793",
   "workId": "f-tmdb793",
   "title": "Синий бархат",
   "year": 1986,
   "similarity": 0.481
  },
  {
   "key": "tmdb:9540",
   "workId": "f-tmdb9540",
   "title": "Связанные насмерть",
   "year": 1988,
   "similarity": 0.479
  },
  {
   "key": "tmdb:931",
   "workId": "u-kp6268",
   "title": "А теперь не смотри",
   "year": 1973,
   "similarity": 0.427
  },
  {
   "key": "tmdb:11167",
   "workId": "f-tmdb11167",
   "title": "Подглядывающий",
   "year": 1960,
   "similarity": 0.414
  }
 ],
 "tmdb:838": [
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.524
  },
  {
   "key": "tmdb:235",
   "workId": "f-tmdb235",
   "title": "Останься со мной",
   "year": 1986,
   "similarity": 0.471
  },
  {
   "key": "tmdb:621",
   "workId": "f-tmdb621",
   "title": "Бриолин",
   "year": 1978,
   "similarity": 0.439
  },
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.437
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.431
  }
 ],
 "tmdb:840": [
  {
   "key": "tmdb:601",
   "workId": "f-tmdb601",
   "title": "Инопланетянин",
   "year": 1982,
   "similarity": 0.573
  },
  {
   "key": "tmdb:2756",
   "workId": "f-tmdb2756",
   "title": "Бездна",
   "year": 1989,
   "similarity": 0.482
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.46
  },
  {
   "key": "tmdb:329",
   "workId": "f-tmdb329",
   "title": "Парк юрского периода",
   "year": 1993,
   "similarity": 0.428
  },
  {
   "key": "tmdb:11",
   "workId": "f-tmdb11",
   "title": "Звёздные войны: Эпизод 4 - Новая надежда",
   "year": 1977,
   "similarity": 0.395
  }
 ],
 "tmdb:843": [
  {
   "key": "tmdb:11104",
   "workId": "f-tmdb11104",
   "title": "Чунгкингский экспресс",
   "year": 1994,
   "similarity": 0.394
  },
  {
   "key": "tmdb:153",
   "workId": "f-tmdb153",
   "title": "Трудности перевода",
   "year": 2003,
   "similarity": 0.39
  },
  {
   "key": "tmdb:631",
   "workId": "f-tmdb631",
   "title": "Восход солнца",
   "year": 1927,
   "similarity": 0.372
  },
  {
   "key": "tmdb:10404",
   "workId": "f-tmdb10404",
   "title": "Подними красный фонарь",
   "year": 1991,
   "similarity": 0.37
  },
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.354
  }
 ],
 "tmdb:84334": [
  {
   "key": "tmdb:24128",
   "workId": "f-tmdb24128",
   "title": "Не ищи смысла",
   "year": 1984,
   "similarity": 0.543
  },
  {
   "key": "tmdb:279",
   "workId": "f-tmdb279",
   "title": "Амадей",
   "year": 1984,
   "similarity": 0.326
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.324
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.298
  },
  {
   "key": "tmdb:11216",
   "workId": "f-tmdb11216",
   "title": "Новый кинотеатр «Парадизо»",
   "year": 1988,
   "similarity": 0.264
  }
 ],
 "tmdb:845": [
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.596
  },
  {
   "key": "tmdb:567",
   "workId": "f-tmdb567",
   "title": "Окно во двор",
   "year": 1954,
   "similarity": 0.51
  },
  {
   "key": "tmdb:213",
   "workId": "f-tmdb213",
   "title": "На север через северо-запад",
   "year": 1959,
   "similarity": 0.497
  },
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.477
  },
  {
   "key": "tmdb:93",
   "workId": "f-tmdb93",
   "title": "Анатомия убийства",
   "year": 1959,
   "similarity": 0.474
  }
 ],
 "tmdb:85": [
  {
   "key": "tmdb:11",
   "workId": "f-tmdb11",
   "title": "Звёздные войны: Эпизод 4 - Новая надежда",
   "year": 1977,
   "similarity": 0.52
  },
  {
   "key": "tmdb:22",
   "workId": "f-tmdb22",
   "title": "Пираты Карибского моря: Проклятие Чёрной жемчужины",
   "year": 2003,
   "similarity": 0.442
  },
  {
   "key": "tmdb:562",
   "workId": "f-tmdb562",
   "title": "Крепкий орешек",
   "year": 1988,
   "similarity": 0.395
  },
  {
   "key": "tmdb:620",
   "workId": "f-tmdb620",
   "title": "Охотники за привидениями",
   "year": 1984,
   "similarity": 0.394
  },
  {
   "key": "tmdb:105",
   "workId": "f-tmdb105",
   "title": "Назад в будущее",
   "year": 1985,
   "similarity": 0.387
  }
 ],
 "tmdb:851": [
  {
   "key": "tmdb:33680",
   "workId": "f-tmdb33680",
   "title": "Гранд Отель",
   "year": 1932,
   "similarity": 0.403
  },
  {
   "key": "tmdb:41050",
   "workId": "f-tmdb41050",
   "title": "Ночь",
   "year": 1961,
   "similarity": 0.382
  },
  {
   "key": "tmdb:76",
   "workId": "f-tmdb76",
   "title": "Перед рассветом",
   "year": 1995,
   "similarity": 0.365
  },
  {
   "key": "tmdb:981",
   "workId": "f-tmdb981",
   "title": "Филадельфийская история",
   "year": 1940,
   "similarity": 0.364
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.353
  }
 ],
 "tmdb:855": [
  {
   "key": "tmdb:12162",
   "workId": "f-tmdb12162",
   "title": "Повелитель бури",
   "year": 2008,
   "similarity": 0.587
  },
  {
   "key": "tmdb:1372",
   "workId": "f-tmdb1372",
   "title": "Кровавый алмаз",
   "year": 2006,
   "similarity": 0.54
  },
  {
   "key": "tmdb:97630",
   "workId": "f-tmdb97630",
   "title": "Цель номер один",
   "year": 2012,
   "similarity": 0.482
  },
  {
   "key": "tmdb:616",
   "workId": "f-tmdb616",
   "title": "Последний самурай",
   "year": 2003,
   "similarity": 0.442
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.435
  }
 ],
 "tmdb:856": [
  {
   "key": "tmdb:620",
   "workId": "f-tmdb620",
   "title": "Охотники за привидениями",
   "year": 1984,
   "similarity": 0.436
  },
  {
   "key": "tmdb:557",
   "workId": "f-tmdb557",
   "title": "Человек-паук",
   "year": 2002,
   "similarity": 0.389
  },
  {
   "key": "tmdb:22",
   "workId": "f-tmdb22",
   "title": "Пираты Карибского моря: Проклятие Чёрной жемчужины",
   "year": 2003,
   "similarity": 0.374
  },
  {
   "key": "tmdb:630",
   "workId": "f-tmdb630",
   "title": "Волшебник страны Оз",
   "year": 1939,
   "similarity": 0.36
  },
  {
   "key": "tmdb:558",
   "workId": "f-tmdb558",
   "title": "Человек-паук 2",
   "year": 2004,
   "similarity": 0.339
  }
 ],
 "tmdb:857": [
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.679
  },
  {
   "key": "tmdb:1654",
   "workId": "f-tmdb1654",
   "title": "Грязная дюжина",
   "year": 1967,
   "similarity": 0.607
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.59
  },
  {
   "key": "tmdb:792",
   "workId": "f-tmdb792",
   "title": "Взвод",
   "year": 1986,
   "similarity": 0.535
  },
  {
   "key": "tmdb:16869",
   "workId": "f-tmdb16869",
   "title": "Бесславные ублюдки",
   "year": 2009,
   "similarity": 0.503
  }
 ],
 "tmdb:861": [
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.639
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.598
  },
  {
   "key": "tmdb:75612",
   "workId": "u-kp470185",
   "title": "Обливион",
   "year": 2013,
   "similarity": 0.588
  },
  {
   "key": "tmdb:180",
   "workId": "f-tmdb180",
   "title": "Особое мнение",
   "year": 2002,
   "similarity": 0.572
  },
  {
   "key": "tmdb:218",
   "workId": "f-tmdb218",
   "title": "Терминатор",
   "year": 1984,
   "similarity": 0.557
  }
 ],
 "tmdb:8619": [
  {
   "key": "tmdb:1495",
   "workId": "f-tmdb1495",
   "title": "Царство небесное",
   "year": 2005,
   "similarity": 0.46
  },
  {
   "key": "tmdb:72976",
   "workId": "f-tmdb72976",
   "title": "Линкольн",
   "year": 2012,
   "similarity": 0.434
  },
  {
   "key": "tmdb:10436",
   "workId": "f-tmdb10436",
   "title": "Эпоха невинности",
   "year": 1993,
   "similarity": 0.4
  },
  {
   "key": "tmdb:581",
   "workId": "f-tmdb581",
   "title": "Танцующий с волками",
   "year": 1990,
   "similarity": 0.38
  },
  {
   "key": "tmdb:616",
   "workId": "f-tmdb616",
   "title": "Последний самурай",
   "year": 2003,
   "similarity": 0.328
  }
 ],
 "tmdb:86825": [
  {
   "key": "tmdb:74725",
   "workId": "c-kill-list",
   "title": "Список смертников",
   "year": 2011,
   "similarity": 0.464
  },
  {
   "key": "tmdb:77987",
   "workId": "f-tmdb77987",
   "title": "Только бог простит",
   "year": 2013,
   "similarity": 0.454
  },
  {
   "key": "tmdb:64720",
   "workId": "f-tmdb64720",
   "title": "Укрытие",
   "year": 2011,
   "similarity": 0.416
  },
  {
   "key": "tmdb:68722",
   "workId": "f-tmdb68722",
   "title": "Мастер",
   "year": 2012,
   "similarity": 0.397
  },
  {
   "key": "tmdb:38810",
   "workId": "f-tmdb38810",
   "title": "Клык",
   "year": 2009,
   "similarity": 0.388
  }
 ],
 "tmdb:86829": [
  {
   "key": "tmdb:86837",
   "workId": "f-tmdb86837",
   "title": "Любовь",
   "year": 2012,
   "similarity": 0.32
  },
  {
   "key": "tmdb:10778",
   "workId": "f-tmdb10778",
   "title": "Человек, которого не было",
   "year": 2001,
   "similarity": 0.312
  },
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.304
  },
  {
   "key": "tmdb:12573",
   "workId": "f-tmdb12573",
   "title": "Серьёзный человек",
   "year": 2009,
   "similarity": 0.297
  },
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.279
  }
 ],
 "tmdb:86837": [
  {
   "key": "tmdb:1600",
   "workId": "f-tmdb1600",
   "title": "Двойная жизнь Вероники",
   "year": 1991,
   "similarity": 0.508
  },
  {
   "key": "tmdb:2013",
   "workId": "f-tmdb2013",
   "title": "Скафандр и бабочка",
   "year": 2007,
   "similarity": 0.486
  },
  {
   "key": "tmdb:46705",
   "workId": "f-tmdb46705",
   "title": "Валентинка",
   "year": 2010,
   "similarity": 0.435
  },
  {
   "key": "tmdb:5544",
   "workId": "f-tmdb5544",
   "title": "Хиросима, любовь моя",
   "year": 1959,
   "similarity": 0.413
  },
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.412
  }
 ],
 "tmdb:871": [
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.453
  },
  {
   "key": "tmdb:218",
   "workId": "f-tmdb218",
   "title": "Терминатор",
   "year": 1984,
   "similarity": 0.45
  },
  {
   "key": "tmdb:17431",
   "workId": "l-tmdb17431",
   "title": "Луна 2112",
   "year": 2009,
   "similarity": 0.425
  },
  {
   "key": "tmdb:679",
   "workId": "f-tmdb679",
   "title": "Чужие",
   "year": 1986,
   "similarity": 0.402
  },
  {
   "key": "tmdb:19",
   "workId": "f-tmdb19",
   "title": "Метрополис",
   "year": 1927,
   "similarity": 0.382
  }
 ],
 "tmdb:872": [
  {
   "key": "tmdb:621",
   "workId": "f-tmdb621",
   "title": "Бриолин",
   "year": 1978,
   "similarity": 0.564
  },
  {
   "key": "tmdb:29376",
   "workId": "f-tmdb29376",
   "title": "Театральный фургон",
   "year": 1953,
   "similarity": 0.557
  },
  {
   "key": "tmdb:3080",
   "workId": "f-tmdb3080",
   "title": "Цилиндр",
   "year": 1935,
   "similarity": 0.537
  },
  {
   "key": "tmdb:20325",
   "workId": "f-tmdb20325",
   "title": "Время свинга",
   "year": 1936,
   "similarity": 0.456
  },
  {
   "key": "tmdb:909",
   "workId": "f-tmdb909",
   "title": "Встреть меня в Сент-Луисе",
   "year": 1944,
   "similarity": 0.454
  }
 ],
 "tmdb:873": [
  {
   "key": "tmdb:595",
   "workId": "f-tmdb595",
   "title": "Убить пересмешника",
   "year": 1962,
   "similarity": 0.427
  },
  {
   "key": "tmdb:462",
   "workId": "f-tmdb462",
   "title": "Эрин Брокович",
   "year": 2000,
   "similarity": 0.406
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.404
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.398
  },
  {
   "key": "tmdb:9800",
   "workId": "f-tmdb9800",
   "title": "Филадельфия",
   "year": 1993,
   "similarity": 0.389
  }
 ],
 "tmdb:8740": [
  {
   "key": "tmdb:4689",
   "workId": "f-tmdb4689",
   "title": "Сочувствие господину Месть",
   "year": 2002,
   "similarity": 0.392
  },
  {
   "key": "tmdb:10494",
   "workId": "c-perfect-blue",
   "title": "Идеальная грусть",
   "year": 1997,
   "similarity": 0.375
  },
  {
   "key": "tmdb:11423",
   "workId": "c-memories",
   "title": "Воспоминания об убийстве",
   "year": 2003,
   "similarity": 0.349
  },
  {
   "key": "tmdb:64720",
   "workId": "f-tmdb64720",
   "title": "Укрытие",
   "year": 2011,
   "similarity": 0.342
  },
  {
   "key": "tmdb:234",
   "workId": "f-tmdb234",
   "title": "Кабинет доктора Калигари",
   "year": 1920,
   "similarity": 0.335
  }
 ],
 "tmdb:8741": [
  {
   "key": "tmdb:8967",
   "workId": "f-tmdb8967",
   "title": "Древо жизни",
   "year": 2011,
   "similarity": 0.421
  },
  {
   "key": "tmdb:1398",
   "workId": "l-tmdb1398",
   "title": "Сталкер",
   "year": 1979,
   "similarity": 0.409
  },
  {
   "key": "tmdb:9764",
   "workId": "f-tmdb9764",
   "title": "Дерсу Узала",
   "year": 1975,
   "similarity": 0.364
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.36
  },
  {
   "key": "tmdb:2000",
   "workId": "f-tmdb2000",
   "title": "Агирре, гнев божий",
   "year": 1972,
   "similarity": 0.35
  }
 ],
 "tmdb:881": [
  {
   "key": "tmdb:10673",
   "workId": "f-tmdb10673",
   "title": "Уолл-стрит",
   "year": 1987,
   "similarity": 0.463
  },
  {
   "key": "tmdb:462",
   "workId": "f-tmdb462",
   "title": "Эрин Брокович",
   "year": 2000,
   "similarity": 0.459
  },
  {
   "key": "tmdb:5503",
   "workId": "f-tmdb5503",
   "title": "Беглец",
   "year": 1993,
   "similarity": 0.452
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.443
  },
  {
   "key": "tmdb:3083",
   "workId": "f-tmdb3083",
   "title": "Мистер Смит едет в Вашингтон",
   "year": 1939,
   "similarity": 0.417
  }
 ],
 "tmdb:8810": [
  {
   "key": "tmdb:1103",
   "workId": "f-tmdb1103",
   "title": "Побег из Нью-Йорка",
   "year": 1981,
   "similarity": 0.511
  },
  {
   "key": "tmdb:861",
   "workId": "f-tmdb861",
   "title": "Вспомнить всё",
   "year": 1990,
   "similarity": 0.379
  },
  {
   "key": "tmdb:280",
   "workId": "f-tmdb280",
   "title": "Терминатор 2: Судный день",
   "year": 1991,
   "similarity": 0.378
  },
  {
   "key": "tmdb:106",
   "workId": "f-tmdb106",
   "title": "Хищник",
   "year": 1987,
   "similarity": 0.371
  },
  {
   "key": "tmdb:11951",
   "workId": "f-tmdb11951",
   "title": "Исчезающая точка",
   "year": 1971,
   "similarity": 0.364
  }
 ],
 "tmdb:887": [
  {
   "key": "tmdb:11426",
   "workId": "f-tmdb11426",
   "title": "Отныне и во веки веков",
   "year": 1953,
   "similarity": 0.606
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.507
  },
  {
   "key": "tmdb:423",
   "workId": "f-tmdb423",
   "title": "Пианист",
   "year": 2002,
   "similarity": 0.44
  },
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.435
  },
  {
   "key": "tmdb:770",
   "workId": "f-tmdb770",
   "title": "Унесённые ветром",
   "year": 1939,
   "similarity": 0.427
  }
 ],
 "tmdb:891": [
  {
   "key": "tmdb:9008",
   "workId": "f-tmdb9008",
   "title": "Свой человек",
   "year": 1999,
   "similarity": 0.588
  },
  {
   "key": "tmdb:820",
   "workId": "f-tmdb820",
   "title": "Джон Ф. Кеннеди: Выстрелы в Далласе",
   "year": 1991,
   "similarity": 0.51
  },
  {
   "key": "tmdb:982",
   "workId": "f-tmdb982",
   "title": "Маньчжурский кандидат",
   "year": 1962,
   "similarity": 0.461
  },
  {
   "key": "tmdb:68734",
   "workId": "f-tmdb68734",
   "title": "Операция «Арго»",
   "year": 2012,
   "similarity": 0.436
  },
  {
   "key": "tmdb:93",
   "workId": "f-tmdb93",
   "title": "Анатомия убийства",
   "year": 1959,
   "similarity": 0.435
  }
 ],
 "tmdb:892": [
  {
   "key": "tmdb:902",
   "workId": "f-tmdb902",
   "title": "Город потерянных детей",
   "year": 1995,
   "similarity": 0.549
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.357
  },
  {
   "key": "tmdb:492",
   "workId": "f-tmdb492",
   "title": "Быть Джоном Малковичем",
   "year": 1999,
   "similarity": 0.345
  },
  {
   "key": "tmdb:290",
   "workId": "f-tmdb290",
   "title": "Бартон Финк",
   "year": 1991,
   "similarity": 0.318
  },
  {
   "key": "tmdb:185",
   "workId": "f-tmdb185",
   "title": "Заводной апельсин",
   "year": 1971,
   "similarity": 0.291
  }
 ],
 "tmdb:895": [
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.621
  },
  {
   "key": "tmdb:780",
   "workId": "f-tmdb780",
   "title": "Страсти Жанны д`Арк",
   "year": 1928,
   "similarity": 0.578
  },
  {
   "key": "tmdb:24192",
   "workId": "f-tmdb24192",
   "title": "Евангелие от Матфея",
   "year": 1965,
   "similarity": 0.556
  },
  {
   "key": "tmdb:29455",
   "workId": "f-tmdb29455",
   "title": "Причастие",
   "year": 1963,
   "similarity": 0.527
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.486
  }
 ],
 "tmdb:8967": [
  {
   "key": "tmdb:1398",
   "workId": "l-tmdb1398",
   "title": "Сталкер",
   "year": 1979,
   "similarity": 0.46
  },
  {
   "key": "tmdb:1396",
   "workId": "w07",
   "title": "Зеркало",
   "year": 1975,
   "similarity": 0.447
  },
  {
   "key": "tmdb:24657",
   "workId": "f-tmdb24657",
   "title": "Жертвоприношение",
   "year": 1986,
   "similarity": 0.424
  },
  {
   "key": "tmdb:8741",
   "workId": "f-tmdb8741",
   "title": "Тонкая красная линия",
   "year": 1998,
   "similarity": 0.421
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.403
  }
 ],
 "tmdb:90": [
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.653
  },
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.529
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.504
  },
  {
   "key": "tmdb:36955",
   "workId": "f-tmdb36955",
   "title": "Правдивая ложь",
   "year": 1994,
   "similarity": 0.483
  },
  {
   "key": "tmdb:562",
   "workId": "f-tmdb562",
   "title": "Крепкий орешек",
   "year": 1988,
   "similarity": 0.481
  }
 ],
 "tmdb:900": [
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.544
  },
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.543
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.541
  },
  {
   "key": "tmdb:3529",
   "workId": "f-tmdb3529",
   "title": "Тонкий человек",
   "year": 1934,
   "similarity": 0.486
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.484
  }
 ],
 "tmdb:9008": [
  {
   "key": "tmdb:891",
   "workId": "f-tmdb891",
   "title": "Вся президентская рать",
   "year": 1976,
   "similarity": 0.588
  },
  {
   "key": "tmdb:820",
   "workId": "f-tmdb820",
   "title": "Джон Ф. Кеннеди: Выстрелы в Далласе",
   "year": 1991,
   "similarity": 0.442
  },
  {
   "key": "tmdb:68734",
   "workId": "f-tmdb68734",
   "title": "Операция «Арго»",
   "year": 2012,
   "similarity": 0.439
  },
  {
   "key": "tmdb:1632",
   "workId": "c-burning",
   "title": "Пылающий",
   "year": 2018,
   "similarity": 0.427
  },
  {
   "key": "tmdb:4982",
   "workId": "f-tmdb4982",
   "title": "Гангстер",
   "year": 2007,
   "similarity": 0.401
  }
 ],
 "tmdb:901": [
  {
   "key": "tmdb:3082",
   "workId": "f-tmdb3082",
   "title": "Новые времена",
   "year": 1936,
   "similarity": 0.598
  },
  {
   "key": "tmdb:962",
   "workId": "f-tmdb962",
   "title": "Золотая лихорадка",
   "year": 1925,
   "similarity": 0.527
  },
  {
   "key": "tmdb:961",
   "workId": "f-tmdb961",
   "title": "Паровоз Генерал",
   "year": 1926,
   "similarity": 0.513
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.452
  },
  {
   "key": "tmdb:25768",
   "workId": "f-tmdb25768",
   "title": "Пароходный Билл",
   "year": 1928,
   "similarity": 0.44
  }
 ],
 "tmdb:902": [
  {
   "key": "tmdb:892",
   "workId": "f-tmdb892",
   "title": "Деликатесы",
   "year": 1991,
   "similarity": 0.549
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.477
  },
  {
   "key": "tmdb:2668",
   "workId": "l-tmdb2668",
   "title": "Сонная лощина",
   "year": 1999,
   "similarity": 0.353
  },
  {
   "key": "tmdb:144",
   "workId": "f-tmdb144",
   "title": "Небо над Берлином",
   "year": 1987,
   "similarity": 0.296
  },
  {
   "key": "tmdb:63",
   "workId": "f-tmdb63",
   "title": "12 обезьян",
   "year": 1995,
   "similarity": 0.272
  }
 ],
 "tmdb:903": [
  {
   "key": "tmdb:33",
   "workId": "f-tmdb33",
   "title": "Непрощённый",
   "year": 1992,
   "similarity": 0.426
  },
  {
   "key": "tmdb:642",
   "workId": "f-tmdb642",
   "title": "Буч Кэссиди и Сандэнс Кид",
   "year": 1969,
   "similarity": 0.425
  },
  {
   "key": "tmdb:1578",
   "workId": "f-tmdb1578",
   "title": "Бешеный бык",
   "year": 1980,
   "similarity": 0.423
  },
  {
   "key": "tmdb:288",
   "workId": "f-tmdb288",
   "title": "Ровно в полдень",
   "year": 1952,
   "similarity": 0.403
  },
  {
   "key": "tmdb:475",
   "workId": "f-tmdb475",
   "title": "Бонни и Клайд",
   "year": 1967,
   "similarity": 0.391
  }
 ],
 "tmdb:9071": [
  {
   "key": "tmdb:11300",
   "workId": "f-tmdb11300",
   "title": "Дикая штучка",
   "year": 1986,
   "similarity": 0.297
  },
  {
   "key": "tmdb:12626",
   "workId": "f-tmdb12626",
   "title": "Теленовости",
   "year": 1987,
   "similarity": 0.289
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.286
  },
  {
   "key": "tmdb:13891",
   "workId": "f-tmdb13891",
   "title": "Гражданка Рут",
   "year": 1996,
   "similarity": 0.274
  },
  {
   "key": "tmdb:10403",
   "workId": "f-tmdb10403",
   "title": "Игрок",
   "year": 1992,
   "similarity": 0.27
  }
 ],
 "tmdb:9081": [
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.527
  },
  {
   "key": "tmdb:3509",
   "workId": "f-tmdb3509",
   "title": "Помутнение",
   "year": 2006,
   "similarity": 0.507
  },
  {
   "key": "tmdb:1382",
   "workId": "f-tmdb1382",
   "title": "Я и ты и все, кого мы знаем",
   "year": 2005,
   "similarity": 0.448
  },
  {
   "key": "tmdb:8066",
   "workId": "l-tmdb8066",
   "title": "Останься",
   "year": 2005,
   "similarity": 0.404
  },
  {
   "key": "tmdb:38",
   "workId": "f-tmdb38",
   "title": "Вечное сияние чистого разума",
   "year": 2004,
   "similarity": 0.365
  }
 ],
 "tmdb:909": [
  {
   "key": "tmdb:1585",
   "workId": "f-tmdb1585",
   "title": "Эта замечательная жизнь",
   "year": 1946,
   "similarity": 0.606
  },
  {
   "key": "tmdb:3080",
   "workId": "f-tmdb3080",
   "title": "Цилиндр",
   "year": 1935,
   "similarity": 0.485
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.46
  },
  {
   "key": "tmdb:872",
   "workId": "f-tmdb872",
   "title": "Поющие под дождём",
   "year": 1952,
   "similarity": 0.454
  },
  {
   "key": "tmdb:20325",
   "workId": "f-tmdb20325",
   "title": "Время свинга",
   "year": 1936,
   "similarity": 0.45
  }
 ],
 "tmdb:910": [
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.715
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.685
  },
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.597
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.585
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.548
  }
 ],
 "tmdb:914": [
  {
   "key": "tmdb:3082",
   "workId": "f-tmdb3082",
   "title": "Новые времена",
   "year": 1936,
   "similarity": 0.51
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.504
  },
  {
   "key": "tmdb:424",
   "workId": "f-tmdb424",
   "title": "Список Шиндлера",
   "year": 1993,
   "similarity": 0.475
  },
  {
   "key": "tmdb:637",
   "workId": "f-tmdb637",
   "title": "Жизнь прекрасна",
   "year": 1997,
   "similarity": 0.472
  },
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.452
  }
 ],
 "tmdb:923": [
  {
   "key": "tmdb:10331",
   "workId": "f-tmdb10331",
   "title": "Ночь живых мертвецов",
   "year": 1968,
   "similarity": 0.803
  },
  {
   "key": "tmdb:17814",
   "workId": "f-tmdb17814",
   "title": "Нападение на 13-й участок",
   "year": 1976,
   "similarity": 0.459
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.449
  },
  {
   "key": "tmdb:22970",
   "workId": "l-tmdb22970",
   "title": "Хижина в лесу",
   "year": 2012,
   "similarity": 0.413
  },
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.391
  }
 ],
 "tmdb:9270": [
  {
   "key": "tmdb:9571",
   "workId": "f-tmdb9571",
   "title": "Под кайфом и в смятении",
   "year": 1993,
   "similarity": 0.402
  },
  {
   "key": "tmdb:10778",
   "workId": "f-tmdb10778",
   "title": "Человек, которого не было",
   "year": 2001,
   "similarity": 0.373
  },
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.352
  },
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.321
  },
  {
   "key": "tmdb:141",
   "workId": "f-tmdb141",
   "title": "Донни Дарко",
   "year": 2001,
   "similarity": 0.3
  }
 ],
 "tmdb:9281": [
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.41
  },
  {
   "key": "tmdb:158011",
   "workId": "u-kp674295",
   "title": "Тревожный вызов",
   "year": 2013,
   "similarity": 0.39
  },
  {
   "key": "tmdb:49527",
   "workId": "u-kp493222",
   "title": "На грани",
   "year": 2012,
   "similarity": 0.381
  },
  {
   "key": "tmdb:10998",
   "workId": "f-tmdb10998",
   "title": "Роковое влечение",
   "year": 1987,
   "similarity": 0.366
  },
  {
   "key": "tmdb:462",
   "workId": "f-tmdb462",
   "title": "Эрин Брокович",
   "year": 2000,
   "similarity": 0.361
  }
 ],
 "tmdb:93": [
  {
   "key": "tmdb:37257",
   "workId": "f-tmdb37257",
   "title": "Свидетель обвинения",
   "year": 1957,
   "similarity": 0.585
  },
  {
   "key": "tmdb:845",
   "workId": "f-tmdb845",
   "title": "Незнакомцы в поезде",
   "year": 1951,
   "similarity": 0.474
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.457
  },
  {
   "key": "tmdb:891",
   "workId": "f-tmdb891",
   "title": "Вся президентская рать",
   "year": 1976,
   "similarity": 0.435
  },
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.4
  }
 ],
 "tmdb:9301": [
  {
   "key": "tmdb:11986",
   "workId": "f-tmdb11986",
   "title": "Тридцать семь и два по утрам",
   "year": 1986,
   "similarity": 0.355
  },
  {
   "key": "tmdb:103328",
   "workId": "f-tmdb103328",
   "title": "Корпорация «Святые моторы»",
   "year": 2012,
   "similarity": 0.341
  },
  {
   "key": "tmdb:8051",
   "workId": "f-tmdb8051",
   "title": "Любовь, сбивающая с ног",
   "year": 2002,
   "similarity": 0.309
  },
  {
   "key": "tmdb:5910",
   "workId": "f-tmdb5910",
   "title": "Фейерверк",
   "year": 1997,
   "similarity": 0.298
  },
  {
   "key": "tmdb:86825",
   "workId": "f-tmdb86825",
   "title": "Порочные игры",
   "year": 2013,
   "similarity": 0.295
  }
 ],
 "tmdb:931": [
  {
   "key": "tmdb:11167",
   "workId": "f-tmdb11167",
   "title": "Подглядывающий",
   "year": 1960,
   "similarity": 0.533
  },
  {
   "key": "tmdb:20126",
   "workId": "f-tmdb20126",
   "title": "Кроваво-красное",
   "year": 1975,
   "similarity": 0.516
  },
  {
   "key": "tmdb:11906",
   "workId": "f-tmdb11906",
   "title": "Суспирия",
   "year": 1977,
   "similarity": 0.493
  },
  {
   "key": "tmdb:30959",
   "workId": "f-tmdb30959",
   "title": "Кайдан",
   "year": 1965,
   "similarity": 0.47
  },
  {
   "key": "tmdb:1730",
   "workId": "f-tmdb1730",
   "title": "Внутренняя империя",
   "year": 2006,
   "similarity": 0.469
  }
 ],
 "tmdb:9322": [
  {
   "key": "tmdb:26039",
   "workId": "f-tmdb26039",
   "title": "В упор",
   "year": 1967,
   "similarity": 0.342
  },
  {
   "key": "tmdb:1051",
   "workId": "f-tmdb1051",
   "title": "Французский связной",
   "year": 1971,
   "similarity": 0.291
  },
  {
   "key": "tmdb:1538",
   "workId": "f-tmdb1538",
   "title": "Соучастник",
   "year": 2004,
   "similarity": 0.29
  },
  {
   "key": "tmdb:11878",
   "workId": "f-tmdb11878",
   "title": "Телохранитель",
   "year": 1961,
   "similarity": 0.281
  },
  {
   "key": "tmdb:10795",
   "workId": "u-kp22936",
   "title": "Не говори никому",
   "year": 2006,
   "similarity": 0.257
  }
 ],
 "tmdb:934": [
  {
   "key": "tmdb:1818",
   "workId": "f-tmdb1818",
   "title": "Стреляйте в пианиста",
   "year": 1960,
   "similarity": 0.518
  },
  {
   "key": "tmdb:15794",
   "workId": "f-tmdb15794",
   "title": "Белая горячка",
   "year": 1949,
   "similarity": 0.514
  },
  {
   "key": "tmdb:12493",
   "workId": "f-tmdb12493",
   "title": "Рай и ад",
   "year": 1963,
   "similarity": 0.504
  },
  {
   "key": "tmdb:8073",
   "workId": "f-tmdb8073",
   "title": "Банда аутсайдеров",
   "year": 1964,
   "similarity": 0.49
  },
  {
   "key": "tmdb:269",
   "workId": "f-tmdb269",
   "title": "На последнем дыхании",
   "year": 1960,
   "similarity": 0.457
  }
 ],
 "tmdb:9343": [
  {
   "key": "tmdb:2000",
   "workId": "f-tmdb2000",
   "title": "Агирре, гнев божий",
   "year": 1972,
   "similarity": 0.379
  },
  {
   "key": "tmdb:642",
   "workId": "f-tmdb642",
   "title": "Буч Кэссиди и Сандэнс Кид",
   "year": 1969,
   "similarity": 0.326
  },
  {
   "key": "tmdb:11698",
   "workId": "f-tmdb11698",
   "title": "Строшек",
   "year": 1977,
   "similarity": 0.296
  },
  {
   "key": "tmdb:1444",
   "workId": "f-tmdb1444",
   "title": "Июньский жук",
   "year": 2005,
   "similarity": 0.294
  },
  {
   "key": "tmdb:1653",
   "workId": "f-tmdb1653",
   "title": "Дневники мотоциклиста",
   "year": 2004,
   "similarity": 0.254
  }
 ],
 "tmdb:935": [
  {
   "key": "tmdb:10774",
   "workId": "f-tmdb10774",
   "title": "Телесеть",
   "year": 1976,
   "similarity": 0.424
  },
  {
   "key": "tmdb:914",
   "workId": "f-tmdb914",
   "title": "Великий диктатор",
   "year": 1940,
   "similarity": 0.421
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.41
  },
  {
   "key": "tmdb:982",
   "workId": "f-tmdb982",
   "title": "Маньчжурский кандидат",
   "year": 1962,
   "similarity": 0.396
  },
  {
   "key": "tmdb:975",
   "workId": "f-tmdb975",
   "title": "Тропы славы",
   "year": 1957,
   "similarity": 0.383
  }
 ],
 "tmdb:9377": [
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.607
  },
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.587
  },
  {
   "key": "tmdb:105",
   "workId": "f-tmdb105",
   "title": "Назад в будущее",
   "year": 1985,
   "similarity": 0.528
  },
  {
   "key": "tmdb:235",
   "workId": "f-tmdb235",
   "title": "Останься со мной",
   "year": 1986,
   "similarity": 0.5
  },
  {
   "key": "tmdb:15144",
   "workId": "f-tmdb15144",
   "title": "Шестнадцать свечей",
   "year": 1984,
   "similarity": 0.499
  }
 ],
 "tmdb:9388": [
  {
   "key": "tmdb:10774",
   "workId": "f-tmdb10774",
   "title": "Телесеть",
   "year": 1976,
   "similarity": 0.382
  },
  {
   "key": "tmdb:10673",
   "workId": "f-tmdb10673",
   "title": "Уолл-стрит",
   "year": 1987,
   "similarity": 0.375
  },
  {
   "key": "tmdb:106646",
   "workId": "f-tmdb106646",
   "title": "Волк с Уолл-стрит",
   "year": 2013,
   "similarity": 0.369
  },
  {
   "key": "tmdb:550",
   "workId": "u-kp361",
   "title": "Бойцовский клуб",
   "year": 1999,
   "similarity": 0.364
  },
  {
   "key": "tmdb:13223",
   "workId": "f-tmdb13223",
   "title": "Гран Торино",
   "year": 2008,
   "similarity": 0.363
  }
 ],
 "tmdb:939": [
  {
   "key": "tmdb:11009",
   "workId": "f-tmdb11009",
   "title": "Лихорадка субботнего вечера",
   "year": 1977,
   "similarity": 0.438
  },
  {
   "key": "tmdb:2321",
   "workId": "f-tmdb2321",
   "title": "Замужем за мафией",
   "year": 1988,
   "similarity": 0.397
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.392
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.369
  },
  {
   "key": "tmdb:618",
   "workId": "f-tmdb618",
   "title": "Рождение нации",
   "year": 1915,
   "similarity": 0.366
  }
 ],
 "tmdb:941": [
  {
   "key": "tmdb:562",
   "workId": "f-tmdb562",
   "title": "Крепкий орешек",
   "year": 1988,
   "similarity": 0.719
  },
  {
   "key": "tmdb:90",
   "workId": "f-tmdb90",
   "title": "Полицейский из Беверли-Хиллз",
   "year": 1984,
   "similarity": 0.653
  },
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.604
  },
  {
   "key": "tmdb:56292",
   "workId": "f-tmdb56292",
   "title": "Миссия невыполнима: Протокол Фантом",
   "year": 2011,
   "similarity": 0.556
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.549
  }
 ],
 "tmdb:9426": [
  {
   "key": "tmdb:1091",
   "workId": "f-tmdb1091",
   "title": "Нечто",
   "year": 1982,
   "similarity": 0.631
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.456
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.438
  },
  {
   "key": "tmdb:948",
   "workId": "f-tmdb948",
   "title": "Хэллоуин",
   "year": 1978,
   "similarity": 0.434
  },
  {
   "key": "tmdb:11549",
   "workId": "f-tmdb11549",
   "title": "Вторжение похитителей тел",
   "year": 1956,
   "similarity": 0.434
  }
 ],
 "tmdb:9451": [
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.502
  },
  {
   "key": "tmdb:68924",
   "workId": "f-tmdb68924",
   "title": "Ледяной ветер",
   "year": 1997,
   "similarity": 0.415
  },
  {
   "key": "tmdb:9571",
   "workId": "f-tmdb9571",
   "title": "Под кайфом и в смятении",
   "year": 1993,
   "similarity": 0.369
  },
  {
   "key": "tmdb:44754",
   "workId": "f-tmdb44754",
   "title": "Маргарет",
   "year": 2011,
   "similarity": 0.367
  },
  {
   "key": "tmdb:11446",
   "workId": "f-tmdb11446",
   "title": "Добро пожаловать в кукольный дом",
   "year": 1996,
   "similarity": 0.349
  }
 ],
 "tmdb:948": [
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.756
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.639
  },
  {
   "key": "tmdb:9529",
   "workId": "l-tmdb9529",
   "title": "Кэндимэн",
   "year": 1992,
   "similarity": 0.554
  },
  {
   "key": "tmdb:7340",
   "workId": "f-tmdb7340",
   "title": "Кэрри",
   "year": 1976,
   "similarity": 0.509
  },
  {
   "key": "tmdb:9552",
   "workId": "f-tmdb9552",
   "title": "Изгоняющий дьявола",
   "year": 1973,
   "similarity": 0.479
  }
 ],
 "tmdb:949": [
  {
   "key": "tmdb:23168",
   "workId": "f-tmdb23168",
   "title": "Город воров",
   "year": 2010,
   "similarity": 0.477
  },
  {
   "key": "tmdb:1538",
   "workId": "f-tmdb1538",
   "title": "Соучастник",
   "year": 2004,
   "similarity": 0.425
  },
  {
   "key": "tmdb:1051",
   "workId": "f-tmdb1051",
   "title": "Французский связной",
   "year": 1971,
   "similarity": 0.411
  },
  {
   "key": "tmdb:2118",
   "workId": "f-tmdb2118",
   "title": "Секреты Лос-Анджелеса",
   "year": 1997,
   "similarity": 0.373
  },
  {
   "key": "tmdb:524",
   "workId": "f-tmdb524",
   "title": "Казино",
   "year": 1995,
   "similarity": 0.372
  }
 ],
 "tmdb:9495": [
  {
   "key": "tmdb:1487",
   "workId": "f-tmdb1487",
   "title": "Хеллбой: Герой из пекла",
   "year": 2004,
   "similarity": 0.56
  },
  {
   "key": "tmdb:2668",
   "workId": "l-tmdb2668",
   "title": "Сонная лощина",
   "year": 1999,
   "similarity": 0.479
  },
  {
   "key": "tmdb:272",
   "workId": "f-tmdb272",
   "title": "Бэтмен: Начало",
   "year": 2005,
   "similarity": 0.454
  },
  {
   "key": "tmdb:13183",
   "workId": "f-tmdb13183",
   "title": "Хранители",
   "year": 2009,
   "similarity": 0.443
  },
  {
   "key": "tmdb:36658",
   "workId": "f-tmdb36658",
   "title": "Люди Икс 2",
   "year": 2003,
   "similarity": 0.415
  }
 ],
 "tmdb:95": [
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.742
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.61
  },
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.585
  },
  {
   "key": "tmdb:744",
   "workId": "f-tmdb744",
   "title": "Лучший стрелок",
   "year": 1986,
   "similarity": 0.53
  },
  {
   "key": "tmdb:9802",
   "workId": "f-tmdb9802",
   "title": "Скала",
   "year": 1996,
   "similarity": 0.508
  }
 ],
 "tmdb:9529": [
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.64
  },
  {
   "key": "tmdb:30497",
   "workId": "f-tmdb30497",
   "title": "Техасская резня бензопилой",
   "year": 1974,
   "similarity": 0.583
  },
  {
   "key": "tmdb:948",
   "workId": "f-tmdb948",
   "title": "Хэллоуин",
   "year": 1978,
   "similarity": 0.554
  },
  {
   "key": "tmdb:15516",
   "workId": "f-tmdb15516",
   "title": "Последний дом слева",
   "year": 1972,
   "similarity": 0.532
  },
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.519
  }
 ],
 "tmdb:9538": [
  {
   "key": "tmdb:837",
   "workId": "f-tmdb837",
   "title": "Видеодром",
   "year": 1983,
   "similarity": 0.532
  },
  {
   "key": "tmdb:12262",
   "workId": "f-tmdb12262",
   "title": "У холмов есть глаза",
   "year": 1977,
   "similarity": 0.526
  },
  {
   "key": "tmdb:27327",
   "workId": "f-tmdb27327",
   "title": "Призрак рая",
   "year": 1974,
   "similarity": 0.502
  },
  {
   "key": "tmdb:74725",
   "workId": "c-kill-list",
   "title": "Список смертников",
   "year": 2011,
   "similarity": 0.497
  },
  {
   "key": "tmdb:26517",
   "workId": "f-tmdb26517",
   "title": "Мартин",
   "year": 1978,
   "similarity": 0.494
  }
 ],
 "tmdb:9540": [
  {
   "key": "tmdb:17609",
   "workId": "f-tmdb17609",
   "title": "Антихрист",
   "year": 2009,
   "similarity": 0.489
  },
  {
   "key": "tmdb:837",
   "workId": "f-tmdb837",
   "title": "Видеодром",
   "year": 1983,
   "similarity": 0.479
  },
  {
   "key": "tmdb:11167",
   "workId": "f-tmdb11167",
   "title": "Подглядывающий",
   "year": 1960,
   "similarity": 0.466
  },
  {
   "key": "tmdb:931",
   "workId": "u-kp6268",
   "title": "А теперь не смотри",
   "year": 1973,
   "similarity": 0.461
  },
  {
   "key": "tmdb:9538",
   "workId": "f-tmdb9538",
   "title": "Сканнеры",
   "year": 1981,
   "similarity": 0.439
  }
 ],
 "tmdb:9552": [
  {
   "key": "tmdb:7340",
   "workId": "f-tmdb7340",
   "title": "Кэрри",
   "year": 1976,
   "similarity": 0.519
  },
  {
   "key": "tmdb:805",
   "workId": "f-tmdb805",
   "title": "Ребёнок Розмари",
   "year": 1968,
   "similarity": 0.495
  },
  {
   "key": "tmdb:948",
   "workId": "f-tmdb948",
   "title": "Хэллоуин",
   "year": 1978,
   "similarity": 0.479
  },
  {
   "key": "tmdb:4488",
   "workId": "f-tmdb4488",
   "title": "Пятница 13",
   "year": 1980,
   "similarity": 0.414
  },
  {
   "key": "tmdb:11051",
   "workId": "f-tmdb11051",
   "title": "Последнее искушение Христа",
   "year": 1988,
   "similarity": 0.405
  }
 ],
 "tmdb:9571": [
  {
   "key": "tmdb:2108",
   "workId": "f-tmdb2108",
   "title": "Клуб «Завтрак»",
   "year": 1985,
   "similarity": 0.606
  },
  {
   "key": "tmdb:15144",
   "workId": "f-tmdb15144",
   "title": "Шестнадцать свечей",
   "year": 1984,
   "similarity": 0.482
  },
  {
   "key": "tmdb:9377",
   "workId": "f-tmdb9377",
   "title": "Выходной день Ферриса Бьюллера",
   "year": 1986,
   "similarity": 0.434
  },
  {
   "key": "tmdb:157386",
   "workId": "f-tmdb157386",
   "title": "Захватывающее время",
   "year": 2013,
   "similarity": 0.43
  },
  {
   "key": "tmdb:2028",
   "workId": "f-tmdb2028",
   "title": "Скажи что-нибудь",
   "year": 1989,
   "similarity": 0.421
  }
 ],
 "tmdb:9576": [
  {
   "key": "tmdb:31225",
   "workId": "f-tmdb31225",
   "title": "Париж в огне",
   "year": 1991,
   "similarity": 0.533
  },
  {
   "key": "tmdb:639",
   "workId": "f-tmdb639",
   "title": "Когда Гарри встретил Салли",
   "year": 1989,
   "similarity": 0.509
  },
  {
   "key": "tmdb:12626",
   "workId": "f-tmdb12626",
   "title": "Теленовости",
   "year": 1987,
   "similarity": 0.475
  },
  {
   "key": "tmdb:31121",
   "workId": "f-tmdb31121",
   "title": "Шампунь",
   "year": 1975,
   "similarity": 0.466
  },
  {
   "key": "tmdb:11239",
   "workId": "f-tmdb11239",
   "title": "Давайте потанцуем?",
   "year": 1996,
   "similarity": 0.45
  }
 ],
 "tmdb:9593": [
  {
   "key": "tmdb:38319",
   "workId": "l-tmdb38319",
   "title": "Храбрые перцем",
   "year": 2011,
   "similarity": 0.575
  },
  {
   "key": "tmdb:36955",
   "workId": "f-tmdb36955",
   "title": "Правдивая ложь",
   "year": 1994,
   "similarity": 0.547
  },
  {
   "key": "tmdb:607",
   "workId": "f-tmdb607",
   "title": "Люди в чёрном",
   "year": 1997,
   "similarity": 0.486
  },
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.467
  },
  {
   "key": "tmdb:11702",
   "workId": "f-tmdb11702",
   "title": "Убийцы на замену",
   "year": 1998,
   "similarity": 0.465
  }
 ],
 "tmdb:961": [
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.525
  },
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.513
  },
  {
   "key": "tmdb:992",
   "workId": "f-tmdb992",
   "title": "Шерлок младший",
   "year": 1924,
   "similarity": 0.484
  },
  {
   "key": "tmdb:962",
   "workId": "f-tmdb962",
   "title": "Золотая лихорадка",
   "year": 1925,
   "similarity": 0.425
  },
  {
   "key": "tmdb:3082",
   "workId": "f-tmdb3082",
   "title": "Новые времена",
   "year": 1936,
   "similarity": 0.422
  }
 ],
 "tmdb:962": [
  {
   "key": "tmdb:901",
   "workId": "f-tmdb901",
   "title": "Огни большого города",
   "year": 1931,
   "similarity": 0.527
  },
  {
   "key": "tmdb:25768",
   "workId": "f-tmdb25768",
   "title": "Пароходный Билл",
   "year": 1928,
   "similarity": 0.525
  },
  {
   "key": "tmdb:3082",
   "workId": "f-tmdb3082",
   "title": "Новые времена",
   "year": 1936,
   "similarity": 0.499
  },
  {
   "key": "tmdb:10098",
   "workId": "f-tmdb10098",
   "title": "Малыш",
   "year": 1921,
   "similarity": 0.48
  },
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.448
  }
 ],
 "tmdb:963": [
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.715
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.65
  },
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.584
  },
  {
   "key": "tmdb:426",
   "workId": "f-tmdb426",
   "title": "Головокружение",
   "year": 1958,
   "similarity": 0.582
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.581
  }
 ],
 "tmdb:9675": [
  {
   "key": "tmdb:2755",
   "workId": "f-tmdb2755",
   "title": "О Шмидте",
   "year": 2002,
   "similarity": 0.525
  },
  {
   "key": "tmdb:10707",
   "workId": "f-tmdb10707",
   "title": "Кальмар и кит",
   "year": 2005,
   "similarity": 0.421
  },
  {
   "key": "tmdb:68924",
   "workId": "f-tmdb68924",
   "title": "Ледяной ветер",
   "year": 1997,
   "similarity": 0.405
  },
  {
   "key": "tmdb:8272",
   "workId": "f-tmdb8272",
   "title": "Дикари",
   "year": 2007,
   "similarity": 0.373
  },
  {
   "key": "tmdb:153",
   "workId": "f-tmdb153",
   "title": "Трудности перевода",
   "year": 2003,
   "similarity": 0.37
  }
 ],
 "tmdb:968": [
  {
   "key": "tmdb:769",
   "workId": "f-tmdb769",
   "title": "Славные парни",
   "year": 1990,
   "similarity": 0.486
  },
  {
   "key": "tmdb:15794",
   "workId": "f-tmdb15794",
   "title": "Белая горячка",
   "year": 1949,
   "similarity": 0.41
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.362
  },
  {
   "key": "tmdb:103",
   "workId": "f-tmdb103",
   "title": "Таксист",
   "year": 1976,
   "similarity": 0.359
  },
  {
   "key": "tmdb:203",
   "workId": "f-tmdb203",
   "title": "Злые улицы",
   "year": 1973,
   "similarity": 0.359
  }
 ],
 "tmdb:9693": [
  {
   "key": "tmdb:17431",
   "workId": "l-tmdb17431",
   "title": "Луна 2112",
   "year": 2009,
   "similarity": 0.468
  },
  {
   "key": "tmdb:78",
   "workId": "f-tmdb78",
   "title": "Бегущий по лезвию",
   "year": 1982,
   "similarity": 0.4
  },
  {
   "key": "tmdb:2666",
   "workId": "f-tmdb2666",
   "title": "Тёмный город",
   "year": 1998,
   "similarity": 0.377
  },
  {
   "key": "tmdb:63",
   "workId": "f-tmdb63",
   "title": "12 обезьян",
   "year": 1995,
   "similarity": 0.352
  },
  {
   "key": "tmdb:782",
   "workId": "u-kp5012",
   "title": "Гаттака",
   "year": 1997,
   "similarity": 0.337
  }
 ],
 "tmdb:97367": [
  {
   "key": "tmdb:23168",
   "workId": "f-tmdb23168",
   "title": "Город воров",
   "year": 2010,
   "similarity": 0.37
  },
  {
   "key": "tmdb:949",
   "workId": "f-tmdb949",
   "title": "Схватка",
   "year": 1995,
   "similarity": 0.319
  },
  {
   "key": "tmdb:73567",
   "workId": "u-kp568374",
   "title": "Киллер Джо",
   "year": 2011,
   "similarity": 0.312
  },
  {
   "key": "tmdb:1051",
   "workId": "f-tmdb1051",
   "title": "Французский связной",
   "year": 1971,
   "similarity": 0.294
  },
  {
   "key": "tmdb:8052",
   "workId": "f-tmdb8052",
   "title": "Роковая восьмерка",
   "year": 1997,
   "similarity": 0.281
  }
 ],
 "tmdb:975": [
  {
   "key": "tmdb:143",
   "workId": "f-tmdb143",
   "title": "На западном фронте без перемен",
   "year": 1930,
   "similarity": 0.554
  },
  {
   "key": "tmdb:17295",
   "workId": "f-tmdb17295",
   "title": "Битва за Алжир",
   "year": 1966,
   "similarity": 0.499
  },
  {
   "key": "tmdb:12698",
   "workId": "f-tmdb12698",
   "title": "Туман войны: одиннадцать уроков из жизни Роберта С. МакНамары",
   "year": 2003,
   "similarity": 0.454
  },
  {
   "key": "tmdb:832",
   "workId": "f-tmdb832",
   "title": "М убийца",
   "year": 1931,
   "similarity": 0.413
  },
  {
   "key": "tmdb:792",
   "workId": "f-tmdb792",
   "title": "Взвод",
   "year": 1986,
   "similarity": 0.412
  }
 ],
 "tmdb:976": [
  {
   "key": "tmdb:678",
   "workId": "f-tmdb678",
   "title": "Из прошлого",
   "year": 1947,
   "similarity": 0.543
  },
  {
   "key": "tmdb:1480",
   "workId": "f-tmdb1480",
   "title": "Печать зла",
   "year": 1958,
   "similarity": 0.469
  },
  {
   "key": "tmdb:17057",
   "workId": "f-tmdb17057",
   "title": "В укромном месте",
   "year": 1950,
   "similarity": 0.465
  },
  {
   "key": "tmdb:1092",
   "workId": "f-tmdb1092",
   "title": "Третий человек",
   "year": 1949,
   "similarity": 0.44
  },
  {
   "key": "tmdb:934",
   "workId": "f-tmdb934",
   "title": "Мужские разборки",
   "year": 1955,
   "similarity": 0.435
  }
 ],
 "tmdb:97630": [
  {
   "key": "tmdb:12162",
   "workId": "f-tmdb12162",
   "title": "Повелитель бури",
   "year": 2008,
   "similarity": 0.574
  },
  {
   "key": "tmdb:9829",
   "workId": "f-tmdb9829",
   "title": "Потерянный рейс",
   "year": 2006,
   "similarity": 0.556
  },
  {
   "key": "tmdb:855",
   "workId": "f-tmdb855",
   "title": "Чёрный ястреб",
   "year": 2001,
   "similarity": 0.482
  },
  {
   "key": "tmdb:1372",
   "workId": "f-tmdb1372",
   "title": "Кровавый алмаз",
   "year": 2006,
   "similarity": 0.439
  },
  {
   "key": "tmdb:625",
   "workId": "f-tmdb625",
   "title": "Поля смерти",
   "year": 1984,
   "similarity": 0.372
  }
 ],
 "tmdb:9764": [
  {
   "key": "tmdb:669",
   "workId": "f-tmdb669",
   "title": "Нанук с Севера",
   "year": 1922,
   "similarity": 0.458
  },
  {
   "key": "tmdb:42113",
   "workId": "f-tmdb42113",
   "title": "Легенда о Нараяме",
   "year": 1983,
   "similarity": 0.456
  },
  {
   "key": "tmdb:1398",
   "workId": "l-tmdb1398",
   "title": "Сталкер",
   "year": 1979,
   "similarity": 0.415
  },
  {
   "key": "tmdb:5801",
   "workId": "f-tmdb5801",
   "title": "Песнь дороги",
   "year": 1955,
   "similarity": 0.404
  },
  {
   "key": "tmdb:5991",
   "workId": "f-tmdb5991",
   "title": "Последний человек",
   "year": 1924,
   "similarity": 0.396
  }
 ],
 "tmdb:98": [
  {
   "key": "tmdb:616",
   "workId": "f-tmdb616",
   "title": "Последний самурай",
   "year": 2003,
   "similarity": 0.475
  },
  {
   "key": "tmdb:857",
   "workId": "f-tmdb857",
   "title": "Спасти рядового Райана",
   "year": 1998,
   "similarity": 0.473
  },
  {
   "key": "tmdb:1271",
   "workId": "f-tmdb1271",
   "title": "300 спартанцев",
   "year": 2007,
   "similarity": 0.394
  },
  {
   "key": "tmdb:562",
   "workId": "f-tmdb562",
   "title": "Крепкий орешек",
   "year": 1988,
   "similarity": 0.366
  },
  {
   "key": "tmdb:68718",
   "workId": "f-tmdb68718",
   "title": "Джанго освобождённый",
   "year": 2012,
   "similarity": 0.365
  }
 ],
 "tmdb:9800": [
  {
   "key": "tmdb:462",
   "workId": "f-tmdb462",
   "title": "Эрин Брокович",
   "year": 2000,
   "similarity": 0.472
  },
  {
   "key": "tmdb:11050",
   "workId": "f-tmdb11050",
   "title": "Язык нежности",
   "year": 1983,
   "similarity": 0.405
  },
  {
   "key": "tmdb:497",
   "workId": "f-tmdb497",
   "title": "Зелёная миля",
   "year": 1999,
   "similarity": 0.395
  },
  {
   "key": "tmdb:873",
   "workId": "f-tmdb873",
   "title": "Цветы лиловые полей",
   "year": 1985,
   "similarity": 0.389
  },
  {
   "key": "tmdb:31225",
   "workId": "f-tmdb31225",
   "title": "Париж в огне",
   "year": 1991,
   "similarity": 0.389
  }
 ],
 "tmdb:9802": [
  {
   "key": "tmdb:1701",
   "workId": "f-tmdb1701",
   "title": "Воздушная тюрьма",
   "year": 1997,
   "similarity": 0.691
  },
  {
   "key": "tmdb:1637",
   "workId": "f-tmdb1637",
   "title": "Скорость",
   "year": 1994,
   "similarity": 0.62
  },
  {
   "key": "tmdb:602",
   "workId": "f-tmdb602",
   "title": "День независимости",
   "year": 1996,
   "similarity": 0.575
  },
  {
   "key": "tmdb:36955",
   "workId": "f-tmdb36955",
   "title": "Правдивая ложь",
   "year": 1994,
   "similarity": 0.535
  },
  {
   "key": "tmdb:941",
   "workId": "f-tmdb941",
   "title": "Смертельное оружие",
   "year": 1987,
   "similarity": 0.509
  }
 ],
 "tmdb:981": [
  {
   "key": "tmdb:3078",
   "workId": "f-tmdb3078",
   "title": "Это случилось однажды ночью",
   "year": 1934,
   "similarity": 0.553
  },
  {
   "key": "tmdb:3086",
   "workId": "f-tmdb3086",
   "title": "Леди Ева",
   "year": 1941,
   "similarity": 0.513
  },
  {
   "key": "tmdb:804",
   "workId": "f-tmdb804",
   "title": "Римские каникулы",
   "year": 1953,
   "similarity": 0.486
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.477
  },
  {
   "key": "tmdb:284",
   "workId": "f-tmdb284",
   "title": "Квартира",
   "year": 1960,
   "similarity": 0.475
  }
 ],
 "tmdb:982": [
  {
   "key": "tmdb:891",
   "workId": "f-tmdb891",
   "title": "Вся президентская рать",
   "year": 1976,
   "similarity": 0.461
  },
  {
   "key": "tmdb:213",
   "workId": "f-tmdb213",
   "title": "На север через северо-запад",
   "year": 1959,
   "similarity": 0.423
  },
  {
   "key": "tmdb:592",
   "workId": "f-tmdb592",
   "title": "Разговор",
   "year": 1974,
   "similarity": 0.404
  },
  {
   "key": "tmdb:935",
   "workId": "f-tmdb935",
   "title": "Доктор Стрейнджлав, или Как я научился не волноваться и полюбил атомную бомбу",
   "year": 1964,
   "similarity": 0.396
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.392
  }
 ],
 "tmdb:9829": [
  {
   "key": "tmdb:97630",
   "workId": "f-tmdb97630",
   "title": "Цель номер один",
   "year": 2012,
   "similarity": 0.556
  },
  {
   "key": "tmdb:855",
   "workId": "f-tmdb855",
   "title": "Чёрный ястреб",
   "year": 2001,
   "similarity": 0.324
  },
  {
   "key": "tmdb:568",
   "workId": "f-tmdb568",
   "title": "Аполлон 13",
   "year": 1995,
   "similarity": 0.274
  },
  {
   "key": "tmdb:68734",
   "workId": "f-tmdb68734",
   "title": "Операция «Арго»",
   "year": 2012,
   "similarity": 0.272
  },
  {
   "key": "tmdb:157354",
   "workId": "f-tmdb157354",
   "title": "Станция «Фрутвейл»",
   "year": 2013,
   "similarity": 0.261
  }
 ],
 "tmdb:990": [
  {
   "key": "tmdb:654",
   "workId": "f-tmdb654",
   "title": "В порту",
   "year": 1954,
   "similarity": 0.526
  },
  {
   "key": "tmdb:28580",
   "workId": "f-tmdb28580",
   "title": "Потерянный уик-энд",
   "year": 1945,
   "similarity": 0.509
  },
  {
   "key": "tmdb:1578",
   "workId": "f-tmdb1578",
   "title": "Бешеный бык",
   "year": 1980,
   "similarity": 0.446
  },
  {
   "key": "tmdb:11293",
   "workId": "f-tmdb11293",
   "title": "Бумажная луна",
   "year": 1973,
   "similarity": 0.439
  },
  {
   "key": "tmdb:996",
   "workId": "f-tmdb996",
   "title": "Двойная страховка",
   "year": 1944,
   "similarity": 0.429
  }
 ],
 "tmdb:9905": [
  {
   "key": "tmdb:11368",
   "workId": "f-tmdb11368",
   "title": "Просто кровь",
   "year": 1985,
   "similarity": 0.441
  },
  {
   "key": "tmdb:627",
   "workId": "f-tmdb627",
   "title": "На игле",
   "year": 1996,
   "similarity": 0.415
  },
  {
   "key": "tmdb:379",
   "workId": "f-tmdb379",
   "title": "Перекресток Миллера",
   "year": 1990,
   "similarity": 0.38
  },
  {
   "key": "tmdb:8321",
   "workId": "u-kp276295",
   "title": "Залечь на дно в Брюгге",
   "year": 2007,
   "similarity": 0.342
  },
  {
   "key": "tmdb:500",
   "workId": "f-tmdb500",
   "title": "Бешеные псы",
   "year": 1992,
   "similarity": 0.341
  }
 ],
 "tmdb:992": [
  {
   "key": "tmdb:961",
   "workId": "f-tmdb961",
   "title": "Паровоз Генерал",
   "year": 1926,
   "similarity": 0.484
  },
  {
   "key": "tmdb:3063",
   "workId": "f-tmdb3063",
   "title": "Утиный суп",
   "year": 1933,
   "similarity": 0.455
  },
  {
   "key": "tmdb:378",
   "workId": "f-tmdb378",
   "title": "Воспитание Аризоны",
   "year": 1987,
   "similarity": 0.398
  },
  {
   "key": "tmdb:25768",
   "workId": "f-tmdb25768",
   "title": "Пароходный Билл",
   "year": 1928,
   "similarity": 0.394
  },
  {
   "key": "tmdb:3085",
   "workId": "f-tmdb3085",
   "title": "Его девушка Пятница",
   "year": 1940,
   "similarity": 0.38
  }
 ],
 "tmdb:993": [
  {
   "key": "tmdb:521",
   "workId": "f-tmdb521",
   "title": "В случае убийства набирайте «М»",
   "year": 1954,
   "similarity": 0.58
  },
  {
   "key": "tmdb:37257",
   "workId": "f-tmdb37257",
   "title": "Свидетель обвинения",
   "year": 1957,
   "similarity": 0.528
  },
  {
   "key": "tmdb:70670",
   "workId": "u-kp526812",
   "title": "Охотники за головами",
   "year": 2011,
   "similarity": 0.454
  },
  {
   "key": "tmdb:629",
   "workId": "f-tmdb629",
   "title": "Подозрительные лица",
   "year": 1995,
   "similarity": 0.452
  },
  {
   "key": "tmdb:389",
   "workId": "w01",
   "title": "Двенадцать разгневанных мужчин",
   "year": 1957,
   "similarity": 0.41
  }
 ],
 "tmdb:995": [
  {
   "key": "tmdb:3114",
   "workId": "f-tmdb3114",
   "title": "Искатели",
   "year": 1956,
   "similarity": 0.573
  },
  {
   "key": "tmdb:288",
   "workId": "f-tmdb288",
   "title": "Ровно в полдень",
   "year": 1952,
   "similarity": 0.459
  },
  {
   "key": "tmdb:33",
   "workId": "f-tmdb33",
   "title": "Непрощённый",
   "year": 1992,
   "similarity": 0.454
  },
  {
   "key": "tmdb:576",
   "workId": "f-tmdb576",
   "title": "Дикая банда",
   "year": 1969,
   "similarity": 0.395
  },
  {
   "key": "tmdb:642",
   "workId": "f-tmdb642",
   "title": "Буч Кэссиди и Сандэнс Кид",
   "year": 1969,
   "similarity": 0.386
  }
 ],
 "tmdb:996": [
  {
   "key": "tmdb:910",
   "workId": "f-tmdb910",
   "title": "Глубокий сон",
   "year": 1946,
   "similarity": 0.685
  },
  {
   "key": "tmdb:829",
   "workId": "f-tmdb829",
   "title": "Китайский квартал",
   "year": 1974,
   "similarity": 0.666
  },
  {
   "key": "tmdb:963",
   "workId": "f-tmdb963",
   "title": "Мальтийский сокол",
   "year": 1941,
   "similarity": 0.65
  },
  {
   "key": "tmdb:599",
   "workId": "f-tmdb599",
   "title": "Сансет бульвар",
   "year": 1950,
   "similarity": 0.614
  },
  {
   "key": "tmdb:845",
   "workId": "f-tmdb845",
   "title": "Незнакомцы в поезде",
   "year": 1951,
   "similarity": 0.596
  }
 ]
};
