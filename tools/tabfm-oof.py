# Табличные модели-основы против нынешнего счёта (23.10, research_notes/Табличные модели-основы/notes.md): по выгрузке частей
# счёта (tools/taste-dump.mts → .cache/eval/dump-<tag>/) учит модели на чужих людях и пишет их счёт столбцами в копию выгрузки,
# а меры считает tools/taste-tune.mts — те же, что у прочих вариантов (варианты { name, weights: { <столбец>: 1 } }).
# Части — по людям (who целиком в одной части), 5 штук; цель — «спрятанное любимое против пула» (как цель b тюнера):
# любимые — 1, нелюбимые и --neg случайных из пула человека — 0. Пропуски (null) — как есть: деревья и модели-основы их знают.
# Модели-основы на CPU медленные, поэтому они переставляют только первые --top по LightGBM (у каждого человека); остальное —
# счёт LightGBM ниже них. Какая строка спрятана, при этом не важно: первые --top выбираются по LightGBM для всех строк одинаково.
# Лицензии: TabPFN — только веса v2 (Apache 2.0 + надпись «Built with PriorLabs-TabPFN»; 2.5 и новее — некоммерческие, их не
# берём), TabICL — BSD-3. Окружение вне репозитория: ~/.venvs/recomend-tabfm (torch, lightgbm, scikit-learn, tabpfn, tabicl).
#   ~/.venvs/recomend-tabfm/bin/python -I tools/tabfm-oof.py [--dump .cache/eval/dump-frozen] [--out .cache/eval/dump-frozen-tabfm]
#        [--models logreg,lgbm,rank,tabpfn,tabicl] [--neg 200] [--ctx 10000] [--top 1000] [--limit N — первые N файлов] [--seed 1]
# Дальше: npx tsx tools/taste-tune.mts --dump .cache/eval/dump-frozen-tabfm --variants .cache/eval/dump-frozen-tabfm/variants.json --train b
import argparse, json, os, random, sys, time
import numpy as np

# веса — только из кэша (24.10): пробный прогон 23.10 семь часов висел на запросе к Hugging Face без процессора.
# Кэш HF — на внешнем диске (~/.cache/huggingface → /Volumes/внешний/pg/hf-cache), веса TabPFN v2 и TabICL v2 там
os.environ.setdefault('HF_HUB_OFFLINE', '1')
# один поток OpenMP (24.10): LightGBM (libomp из brew) и torch (свой libomp) в одном процессе — две копии рантайма, и
# torch вис на барьере потоков (__kmp_join_barrier, 0% процессора) сразу после первого LightGBM — и в пробном, и в полном
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('KMP_DUPLICATE_LIB_OK', 'TRUE')

ap = argparse.ArgumentParser()
ap.add_argument('--dump', default='.cache/eval/dump-frozen')
ap.add_argument('--out', default=None)
ap.add_argument('--models', default='logreg,lgbm,rank,tabpfn,tabicl')
ap.add_argument('--feats', default='content,essay,anchor,register,level,ops,fame,famePenalty,worth,boost,consensus,popular,itemSim,year,loud,easeBin,easeLike')
ap.add_argument('--folds', type=int, default=5)
ap.add_argument('--neg', type=int, default=200)
ap.add_argument('--ctx', type=int, default=10000)
ap.add_argument('--top', type=int, default=1000)
ap.add_argument('--limit', type=int, default=0)
ap.add_argument('--seed', type=int, default=1)
a = ap.parse_args()
OUT = a.out or a.dump.rstrip('/') + '-tabfm'
MODELS = a.models.split(',')
FEATS = a.feats.split(',')
t0 = time.time()
log = lambda *m: print(f'{time.time() - t0:7.1f} с', *m, file=sys.stderr, flush=True)

files = sorted(f for f in os.listdir(a.dump) if f.endswith('.json'))
if a.limit: files = files[:a.limit]
people = []
for f in files:
    d = json.load(open(f'{a.dump}/{f}'))
    if not d.get('ok'): continue
    idx = [d['feats'].index(k) + 2 for k in FEATS]
    X = np.array([[np.nan if r[j] is None else r[j] for j in idx] for r in d['rows']], dtype=np.float32)
    y = np.array([0 if r[1] is None else r[1] for r in d['rows']], dtype=np.int8)
    people.append({'file': f, 'who': d['who'], 'X': X, 'y': y})
log(f'людей {len(people)}, строк {sum(len(p["y"]) for p in people)}, признаков {len(FEATS)}')

# части по людям: перемешивание детерминированное, как в тюнере (но своё — части не совпадают с его частями один в один)
whos = sorted({p['who'] for p in people})
random.Random(f'folds:{a.seed}').shuffle(whos)
part = {w: i % a.folds for i, w in enumerate(whos)}

def train_set(ps, rng):
    Xs, ys, gs = [], [], []
    for g, p in enumerate(ps):
        lab = np.where(p['y'] != 0)[0]
        pool = np.where(p['y'] == 0)[0]
        neg = rng.choice(pool, min(a.neg, len(pool)), replace=False)
        i = np.concatenate([lab, neg])
        Xs.append(p['X'][i]); ys.append((p['y'][i] == 1).astype(np.int8)); gs.append(np.full(len(i), g))
    return np.concatenate(Xs), np.concatenate(ys), np.concatenate(gs)

