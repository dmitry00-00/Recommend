# Опыт 24.10: помогут ли классификатору разметки (tools/markup-encoder.py) русские рецензии зрителей Кинопоиска 2004–2012 —
# набор blinoff/kinopoisk с Hugging Face (TOP250 + BOTTOM100, 36 591 рецензия, 350 фильмов), уже скачан на внешний диск.
# Только внутренний опыт: в продукт (src/, worker/), веса боевой модели и git из набора ничего не идёт; производное — только
# в derived/ рядом с набором. Сайт Кинопоиска не открываем и ничего с него не качаем — работаем с файлом.
# Ники авторов — личное: в выход и в отчёт не пишем (поле author не читаем вовсе).
# Что делает:
#   1) сопоставляет фильмы набора с .cache/eval/markup-encoder/films.json по русскому названию + году; нормализация как в
#      ~/recruit — regex, без морфологии и fuzzy: регистр, ё→е, кавычки и знаки → пробел (у набора двоеточия выпали:
#      «Терминатор 2 Судный день»), римские номера → арабские, пробелы схлопнуты. Ярусы по порядку: название+год → название+год±1 → оригинал+год
#      (в наборе латиницей бывает только часть названия, ярус почти пустой, но дешёвый). Несколько ключей на ярусе — берём все
#      (дубли справочника, у них один режиссёр — в одной группе частей), считаем отдельно;
#   2) на каждый совпавший фильм — выжимка рецензий: до --n штук, по кругу Good → Bad → Neutral (сбалансированно, чтобы
#      обрезка энкодером по --max-chars оставляла все три тона), внутри тона — самые длинные первыми (в длинных больше
#      о самом фильме, а не «посмотрел вчера»), каждая обрезана до --per-review знаков по границе предложения;
#   3) лёгкие признаки без эмбеддингов: доли Good/Bad/Neutral, среднее и разброс grade10, длина рецензий, часть (top/bottom).
# Выход: derived/review-text.json {key: {text, n, good, bad, neutral, …}}, derived/review-match.json (счётчики + несовпавшие
# названия фильмов — это не личное).
#   python3 -I tools/kp-reviews-text.py [--n 12] [--per-review 300] [--films .cache/eval/markup-encoder/films.json]
# Запускать из корня репозитория; лёгкий, ~10 с.
import argparse, json, os, re, statistics, sys
from collections import Counter, defaultdict

ROOT = '/Volumes/внешний/datasets/kinopoisk-reviews-blinoff'
ap = argparse.ArgumentParser()
ap.add_argument('--data', default=f'{ROOT}/kinopoisk.jsonl')
ap.add_argument('--films', default='.cache/eval/markup-encoder/films.json')
ap.add_argument('--out-dir', default=f'{ROOT}/derived')
ap.add_argument('--n', type=int, default=12, help='рецензий на фильм, не больше')
ap.add_argument('--per-review', type=int, default=300, help='знаков на рецензию')
ap.add_argument('--min-len', type=int, default=200, help='короче — не брать в выжимку (в счётчики идут)')
a = ap.parse_args()
os.makedirs(a.out_dir, exist_ok=True)

ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']
def norm(s):
    # в Python re с юникодом \w знает кириллицу; «_» — тоже \w, его убираем отдельно
    s = s.lower().replace('ё', 'е')
    s = re.sub(r'[^\w\s]|_', ' ', s)
    # римские номера частей латиницей → арабские с обеих сторон («Эпизод III» у нас, «Эпизод 3» в наборе), отдельным словом
    s = re.sub(r'(?<![^\W\d_])(i|ii|iii|iv|v|vi|vii|viii|ix|x)(?![^\W\d_])', lambda m: str(ROMAN.index(m.group(1)) + 1), s)
    return re.sub(r'\s+', ' ', s).strip()

def cut(t, m):
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) <= m: return t
    c = t[:m]; e = max(c.rfind('. '), c.rfind('! '), c.rfind('? '))
    return c[:e + 1] if e > m / 3 else c.rsplit(' ', 1)[0] + '…'

