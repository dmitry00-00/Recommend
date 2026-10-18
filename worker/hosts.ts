// Хосты картинок, которые бот готов показывать в сообщениях и подсказках (06.10; вынесено 17.10, ХБ): всё остальное —
// картинка с чужого сервера, то есть пиксель слежения за каждым, кто откроет чат, или произвольная миниатюра.
// thumb.wikimedia.org (18.10): уменьшенные копии Commons отдаются с него — так записаны обложки части книг (bookMedia.ts, tools/build-book-media.mts)
export const IMAGE_HOSTS = /^https:\/\/(?:image\.tmdb\.org|covers\.openlibrary\.org|kinopoiskapiunofficial\.tech|avatars\.mds\.yandex\.net|commons\.wikimedia\.org|upload\.wikimedia\.org|thumb\.wikimedia\.org|i\.ytimg\.com)\//;