def fit_logreg(X, y):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    miss = np.isnan(X)
    Z = np.nan_to_num(X)
    sc = StandardScaler().fit(Z)
    m = LogisticRegression(C=1.0, max_iter=2000).fit(np.hstack([sc.transform(Z), miss]), y)
    return lambda Q: m.decision_function(np.hstack([sc.transform(np.nan_to_num(Q)), np.isnan(Q)]))

def fit_lgbm(X, y):
    import lightgbm as lgb
    m = lgb.LGBMClassifier(n_estimators=400, learning_rate=0.03, num_leaves=31, min_child_samples=40, subsample=0.8, subsample_freq=1,
                           colsample_bytree=0.8, reg_lambda=1.0, verbose=-1, random_state=a.seed)
    m.fit(X, y)
    return lambda Q: m.predict_proba(Q)[:, 1]

def fit_rank(X, y, g):
    import lightgbm as lgb
    o = np.argsort(g, kind='stable')
    m = lgb.LGBMRanker(n_estimators=400, learning_rate=0.03, num_leaves=31, min_child_samples=40, verbose=-1, random_state=a.seed)
    m.fit(X[o], y[o], group=np.bincount(g[o]))
    return lambda Q: m.predict(Q)

def ctx_sample(X, y, rng):
    if len(y) <= a.ctx: return X, y
    pos = np.where(y == 1)[0]; neg = np.where(y == 0)[0]
    k = min(len(pos), a.ctx // 3)
    i = np.concatenate([rng.choice(pos, k, replace=False), rng.choice(neg, a.ctx - k, replace=False)])
    return X[i], y[i]

def fit_tabpfn(X, y):
    from tabpfn import TabPFNClassifier
    try:
        from tabpfn.constants import ModelVersion
        m = TabPFNClassifier.create_default_for_version(ModelVersion.V2, device='cpu', ignore_pretraining_limits=True)
    except ImportError:
        m = TabPFNClassifier(device='cpu', ignore_pretraining_limits=True)
    m.fit(X, y)
    return lambda Q: m.predict_proba(Q)[:, 1]

def fit_tabicl(X, y):
    from tabicl import TabICLClassifier
    m = TabICLClassifier(device='cpu', random_state=a.seed)
    m.fit(X, y)
    return lambda Q: m.predict_proba(Q)[:, 1]

FOUNDATION = {'tabpfn': fit_tabpfn, 'tabicl': fit_tabicl}
score = {m: [np.zeros(len(p['y']), dtype=np.float64) for p in people] for m in MODELS}
times = {m: 0.0 for m in MODELS}
for f in range(a.folds):
    test = [i for i, p in enumerate(people) if part[p['who']] == f]
    train = [p for p in people if part[p['who']] != f]
    rng = np.random.default_rng(a.seed * 100 + f)
    X, y, g = train_set(train, rng)
    log(f'часть {f + 1}: учить {len(train)} людей, {len(y)} строк (любимых {int(y.sum())}); проверять {len(test)}')
    fitted = {}
    for m in MODELS:
        if m in FOUNDATION: continue
        s = time.time()
        fitted[m] = fit_logreg(X, y) if m == 'logreg' else fit_lgbm(X, y) if m == 'lgbm' else fit_rank(X, y, g)
        for i in test: score[m][i] = fitted[m](people[i]['X'])
        times[m] += time.time() - s
    first = fitted.get('lgbm') or fit_lgbm(X, y)
    Xc, yc = ctx_sample(X, y, rng)
    for m in [m for m in MODELS if m in FOUNDATION]:
        s = time.time()
        try:
            pred = FOUNDATION[m](Xc, yc)
        except Exception as e:
            log(f'{m}: не завелась — {type(e).__name__}: {e}'); MODELS.remove(m); del score[m]; continue
        for i in test:
            base = first(people[i]['X'])
            top = np.argsort(-base, kind='stable')[:a.top]
            out = base.copy()
            out[top] = 2 + pred(people[i]['X'][top])
            score[m][i] = out
        times[m] += time.time() - s
        log(f'  {m}: {time.time() - s:.0f} с')

# копия выгрузки с новыми столбцами в конце feats и строк
os.makedirs(OUT, exist_ok=True)
for i, p in enumerate(people):
    d = json.load(open(f'{a.dump}/{p["file"]}'))
    d['feats'] = d['feats'] + [f'tf_{m}' for m in MODELS]
    for j, r in enumerate(d['rows']): r.extend(round(float(score[m][i][j]), 8) for m in MODELS)
    d['tabfmFill'] = {'by': 'tools/tabfm-oof.py', 'models': MODELS, 'feats': FEATS, 'neg': a.neg, 'ctx': a.ctx, 'top': a.top, 'folds': a.folds, 'seed': a.seed}
    tmp = f'{OUT}/{p["file"]}.tmp'
    with open(tmp, 'w') as fh: json.dump(d, fh, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, f'{OUT}/{p["file"]}')
json.dump([{'name': f'tf_{m}', 'weights': {f'tf_{m}': 1}} for m in MODELS], open(f'{OUT}/variants.json', 'w'), indent=1)
log('время по моделям: ' + ', '.join(f'{m} {t:.0f} с' for m, t in times.items() if m in MODELS))
log(f'готово → {OUT}')
