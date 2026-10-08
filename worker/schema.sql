-- Схема D1: только то, что принадлежит участнику. Каталог, разборы и справочники сюда не
-- едут — они общие и лежат отдельно (R2), а здесь лишь то, что человек сделал сам.
--
-- Карточку произведения храним рядом отметкой (`work` JSON): сервер обязан уметь ответить
-- «что вы отметили» без моков фронтенда, иначе после смены устройства список окажется из
-- одних идентификаторов. Ключи внешних баз держим отдельными колонками — по ним потом
-- сойдутся разборы и замеры.

CREATE TABLE IF NOT EXISTS user (
  id          TEXT PRIMARY KEY,
  tg_id       INTEGER UNIQUE,
  username    TEXT,
  first_name  TEXT,
  created_at  TEXT NOT NULL,
  seen_at     TEXT NOT NULL,
  settings    TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS session (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS session_user ON session(user_id);

-- Просмотренное. `state` хранит и снятие отметки: у части фильмов отметка пришла из
-- присланного списка, и «убрал» — это тоже факт, а не отсутствие записи.
CREATE TABLE IF NOT EXISTS watched (
  user_id     TEXT NOT NULL REFERENCES user(id),
  work_id     TEXT NOT NULL,
  state       TEXT NOT NULL CHECK (state IN ('watched', 'removed')),
  work        TEXT,
  tmdb        INTEGER,
  imdb        TEXT,
  at          TEXT NOT NULL,
  PRIMARY KEY (user_id, work_id)
);

-- Дневник: что начато, брошено и закончено.
CREATE TABLE IF NOT EXISTS journal (
  user_id     TEXT NOT NULL REFERENCES user(id),
  entry_id    TEXT NOT NULL,
  work_id     TEXT NOT NULL,
  work        TEXT,
  status      TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'finished', 'abandoned')),
  progress    REAL,
  started_at  TEXT,
  finished_at TEXT,
  -- «насколько хочется» (1–5), когда фильм отложен свайпом в планы: потом видно, доходят ли
  -- до того, чего хотелось (24.09)
  eagerness   INTEGER,
  -- 1 — «смотрит» выведено из перехода в онлайн-кинотеатр, а не отмечено руками: такой старт
  -- потом переспрашиваем («посмотрели?»), и «ещё не смотрел» — нормальный ответ (24.09)
  inferred    INTEGER,
  -- сериал (Е3, 30.09): где человек — сезон и серия — и какие сезоны досмотрены, JSON
  -- {season, episode?, done?: [{season, perceived?, at}]}. У брошенного — на чём бросил.
  -- Книга (З5): {kind: 'book', part?, page?, done?: [{part, perceived?, at}]}
  series      TEXT,
  PRIMARY KEY (user_id, entry_id)
);

-- Прогноз перед стартом: что ждал человек и что ждала модель. Это половина петли измерения,
-- вторая половина — чек-ин; сверяются они уже на сервере.
CREATE TABLE IF NOT EXISTS prediction (
  user_id     TEXT NOT NULL REFERENCES user(id),
  entry_id    TEXT NOT NULL,
  work_id     TEXT NOT NULL,
  expected    TEXT,
  model       TEXT,
  model_p     TEXT,
  at          TEXT NOT NULL,
  PRIMARY KEY (user_id, entry_id)
);

