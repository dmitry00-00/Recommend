#!/usr/bin/env python3
# MovieLens как эталон для замера подбора (24.10, решение владельца): оценки ml-32m → истории в формате seeds/*.json,
# чтобы tools/taste-eval.mts --seeds <каталог> мерил модель на чужой большой аудитории. Только внутренний опыт:
# условия GroupLens — исследования, не коммерция, поэтому ни в продукт (src/, worker/), ни в git отсюда ничего не идёт —
# и сами истории, и метаданные лежат на внешнем диске (derived/), здесь — только этот скрипт.
#   python3 -I tools/movielens-seeds.py [--people 1500] [--min 30] [--max 3000] [--out <каталог>]
# Что берём: только фильмы, которые есть в нашем справочнике (src/mocks — те же файлы, что tools/works-index.mts):
# по TMDb из links.csv, запасной путь — IMDb (номер TMDb тогда — наш, из той же карточки). Убранное владельцем
# (withheldWorks.ts) — мимо. Сериалы справочника без TMDb ключ IMDb не дают: в MovieLens только фильмы.
# Карточка — как у импорта Кинопоиска (tools/kinopoisk-seed.mts): `l-tmdb<id>`, без разметки, ключи TMDb и IMDb —
# разметку и место в пуле приложение находит по ключу фильма. Шкала 0.5–5 → raw 1–10 (как десятибалльная Кинопоиска и
# звёзды Letterboxd в tools/profile-seed.mts), оценка 1–5 — round(raw/2); at — дата оценки (taste-dump --holdout-mode recent).
# Кого берём: людей, у кого не меньше --min оценок фильмов справочника и не больше --max (сверхактивные — не зрители, а
# разметчики), детерминированно (sha1 от номера) и поровну по корзинам числа оценок 30–50, 50–100, …, 1600–3000 —
# не одни самые активные. Два прохода по ratings.csv потоком (csv, без pandas): память — словарь «человек → число оценок»
# и оценки только отобранных. Итог — <out>/ml-<userId>.json и <out>/_meta.json (сопоставление, доли, покрытие).
import csv, datetime, hashlib, json, math, os, re, sys, time
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML = '/Volumes/внешний/datasets/movielens/ml-32m'
args = sys.argv[1:]
def opt(name, default):
    return args[args.index(name) + 1] if name in args else default
PEOPLE = int(opt('--people', 1500))
MIN = int(opt('--min', 30))
MAX = int(opt('--max', 3000))
OUT = opt('--out', '/Volumes/внешний/datasets/movielens/derived/seeds-ml')
# корзины числа оценок: [нижняя, верхняя)
BINS = sorted({MIN, *(b for b in (50, 100, 200, 400, 800, 1600) if MIN < b <= MAX), MAX + 1})

# ─── справочник: ключи фильмов из src/mocks ────────────────────────────────────
# те же источники, что worksIndex (tools/works-index.mts); файлы сгенерированы — плоские объекты externalIds читаются
# регулярками: у фильма TMDb есть, у сериала TMDb во внешних ключах не бывает (номера пересекаются с фильмами)
FILES = ['externalIds.ts', 'catalogMedia.ts', 'userHistory.ts', 'userWatched.ts', 'candidateMedia.ts', 'filmBase.ts',
         'filmBaseWiki.ts', 'filmBaseMarkup.ts', 'filmBaseCurated.ts', 'filmBasePopular.ts', 'filmBaseLinks.ts',
         'filmBaseTail.ts', 'filmBaseMore.ts', 'filmBaseWorld.ts', 'filmBaseChannels.ts']
flat = re.compile(r'\{[^{}]*\}')
tmdb_re = re.compile(r'["\']?tmdb["\']?\s*:\s*(\d+)')
imdb_re = re.compile(r'["\']?imdb["\']?\s*:\s*["\'](tt\d+)["\']')
type_re = re.compile(r'"type"\s*:\s*"(\w+)"|c\("\w+",\s*"(\w+)"')
withheld_text = open(f'{ROOT}/src/mocks/withheldWorks.ts', encoding='utf8').read()
withheld = set(re.findall(r'["\']((?:tmdb|imdb):(?:tt)?\d+)["\']\s*:', withheld_text))
cat_tmdb = set()        # TMDb фильмов справочника
imdb_to_tmdb = {}       # IMDb фильма → его TMDb в справочнике (None — фильм без TMDb)
tmdb_to_imdb = {}       # и обратно — IMDb в карточку берём наш
for f in FILES:
    text = open(f'{ROOT}/src/mocks/{f}', encoding='utf8').read()
    for m in flat.finditer(text):
        body = m.group(0)
        t, i = tmdb_re.search(body), imdb_re.search(body)
        if not t and not i:
            continue
        tm = int(t.group(1)) if t else None
        im = i.group(1) if i else None
        if tm is None:
            # только IMDb: фильм ли — по типу своей карточки (ближайший «type» перед объектом)
            kinds = type_re.findall(text, max(0, m.start() - 3000), m.start())
            if not kinds or (kinds[-1][0] or kinds[-1][1]) != 'film':
                continue
        if (tm is not None and f'tmdb:{tm}' in withheld) or (im and f'imdb:{im}' in withheld):
            continue
        if tm is not None:
            cat_tmdb.add(tm)
            if im:
                tmdb_to_imdb.setdefault(tm, im)
        if im and (imdb_to_tmdb.get(im) is None):
            imdb_to_tmdb[im] = tm

