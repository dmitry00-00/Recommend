// Сгенерировано tools/build-book-media.mts (З3) — руками не править.
// Ключ произведения (wd:/olw:/isbn:) → метаданные книги из Wikidata и Open Library: русское и
// оригинальное название, год, авторы, страницы, обложка (русского издания, если есть), регистр.
import type { WorkCard } from '@/types/tmdf';

export const bookMedia: Record<string, Partial<WorkCard>> = {
  "wd:Q1219705": {"originalTitle":"Le città invisibili","year":1972,"creators":["Итало Кальвино"],"pages":165,"coverUrl":"https://covers.openlibrary.org/b/id/963147-L.jpg","imageSource":"open_library","registers":["folk_gothic"]},
  "wd:Q1229792": {"title":"Бледный огонь","originalTitle":"Pale Fire","year":1961,"creators":["Владимир Владимирович Набоков"],"pages":315,"coverUrl":"https://covers.openlibrary.org/b/id/419852-L.jpg","imageSource":"open_library","registers":["cold_clinical"]},
  "wd:Q133261508": {"originalTitle":"Guardian Angel","year":1950,"creators":["Артур Чарльз Кларк"]},
  "wd:Q135515": {"title":"Шум и ярость","originalTitle":"The Sound and the Fury","year":1929,"creators":["Уильям Фолкнер"],"pages":361,"coverUrl":"https://covers.openlibrary.org/b/id/11556944-L.jpg","imageSource":"open_library","registers":["folk_gothic"]},
  "wd:Q172850": {"title":"Имя розы","originalTitle":"Il nome della rosa","year":1980,"creators":["Умберто Эко"],"pages":578,"coverUrl":"https://covers.openlibrary.org/b/id/8598263-L.jpg","imageSource":"open_library","registers":["puzzle_noir"]},
  "wd:Q188538": {"title":"Мастер и Маргарита","year":1928,"creators":["Михаил Афанасьевич Булгаков"],"pages":486,"coverUrl":"https://covers.openlibrary.org/b/id/12947486-L.jpg","imageSource":"open_library","registers":["absurd_satire"]},
  "wd:Q261281": {"title":"Солярис","originalTitle":"Solaris","year":1961,"creators":["Станислав Лем"],"pages":237,"coverUrl":"https://covers.openlibrary.org/b/id/12313764-L.jpg","imageSource":"open_library"},
  "wd:Q265954": {"title":"Бойня номер пять, или Крестовый поход детей","originalTitle":"Slaughterhouse-Five","year":1969,"creators":["Курт Воннегут"],"pages":208,"coverUrl":"https://covers.openlibrary.org/b/id/15239321-L.jpg","imageSource":"open_library","registers":["genre_idea"]},
  "wd:Q3258947": {"title":"Свидетель обвинения","originalTitle":"The Witness for the Prosecution","year":1925,"creators":["Агата Кристи"],"pages":280,"coverUrl":"https://covers.openlibrary.org/b/id/12996480-L.jpg","imageSource":"open_library","registers":["puzzle_noir"]},
  "wd:Q4087944": {"title":"Блаженство","originalTitle":"Bliss","year":1966,"creators":["Михаил Афанасьевич Булгаков"],"pages":158,"coverUrl":"https://covers.openlibrary.org/b/id/11508588-L.jpg","imageSource":"open_library"},
};
