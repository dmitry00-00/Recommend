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
  -- {season, episode?, done?: [{season, perceived?, at}]}. У брошенного — на чём бросил
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