# ─── MovieLens: фильм → наш TMDb ───────────────────────────────────────────────
titles = {}
with open(f'{ML}/movies.csv', newline='', encoding='utf8') as fh:
    for row in csv.DictReader(fh):
        m = re.match(r'^(.*?)\s*\((\d{4})\)\s*$', row['title'].strip())
        title, year = (m.group(1), int(m.group(2))) if m else (row['title'].strip(), 0)
        title = re.sub(r'^(.*), (The|A|An)$', r'\2 \1', title)  # «Matrix, The» → «The Matrix»
        titles[int(row['movieId'])] = (title, year)
ml_to = {}              # movieId → (tmdb, imdb)
how = Counter()
ml_total = 0
with open(f'{ML}/links.csv', newline='', encoding='utf8') as fh:
    for row in csv.DictReader(fh):
        ml_total += 1
        mid = int(row['movieId'])
        imdb = f"tt{row['imdbId'].strip().zfill(7)}" if row['imdbId'].strip() else None
        tmdb = int(row['tmdbId']) if row['tmdbId'].strip() else None
        if tmdb is not None and tmdb in cat_tmdb:
            # IMDb в карточку — наш; у MovieLens изредка другой, и если он у нас — ключ другого фильма: тогда без IMDb
            ours = tmdb_to_imdb.get(tmdb) or (imdb if imdb and imdb not in imdb_to_tmdb else None)
            ml_to[mid] = (tmdb, ours); how['tmdb'] += 1
        elif imdb and imdb in imdb_to_tmdb:
            if imdb_to_tmdb[imdb] is None:
                how['imdbNoTmdb'] += 1  # наш фильм без TMDb: ключа l-tmdb нет — мимо
                continue
            ml_to[mid] = (imdb_to_tmdb[imdb], tmdb_to_imdb.get(imdb_to_tmdb[imdb], imdb)); how['imdb'] += 1
print(f'справочник: фильмов с TMDb {len(cat_tmdb)}, с IMDb {len(imdb_to_tmdb)}; MovieLens: фильмов {ml_total}, '
      f'сопоставлено {len(ml_to)} (по TMDb {how["tmdb"]}, по IMDb {how["imdb"]}, наш без TMDb {how["imdbNoTmdb"]})', file=sys.stderr)

# пул замера — для покрытия в _meta: ключи кандидатов из выгрузок taste-dump (только первый столбец — ключ фильма)
def pool_keys(d):
    keys = set()
    p = f'{ROOT}/.cache/eval/{d}'
    if not os.path.isdir(p):
        return None
    for f in os.listdir(p):
        if f.endswith('.json'):
            try:
                keys.update(r[0] for r in json.load(open(f'{p}/{f}', encoding='utf8'))['rows'])
            except Exception:
                pass
    return keys
pools = {k: v for k, v in (('base', pool_keys('dump-frozen')), ('fullPool', pool_keys('dump-frozen-full'))) if v}

# ─── проход 1: сколько оценок фильмов справочника у каждого ────────────────────
t0 = time.time()
count = Counter()
rows = rows_in = 0
movies_rated = set()
with open(f'{ML}/ratings.csv', newline='', encoding='utf8') as fh:
    r = csv.reader(fh); next(r)
    for uid, mid, _, _ in r:
        rows += 1
        if int(mid) in ml_to:
            rows_in += 1
            count[int(uid)] += 1
            movies_rated.add(int(mid))
print(f'проход 1: оценок {rows}, по справочнику {rows_in} ({rows_in / rows:.1%}), людей {len(count)}, {time.time() - t0:.0f} с', file=sys.stderr)

# ─── выборка: поровну по корзинам, внутри — по sha1 номера ─────────────────────
h = lambda u: hashlib.sha1(f'ml-32m:{u}'.encode()).hexdigest()
bins = defaultdict(list)
for u, n in count.items():
    for lo, hi in zip(BINS, BINS[1:]):
        if lo <= n < hi:
            bins[(lo, hi)].append(u)
for b in bins.values():
    b.sort(key=h)