# ---------- рецензии ----------
by_movie = defaultdict(list); part = {}
for line in open(a.data, encoding='utf-8'):
    r = json.loads(line)
    g10 = r.get('grade10')
    try: g10 = float(g10) if g10 not in (None, '') else None
    except ValueError: g10 = None
    by_movie[r['movie_name']].append({'g3': r['grade3'], 'g10': g10, 'content': r['content'] or '', 'date': (r.get('date') or '')[:10]})
    part[r['movie_name']] = r['part']
n_reviews = sum(len(v) for v in by_movie.values())
print(f'набор: фильмов {len(by_movie)}, рецензий {n_reviews}', file=sys.stderr)

# ---------- справочник опыта ----------
D = json.load(open(a.films))
idx_t, idx_o = defaultdict(list), defaultdict(list)
for f in D['films']:
    if f['title'] and f['year']: idx_t[(norm(f['title']), f['year'])].append(f['key'])
    if f['orig'] and f['year']: idx_o[(norm(f['orig']), f['year'])].append(f['key'])
conf_of = {f['key']: f['label']['confidence'] for f in D['films']}

def match(name):
    m = re.match(r'^(.*\S)\s*\((\d{4})\)\s*$', name)
    t, y = norm(m.group(1)), int(m.group(2))
    for tier, idx, years in [('title+year', idx_t, [y]), ('title+year±1', idx_t, [y - 1, y + 1]), ('orig+year', idx_o, [y])]:
        ks = sorted({k for yy in years for k in idx.get((t, yy), [])})
        if ks: return tier, ks
    return None, []

tiers = Counter(); multi = 0; unmatched = []; out = {}
for name, revs in sorted(by_movie.items()):
    tier, keys = match(name)
    if not keys:
        unmatched.append({'movie': name, 'part': part[name], 'reviews': len(revs)}); continue
    tiers[tier] += 1; multi += len(keys) > 1
    # выжимка: по кругу Good → Bad → Neutral, внутри тона длинные первыми
    pool = {g: sorted([r for r in revs if r['g3'] == g and len(r['content'].strip()) >= a.min_len], key=lambda r: -len(r['content']))
            for g in ('Good', 'Bad', 'Neutral')}
    pick = []
    while len(pick) < a.n and any(pool.values()):
        for g in ('Good', 'Bad', 'Neutral'):
            if pool[g] and len(pick) < a.n: pick.append(pool[g].pop(0))
    text = '\n'.join(cut(r['content'], a.per_review) for r in pick)
    c3 = Counter(r['g3'] for r in revs)
    g10 = [r['g10'] for r in revs if r['g10'] is not None]
    rec = {'text': text, 'n': len(revs), 'n_text': len(pick), 'good': c3['Good'], 'bad': c3['Bad'], 'neutral': c3['Neutral'],
           'g10_n': len(g10), 'g10_mean': round(statistics.mean(g10), 3) if g10 else None,
           'g10_sd': round(statistics.pstdev(g10), 3) if len(g10) > 1 else None,
           'len_median': int(statistics.median(len(r['content']) for r in revs)), 'part': part[name], 'tier': tier, 'movie': name}
    for k in keys: out[k] = rec

json.dump(out, open(f'{a.out_dir}/review-text.json', 'w'), ensure_ascii=False)
matched_movies = len(by_movie) - len(unmatched)
info = {'movies': len(by_movie), 'reviews': n_reviews, 'matched_movies': matched_movies, 'keys': len(out), 'movies_multi_key': multi,
        'tiers': dict(tiers), 'reviews_on_matched': sum(len(by_movie[n]) for n in by_movie if n not in {u['movie'] for u in unmatched}),
        'by_part_matched': dict(Counter(part[n] for n in by_movie if n not in {u['movie'] for u in unmatched})),
        'keys_by_conf': dict(Counter(conf_of[k] for k in out)), 'args': vars(a), 'unmatched': unmatched}
json.dump(info, open(f'{a.out_dir}/review-match.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in info.items() if k != 'unmatched'}, ensure_ascii=False), file=sys.stderr)
print(f'не совпало {len(unmatched)}: ' + '; '.join(u['movie'] for u in unmatched[:60]), file=sys.stderr)