-- Чек-ин: как оказалось. Пишем каждый, а не последний: передумал — это тоже наблюдение.
CREATE TABLE IF NOT EXISTS checkin (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  entry_id    TEXT NOT NULL,
  work_id     TEXT NOT NULL,
  status      TEXT NOT NULL,
  perceived   TEXT,
  reason      TEXT,
  payload     TEXT,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS checkin_user ON checkin(user_id, at);

-- Отклик на рекомендацию: принял, отложил, отказался — и по какой причине. Без этого
-- подбор нечем сравнивать с базовой стратегией.
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  rec_id      TEXT,
  work_id     TEXT,
  action      TEXT NOT NULL,
  reason      TEXT,
  -- «насколько хочется» (1–5) из свайпа по ленте: ожидание до просмотра, не оценка увиденного
  eagerness   INTEGER,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_user ON feedback(user_id, at);

-- Вердикты по автонайденным разборам: «про этот / про другой / не знаю». Ключ — ссылка,
-- потому что один и тот же ролик может быть привязан к нескольким фильмам.
CREATE TABLE IF NOT EXISTS link_verdict (
  user_id     TEXT NOT NULL REFERENCES user(id),
  url         TEXT NOT NULL,
  work_id     TEXT,
  verdict     TEXT NOT NULL CHECK (verdict IN ('about_this', 'other_work', 'unsure')),
  at          TEXT NOT NULL,
  PRIMARY KEY (user_id, url)
);

-- Оценка фильма, который человек уже видел: 1–5 (и исходная десятибалльная, если пришла из
-- экспорта). Это вес наблюдения для модели, в интерфейс она не возвращается. С неё начинается
-- новый участник: пока оценок меньше порога, подбирать не из чего.
CREATE TABLE IF NOT EXISTS rating (
  user_id     TEXT NOT NULL REFERENCES user(id),
  work_id     TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  raw         REAL,
  work        TEXT,
  at          TEXT NOT NULL,
  PRIMARY KEY (user_id, work_id)
);

-- Показы: какие кадры человек увидел в ленте и на каком месте. Без них «принятие слейта»
-- не посчитать — отклик есть только у того, что показали (трек Б).
CREATE TABLE IF NOT EXISTS impression (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  slate_id    TEXT NOT NULL,
  rec_id      TEXT NOT NULL,
  work_id     TEXT NOT NULL,
  slot        TEXT,
  rank        INTEGER,
  energy      TEXT,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS impression_user ON impression(user_id, at);

-- Открытия материалов (ТВ-3г, 06.10): какой ролик или пост человек открыл, в какой рубрике и
-- откуда. Этап 1 выката рубрик — замер без показа: что открывают по рубрикам; этап 2 — то же
-- у доли людей с полками (`shelves`), сравнение с остальными. Досмотр снаружи не виден.
CREATE TABLE IF NOT EXISTS material_open (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  url         TEXT NOT NULL,
  work_id     TEXT,
  platform    TEXT,
  lens        TEXT,
  lens_also   TEXT,
  tier        TEXT,
  place       TEXT,
  shelf       TEXT,
  shelves     INTEGER,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS material_open_user ON material_open(user_id, at);

-- Разметка владельца с телефона (06.10): решение по привязке ролика к фильму (kind = 'check') или
-- по рубрике (kind = 'lens'); body — JSON решения. Забирает tools/owner-pull.mts по ADMIN_TOKEN.
CREATE TABLE IF NOT EXISTS owner_decision (
  kind        TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  body        TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (kind, item_id)
);

-- Тестеры (ТВ-3в, 06.10): ник Telegram в нижнем регистре, без @. Видят все полки, но не статистику и
-- не механику (карта операций, уровни, прогноз) — это только админу (OWNER_USERNAME). Список ведёт
-- админ в настройках приложения.
CREATE TABLE IF NOT EXISTS tester (
  username    TEXT PRIMARY KEY,
  at          TEXT NOT NULL
);

-- Присланная история: какие версии списка просмотренного уже разложены в профиль. Список
-- кладёт владелец (tools/publish-seed.mts) с согласия участника; при следующем входе он
-- добавляется к профилю один раз, ничего не перетирая (24.09).
CREATE TABLE IF NOT EXISTS seed_applied (
  user_id     TEXT NOT NULL REFERENCES user(id),
  seed        TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (user_id, seed)
);

-- Заявки участников: «такого фильма у вас нет» и «вот автор, которого стоит добавить».
-- Своей таблицей, а не строкой в feedback: это не отклик на показанное, а сообщение о
-- пробеле в общих данных. Проверяет их владелец (tools/suggestions.mts) и заводит руками —
-- автоматически в каталог заявка не попадает: доверять чужому вводу справочник нельзя.
CREATE TABLE IF NOT EXISTS suggestion (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  kind        TEXT NOT NULL CHECK (kind IN ('work', 'voice')),
  -- как человек назвал фильм или автора
  title       TEXT NOT NULL,
  -- всё остальное одной строкой: год, ссылка на канал, «смотрел в прокате»
  note        TEXT,
  -- откуда пришла заявка: поисковый запрос, карточка фильма. По ней видно, чего не хватило
  context     TEXT,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS suggestion_user ON suggestion(user_id, at);

-- Неточность в карточке (02.10): человек отметил, что в деталях произведения ошибка — год,
-- режиссёр, описание, кадр, длительность, «где смотреть», разбор не про этот фильм. Своей
-- таблицей: это не заявка на новое (suggestion), а правка к тому, что уже показано. Чинит
-- владелец руками (tools/suggestions.mts), справочник чужому вводу сам не верит.
CREATE TABLE IF NOT EXISTS work_issue (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  work_id     TEXT NOT NULL,
  -- название на момент жалобы: карточка может уйти из каталога, а очередь должна читаться
  title       TEXT NOT NULL,
  -- что не так, через запятую: title, year, people, synopsis, image, duration, type, watch, analyses, relations, heroes, other
  fields      TEXT NOT NULL,
  -- как должно быть или что не так — свободным текстом
  note        TEXT,
  -- где заметили: лента, архив, поиск, страница произведения
  context     TEXT,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS work_issue_work ON work_issue(work_id, at);

-- 06.10: подписки на разборы (worker/follow.ts): на героя (ref — элемент Wikidata) или произведение
-- (ref — ключ разборов, keys — все ключи карточки); свежее из справочника и когда кому слали сводку
CREATE TABLE IF NOT EXISTS follow (user_id TEXT NOT NULL REFERENCES user(id), kind TEXT NOT NULL, ref TEXT NOT NULL,
  keys TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (user_id, kind, ref));
CREATE TABLE IF NOT EXISTS follow_fresh (url TEXT PRIMARY KEY, key TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL,
  platform TEXT NOT NULL, spoiler INTEGER NOT NULL DEFAULT 0, tier TEXT, lens TEXT, at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS follow_fresh_at ON follow_fresh(at);
CREATE TABLE IF NOT EXISTS follow_digest (user_id TEXT PRIMARY KEY, at TEXT NOT NULL, day TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0);
-- 07.10, ЗП-17: весть «вышел новый сезон» (worker/seasons.ts) — одна на сезон
CREATE TABLE IF NOT EXISTS season_notice (user_id TEXT NOT NULL REFERENCES user(id), key TEXT NOT NULL, season INTEGER NOT NULL,
  at TEXT NOT NULL, PRIMARY KEY (user_id, key, season));

-- 06.10: реестр — каналы (source, tgchannel, excluded), разметка «ролик → фильм» (video, post), пояснения файлов
-- (doc); журнал правок и входящие ссылки из формы Google (worker/registry.ts). Исключение из правила «в D1 —
-- только данные участников»: реестр пишут пульт, телефон и сборщик, и одна правда лучше трёх файлов.
CREATE TABLE IF NOT EXISTS registry (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, ord REAL, at TEXT NOT NULL,
  by TEXT, PRIMARY KEY (kind, id));
CREATE TABLE IF NOT EXISTS registry_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL,
  before TEXT, after TEXT, at TEXT NOT NULL, by TEXT);
CREATE INDEX IF NOT EXISTS registry_log_item ON registry_log(kind, id, seq);
CREATE INDEX IF NOT EXISTS registry_log_at ON registry_log(at);
CREATE TABLE IF NOT EXISTS registry_meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS registry_inbox (url TEXT PRIMARY KEY, film TEXT, note TEXT, sheet_at TEXT, taken_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', result TEXT, done_at TEXT);
CREATE INDEX IF NOT EXISTS registry_inbox_status ON registry_inbox(status, taken_at);

-- 07.10, ЗП-3: воронка и удержание (worker/funnel.ts). Заход — первый запрос дня (по Москве) с токеном:
-- сессия живёт в браузере 90 дней, и по ней возвраты не видны. События — что в материалах не видно:
-- открыта карточка произведения (card) и нажато «Смотреть» (watch, платформа — в detail).
CREATE TABLE IF NOT EXISTS visit (user_id TEXT NOT NULL REFERENCES user(id), day TEXT NOT NULL, PRIMARY KEY (user_id, day));
CREATE INDEX IF NOT EXISTS visit_day ON visit(day);
CREATE TABLE IF NOT EXISTS event (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), kind TEXT NOT NULL,
  work_id TEXT, place TEXT, detail TEXT, at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS event_kind_at ON event(kind, at);
CREATE INDEX IF NOT EXISTS event_user ON event(user_id, work_id);

-- 07.10, ЗП-11: выбор компанией (worker/together.ts) — колода из 4–12 карточек целиком (позванный видит то же,
-- что все, даже если этих фильмов нет в его справочнике) и голоса «хочу / не хочу / видел» с оценкой модели
-- `fit` по профилю голосующего. session_id — без внешнего ключа (см. worker/account.ts).
CREATE TABLE IF NOT EXISTS together (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), deck TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS together_vote (session_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'seen')), fit REAL, at TEXT NOT NULL, PRIMARY KEY (session_id, user_id, work_id));