chosen, left, keys = [], PEOPLE, sorted(bins)
# свободные места корзин, где людей меньше доли, переходят следующим
for i, b in enumerate(keys):
    take = min(len(bins[b]), left // (len(keys) - i))
    chosen += bins[b][:take]; left -= take
chosen_set = set(chosen)

# ─── проход 2: оценки отобранных ───────────────────────────────────────────────
t0 = time.time()
mine = defaultdict(dict)  # человек → наш TMDb → (оценка MovieLens, время): у двух записей MovieLens на один фильм — поздняя
with open(f'{ML}/ratings.csv', newline='', encoding='utf8') as fh:
    r = csv.reader(fh); next(r)
    for uid, mid, rating, ts in r:
        u = int(uid)
        if u not in chosen_set:
            continue
        hit = ml_to.get(int(mid))
        if not hit:
            continue
        prev = mine[u].get(hit[0])
        if not prev or int(ts) >= prev[2]:
            mine[u][hit[0]] = (int(mid), float(rating), int(ts))
print(f'проход 2: {time.time() - t0:.0f} с', file=sys.stderr)

os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.startswith('ml-') and f.endswith('.json'):
        os.remove(f'{OUT}/{f}')
blank = {'primaryOperations': [], 'complexityLevel': 0, 'warnings': [], 'barriers': [], 'isNicheMasterpiece': False}
now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
sizes, raws, in_pool = [], Counter(), {k: [] for k in pools}
for u in sorted(chosen):
    watched, ratings = [], []
    for tmdb, (mid, rating, ts) in sorted(mine[u].items(), key=lambda x: x[1][2]):
        imdb = ml_to[mid][1]
        title, year = titles.get(mid, (f'MovieLens {mid}', 0))
        ids = {'tmdb': tmdb, **({'imdb': imdb} if imdb else {})}
        work = {'id': f'l-tmdb{tmdb}', 'type': 'film', 'title': title, 'year': year, 'creators': [],
                **blank, 'externalIds': ids}
        at = datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime('%Y-%m-%d')
        raw = max(1, min(10, round(rating * 2)))
        raws[raw] += 1
        watched.append({'workId': work['id'], 'work': work, **ids, 'at': at})
        ratings.append({'workId': work['id'], 'rating': min(5, max(1, math.floor(raw / 2 + 0.5))), 'raw': raw, 'work': work, 'at': at})
    sizes.append(len(ratings))
    for k, keys_ in pools.items():
        in_pool[k].append(sum(1 for x in ratings if f"tmdb:{x['work']['externalIds']['tmdb']}" in keys_))
    body = {'username': f'ml-{u}', 'version': hashlib.sha1(json.dumps(ratings).encode()).hexdigest()[:12], 'watched': watched,
            'ratings': ratings, 'unmatched': [], 'source': {'service': 'movielens', 'dataset': 'ml-32m', 'user': u}, 'resolvedAt': now}
    with open(f'{OUT}/ml-{u}.json', 'w', encoding='utf8') as fh:
        json.dump(body, fh, ensure_ascii=False, separators=(',', ':'))

q = lambda xs, p: sorted(xs)[min(len(xs) - 1, int(p * len(xs)))] if xs else None
meta = {
    'at': now, 'dataset': 'ml-32m', 'license': 'GroupLens: только исследования, не коммерция; вне git и продукта',
    'params': {'people': PEOPLE, 'min': MIN, 'max': MAX, 'bins': BINS},
    'catalog': {'filmsTmdb': len(cat_tmdb), 'filmsImdb': len(imdb_to_tmdb), 'withheldKeys': len(withheld)},
    'movielens': {'films': ml_total, 'matched': len(ml_to), 'matchedShare': round(len(ml_to) / ml_total, 4),
                  'byTmdb': how['tmdb'], 'byImdb': how['imdb'], 'oursWithoutTmdb': how['imdbNoTmdb'],
                  'matchedRatedAtAll': len(movies_rated), 'catalogCoverage': round(len({ml_to[m][0] for m in ml_to}) / len(cat_tmdb), 4)},
    'ratings': {'total': rows, 'inCatalog': rows_in, 'inCatalogShare': round(rows_in / rows, 4)},
    'people': {'total': len(count), f'with{MIN}plus': sum(1 for n in count.values() if n >= MIN),
               'aboveMax': sum(1 for n in count.values() if n > MAX), 'chosen': len(chosen),
               'byBin': {f'{lo}-{hi - 1}': {'available': len(bins.get((lo, hi), [])), 'chosen': sum(1 for u in chosen if lo <= count[u] < hi)}
                         for lo, hi in zip(BINS, BINS[1:])}},
    'chosen': {'ratings': sum(sizes), 'median': q(sizes, 0.5), 'p10': q(sizes, 0.1), 'p90': q(sizes, 0.9), 'max': max(sizes, default=0),
               'raw': {str(k): raws[k] for k in sorted(raws)},
               'inPool': {k: {'share': round(sum(v) / max(1, sum(sizes)), 4), 'median': q(v, 0.5), 'poolKeys': len(pools[k])} for k, v in in_pool.items()}},
}
with open(f'{OUT}/_meta.json', 'w', encoding='utf8') as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=1)
print(json.dumps(meta, ensure_ascii=False, indent=1))
