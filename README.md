# Transformative Media

Рекомендательная платформа, которая оптимизирует не вероятность того, что произведение
понравится, а полезность произведения для развития способов мышления конкретного человека
прямо сейчас.

## Где что

| Документ | Что внутри |
|---|---|
| [`BACKLOG.md`](BACKLOG.md) | Очередь задач с приоритетами, статусами и зависимостями — с неё начинать |
| [`HANDOFF.md`](HANDOFF.md) | Состояние кода по датам: что сделано, почему так, как проверено |
| [`ROADMAP.md`](ROADMAP.md) | План разработки; §8 — треки Г–И (разметка, авторы, сериалы, вселенные, книги, персонажи) |
| [`AUTHORS.md`](AUTHORS.md) | Ярусы авторов: оценка → толкование → интерпретация с проверкой |
| [`PORTING.md`](PORTING.md) | План фронтенда |
| [`docs/`](docs/) | Исходный промпт v0.4 и первый план фаз 0–2 |

## Устройство

- `src/` — приложение (Vite, React, TypeScript, Tailwind), в том числе Telegram Mini App.
- `worker/` — тонкий бэкенд на Cloudflare Workers + D1; `server/`, `deploy/bothost/` — он же на bothost.ru.
- `tools/` — сборщики индексов: разборы в постах Telegram и роликах YouTube, справочник фильмов
  (Wikidata, TMDb), соупоминания, импорт Кинопоиска, таблица разметки. Сгенерированное
  лежит в `src/mocks/*Auto.ts` и не правится руками.
- `deploy/*.command` — запуск двойным щелчком в Finder: ночной сбор (`collect`, ставится в
  launchd через `install-collect`), таблица разметки (`markup-xlsx`, `markup-sync`), пульт
  Кинопоиска (`kinopoisk-desk`), выгрузка роликов (`youtube-dump`).

## Запуск

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run build
npm run api          # воркер локально (wrangler, D1)
npx tsx tools/collect.mts   # сбор вручную; ключи — в .env.local (образец .env.example)
```

Ночной сбор идёт в 06:30 по launchd, лог — `.cache/collect/<время>.log`, контрольные замеры
против прошлого прогона — в конце лога.
