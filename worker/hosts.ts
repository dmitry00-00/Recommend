// Хосты картинок, которые бот готов показывать в сообщениях и подсказках (06.10; вынесено 17.10, ХБ): всё остальное —
// картинка с чужого сервера, то есть пиксель слежения за каждым, кто откроет чат, или произвольная миниатюра.
export const IMAGE_HOSTS = /^https:\/\/(?:image\.tmdb\.org|covers\.openlibrary\.org|kinopoiskapiunofficial\.tech|avatars\.mds\.yandex\.net|commons\.wikimedia\.org|upload\.wikimedia\.org|i\.ytimg\.com)\//;
