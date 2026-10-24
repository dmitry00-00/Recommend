# Классификатор разметки на русском текстовом энкодере (23.10, research_notes/Табличные модели-основы/notes.md, §6.3 «Минимальный
# опыт 2»; инвентаризация — .cache/eval/markup-classifier-inventory-2310.md). Диагностика, а не замена: насколько эмбеддинг описания
# фильма воспроизводит разметку агентов-разметчиков (уровень, операции, предупреждения). Новой разметки не делает, сети не просит —
# кроме первой загрузки модели с Hugging Face (кэш HF — как настроен окружением).
# Вход: выгрузка tools/markup-encoder-export.mts → .cache/eval/markup-encoder/films.json (нет файла или --export — скрипт сам запустит
# `npx tsx` выгрузки, ~15 с). Фильмы — draftAnnotations + draftAnnotationsLinks с уверенностью high/medium и непустым текстом.
# Текст (источник пишется в textSrc): пачка заходов 17–19 (то, что видел агент) → «Сюжет»/вступление русской Википедии из кэша
# .cache/wiki-plots/ (статья по .cache/fame-wd.json, иначе по названию) → пересказы plot-summaries/CMU → blurb карточки.
# Вход энкодера: «Название (оригинал), год. Жанры: …» + текст, обрезанный до --max-chars знаков; префикс модели «classification: ».
# Эмбеддинги считаются один раз и копятся в .cache/eval/markup-encoder/emb-<модель>-….npz (ключ + sha1 входа; прерванный прогон
# продолжает с места). Модель — deepvk/USER2-base (Apache 2.0, 149M, 768).
# Части — 5 по группам (GroupKFold): связи Wikidata из src/mocks/workRelations.ts (франшиза, цикл, сиквел, ремейк, экранизация;
# узлы-«хабы» шире --hub связей не склеивают) и режиссёр (workCredits, роль d — элемент Wikidata; нет — первое имя creators)
# склеиваются в одну компоненту; без связей и режиссёра фильм — сам себе группа. Так сиквелы и фильмы одного режиссёра не
# протекают между частями.
# Признаки: meta — год, десятилетие, жанры multi-hot, страны (первая и все, частые), длительность, log разделов Википедии, флаги
# пропусков; emb — эмбеддинг; emb+meta — оба. Модели — логрегрессия (уровень ещё и ridge с округлением), учатся на 4 частях;
# C логрегрессии выбирается на цель по внутреннему разбиению обучающей части первой части (--C auto), alpha ridge — RidgeCV.
#   ~/.venvs/recomend-tabfm/bin/python -I tools/markup-encoder.py [--limit 300] [--device cpu|mps] [--batch 16] [--max-chars 1500]
#        [--max-tokens 512] [--model deepvk/USER2-base] [--conf high,medium] [--C auto|число] [--hub 100] [--min-pos 25] [--barriers] [--rule-registers]
#        [--export] [--seed 1] [--extra-text derived/review-text.json --text-mode base,reviews,both [--rev-chars 750]]
# Дополнительный текст (24.10, опыт с рецензиями Кинопоиска 2004–2012 — tools/kp-reviews-text.py, только внутренний): --extra-text
# {key: {text, …}} сужает опыт до фильмов, у которых он есть, и --text-mode задаёт, что подавать энкодеру: base — описание (как без
# опции), reviews — заголовок + только выжимка рецензий, both — описание + рецензии в пределах --max-chars (рецензиям --rev-chars,
# недобранное описанием — им же). Несколько режимов через запятую — сравнение на одном подмножестве и одних частях в одном прогоне:
# наборы признаков emb/rev/both и каждый +meta. Кэш у режима свой файл (…-reviews.npz, …-both.npz); base берёт общий кэш.
# Итог с --extra-text — …-<ддмм>-extra-<режимы>.md, общий итог дня не затирается.
# Итог — .cache/eval/markup-encoder-<ддмм>[-n<limit>].md и .json. Запускать из корня репозитория, с nice; тяжёлое — по одному.
import argparse, hashlib, json, math, os, re, resource, subprocess, sys, time
from collections import Counter, defaultdict
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--data', default='.cache/eval/markup-encoder/films.json')
ap.add_argument('--export', action='store_true', help='перевыгрузить films.json (npx tsx tools/markup-encoder-export.mts)')
ap.add_argument('--model', default='deepvk/USER2-base')
ap.add_argument('--prompt', default='classification: ')
ap.add_argument('--device', default='cpu', choices=['cpu', 'mps'])
ap.add_argument('--batch', type=int, default=16)
ap.add_argument('--max-chars', type=int, default=1500)
ap.add_argument('--max-tokens', type=int, default=512)
ap.add_argument('--conf', default='high,medium')
ap.add_argument('--limit', type=int, default=0, help='случайные N фильмов (детерминированно по --seed)')
ap.add_argument('--folds', type=int, default=5)
ap.add_argument('--hub', type=int, default=100)
ap.add_argument('--min-pos', type=int, default=25, help='бинарную цель брать, если положительных хотя бы столько')
ap.add_argument('--C', default='auto', help="сила L2 логрегрессии: число или auto — выбор из --C-grid по log-loss на внутреннем разбиении (группы) обучающей части первой части")
ap.add_argument('--C-grid', default='0.001,0.003,0.01,0.03,0.1,0.3,1')
ap.add_argument('--barriers', action='store_true', help='ещё и барьеры (по заданию не нужны)')
ap.add_argument('--rule-registers', action='store_true', help='регистры правила — только для сравнения, это не разметка агентов')
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--out', default=None)
ap.add_argument('--extra-text', default=None, help='(24.10) {key: {text}} — доп. текст (рецензии); опыт сужается до фильмов с ним')
ap.add_argument('--text-mode', default='base', help='base|reviews|both, можно через запятую — сравнить в одном прогоне')
ap.add_argument('--rev-chars', type=int, default=0, help='both: знаков рецензиям из --max-chars (0 — половина)')
ap.add_argument('--dump', default=None, help='(23.10) оценки по фильмам вне части (emb+meta) — для перепроверки разметки: tools/markup-recheck.mts')
a = ap.parse_args()
MODES = a.text_mode.split(',')
assert MODES and all(x in ('base', 'reviews', 'both') for x in MODES) and len(set(MODES)) == len(MODES), f'--text-mode: {a.text_mode}'
assert a.extra_text or MODES == ['base'], '--text-mode reviews/both — только с --extra-text'
t0 = time.time()
log = lambda *m: print(f'{time.time() - t0:7.1f} с', *m, file=sys.stderr, flush=True)
rss_gb = lambda: resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 2**30  # macOS: байты
TAG = time.strftime('%d%m') + (f'-n{a.limit}' if a.limit else '') + (f'-extra-{"_".join(MODES)}' if a.extra_text else '')
OUT = a.out or f'.cache/eval/markup-encoder-{TAG}'
CACHE = os.path.dirname(a.data)

# ---------- данные ----------
if a.export or not os.path.exists(a.data):
    log('выгрузка: npx tsx tools/markup-encoder-export.mts')
    subprocess.run(['npx', 'tsx', 'tools/markup-encoder-export.mts', '--out', a.data], check=True)
D = json.load(open(a.data))
confs = set(a.conf.split(','))
allF = [f for f in D['films'] if f['label']['confidence'] in confs]
noText = sum(1 for f in allF if not f['text'].strip())
F = [f for f in allF if f['text'].strip()]
log(f'фильмов с разметкой {len(D["films"])}, уверенность {a.conf}: {len(allF)}, без текста {noText}, в опыте {len(F)}')
XT = {}
if a.extra_text:
    XT = {k: v['text'] for k, v in json.load(open(a.extra_text)).items() if v.get('text', '').strip()}
    F = [f for f in F if f['key'] in XT]
    log(f'--extra-text {a.extra_text}: доп. текст у {len(XT)} ключей, в опыте {len(F)}; режимы {MODES}')
if a.limit and a.limit < len(F):
    rng = np.random.default_rng(a.seed)
    F = [F[i] for i in sorted(rng.choice(len(F), a.limit, replace=False))]
    log(f'--limit: случайные {len(F)}')
N = len(F)

def cut(t, m):
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) <= m: return t
    c = t[:m]; e = max(c.rfind('. '), c.rfind('! '), c.rfind('? '))
    return c[:e + 1] if e > m / 3 else c.rsplit(' ', 1)[0] + '…'

def enc_input(f, mode='base'):
    head = f['title'] or f['orig']
    if f['orig'] and f['orig'] != f['title']: head += f' ({f["orig"]})'
    if f['year']: head += f', {f["year"]}'
    g = f'. Жанры: {", ".join(f["genres"])}' if f['genres'] else ''
    if mode == 'base': return f'{head}{g}.\n{cut(f["text"], a.max_chars)}'
    if mode == 'reviews': return f'{head}{g}.\nОтзывы зрителей: {cut(XT[f["key"]], a.max_chars)}'
    # both: описанию — max_chars − rev_chars, рецензиям — остальное (и недобранное описанием)
    base = cut(f['text'], a.max_chars - (a.rev_chars or a.max_chars // 2))
    return f'{head}{g}.\n{base}\nОтзывы зрителей: {cut(XT[f["key"]], a.max_chars - len(base))}'

texts = [enc_input(f) for f in F]
tlen = np.array([len(cut(f['text'], a.max_chars)) for f in F])
fame = np.array([np.nan if f['fame'] is None else f['fame'] for f in F], dtype=float)

# ---------- эмбеддинги (кэш) ----------
slug = re.sub(r'[^a-zA-Z0-9]+', '_', a.model).strip('_')
pslug = re.sub(r'[^a-z]+', '', a.prompt) or 'none'
_model = None
def embed(texts, mode):
    # у режима свой файл кэша (base — общий); ключ записи — ключ фильма + sha1 входа, так что другой текст не спутается и внутри файла
    global _model
    emb_file = f'{CACHE}/emb-{slug}-{pslug}-c{a.max_chars}-t{a.max_tokens}' + ('' if mode == 'base' else f'-{mode}') + '.npz'
    h = [hashlib.sha1(t.encode()).hexdigest()[:16] for t in texts]
    have = {}
    if os.path.exists(emb_file):
        z = np.load(emb_file, allow_pickle=False)
        for k, hh, v in zip(z['keys'], z['hashes'], z['vecs']): have[(str(k), str(hh))] = v
    need = [i for i, f in enumerate(F) if (f['key'], h[i]) not in have]
    st = {'computed': len(need), 'cached': N - len(need), 'seconds': 0.0, 'device': a.device, 'batch': a.batch, 'file': emb_file}
    if need:
        from sentence_transformers import SentenceTransformer
        import torch
        torch.set_num_threads(max(1, (os.cpu_count() or 4) // 2))
        log(f'[{mode}] модель {a.model} на {a.device}; считать {len(need)}, в кэше {N - len(need)}')
        if _model is None:
            _model = SentenceTransformer(a.model, device=a.device)
            _model.max_seq_length = a.max_tokens
        m = _model
        ntok = [len(m.tokenizer(texts[i], truncation=True, max_length=a.max_tokens)['input_ids']) for i in need[:200]]
        st['tokens_median_first200'] = int(np.median(ntok))
        st['truncated_share_first200'] = round(float(np.mean([n >= a.max_tokens for n in ntok])), 3)
        s = time.time()
        CH = 1024
        def save():
            ks = sorted(have)
            tmp = emb_file + '.tmp.npz'
            np.savez(tmp, keys=np.array([k for k, _ in ks]), hashes=np.array([x for _, x in ks]), vecs=np.stack([have[k] for k in ks]).astype(np.float32))
            os.replace(tmp, emb_file)
        for j in range(0, len(need), CH):
            idx = need[j:j + CH]
            V = m.encode([texts[i] for i in idx], batch_size=a.batch, prompt=a.prompt, normalize_embeddings=True, show_progress_bar=False, convert_to_numpy=True)
            for i, v in zip(idx, V): have[(F[i]['key'], h[i])] = v.astype(np.float32)
            save()
            done = j + len(idx)
            log(f'  [{mode}] эмбеддинги {done}/{len(need)}, {done / (time.time() - s):.1f} текстов/с, пик памяти процесса {rss_gb():.2f} ГБ')
        st['seconds'] = round(time.time() - s, 1)
        st['per_text_s'] = round(st['seconds'] / len(need), 4)
    E = np.stack([have[(f['key'], h[i])] for i, f in enumerate(F)])
    log(f'[{mode}] эмбеддинги {E.shape}')
    return E, st

EMB_NAME = {'base': 'emb', 'reviews': 'rev', 'both': 'both'}
EMBS, enc_by_mode = {}, {}
for mode in MODES:
    EMBS[EMB_NAME[mode]], enc_by_mode[mode] = embed(texts if mode == 'base' else [enc_input(f, mode) for f in F], mode)
_mlen = {mode: int(np.median([len(enc_input(f, mode)) for f in F])) for mode in MODES}
enc_stats = {k: sum(v[k] for v in enc_by_mode.values()) for k in ('computed', 'cached', 'seconds')} | {'device': a.device, 'batch': a.batch, 'by_mode': enc_by_mode, 'input_chars_median': _mlen}

# ---------- группы и части ----------
par = {}
def find(x):
    par.setdefault(x, x)
    while par[x] != x:
        par[x] = par[par[x]]; x = par[x]
    return x
def union(x, y): par[find(x)] = find(y)
deg = Counter(b for _, _, b in D['edges'])
for f in F:
    find(f['key'])
    if f['qid']: union(f['key'], 'q:' + f['qid'])
    d = 'd:' + f['directors'][0] if f['directors'] else ('n:' + f['creatorName'].lower().strip() if f['creatorName'].strip() else None)
    if d: union(f['key'], d)
for x, kind, y in D['edges']:
    if deg[y] > a.hub: continue
    union('q:' + x, 'q:' + y)
groups = np.array([find(f['key']) for f in F])
gsize = Counter(groups)
from sklearn.model_selection import GroupKFold
gkf = GroupKFold(n_splits=a.folds, shuffle=True, random_state=a.seed)
fold = np.zeros(N, dtype=int)
for k, (_, te) in enumerate(gkf.split(np.zeros(N), groups=groups)): fold[te] = k
split_info = {'groups': len(gsize), 'singletons': sum(1 for v in gsize.values() if v == 1), 'largest': sorted(gsize.values(), reverse=True)[:5],
              'fold_sizes': np.bincount(fold).tolist(), 'hub': a.hub}
log(f'групп {split_info["groups"]}, одиночек {split_info["singletons"]}, крупнейшие {split_info["largest"]}, части {split_info["fold_sizes"]}')

# ---------- мета-признаки (база без текста) ----------
GEN = sorted({g for f in F for g in f['genres']})
cc = Counter(c for f in F for c in f['countries'])
CTR = [c for c, n in cc.most_common(30) if n >= 3]
def meta_row(f):
    y = f['year'] or np.nan
    r = [0 if np.isnan(y) else (y - 1990) / 30, float(np.isnan(y))]
    r += [float(not np.isnan(y) and d <= y < d + 10) for d in range(1900, 2030, 10)]
    r += [float(g in f['genres']) for g in GEN] + [float(not f['genres'])]
    first = f['countries'][0] if f['countries'] else None
    r += [float(first == c) for c in CTR] + [float(c in f['countries']) for c in CTR] + [float(not f['countries'])]
    r += [math.log1p(f['dur']) if f['dur'] else 0.0, float(not f['dur'])]
    r += [math.log1p(f['fame']) if f['fame'] is not None else 0.0, float(f['fame'] is None)]
    return r
M = np.array([meta_row(f) for f in F], dtype=np.float32)
FEATS = {'meta': M}
for _n, _E in EMBS.items(): FEATS[_n] = _E
for _n, _E in EMBS.items(): FEATS[_n + '+meta'] = np.hstack([_E, M])

from sklearn.linear_model import LogisticRegression, RidgeCV
from sklearn.metrics import log_loss
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import f1_score, roc_auc_score, average_precision_score, cohen_kappa_score
from scipy.stats import spearmanr

def oof(X, fit_pred):
    out = None
    for k in range(a.folds):
        tr, te = fold != k, fold == k
        sc = StandardScaler().fit(X[tr])
        p = fit_pred(sc.transform(X[tr]), sc.transform(X[te]), tr)
        if out is None: out = np.zeros((N,) + p.shape[1:])
        out[te] = p
    return out

def coverage(conf, ok, targets=(0.9, 0.95), min_k=20):
    # доля фильмов (самые уверенные первыми), на которой согласие с агентом не ниже цели; нет такой доли — 0
    o = np.argsort(-conf, kind='stable'); acc = np.cumsum(ok[o]) / np.arange(1, len(o) + 1)
    res = {}
    for t in targets:
        good = np.where((acc >= t) & (np.arange(1, len(o) + 1) >= min_k))[0]
        res[f'{int(t * 100)}'] = round(float((good[-1] + 1) / len(o)), 3) if len(good) else 0.0
    return res

# ---------- цели ----------
lab = [f['label'] for f in F]
level = np.array([l['level'] for l in lab])
OPS = ['perspective_taking', 'causal_reasoning', 'critical_analysis', 'pattern_recognition', 'abstraction', 'analogical_thinking', 'metacognition', 'synthesis']
top_op = np.array([max(l['ops'], key=lambda x: x[1])[0] if l['ops'] else 'none' for l in lab])
binaries = {}
for o in OPS: binaries[f'op:{o}'] = np.array([any(x[0] == o for x in l['ops']) for l in lab])
for w, _ in Counter(w for l in lab for w in l['warnings']).most_common(): binaries[f'warn:{w}'] = np.array([w in l['warnings'] for l in lab])
if a.barriers:
    for b, _ in Counter(b for l in lab for b in l['barriers']).most_common(): binaries[f'bar:{b}'] = np.array([b in l['barriers'] for l in lab])
if a.rule_registers:
    for r, _ in Counter(r for f in F for r in f['registers']).most_common(): binaries[f'reg(правило):{r}'] = np.array([r in f['registers'] for f in F])
skipped = {k: int(v.sum()) for k, v in binaries.items() if v.sum() < a.min_pos or (~v).sum() < a.min_pos}
binaries = {k: v for k, v in binaries.items() if k not in skipped}
n_by_target = {'level': N, 'top_op': N, **{k: N for k in binaries}}

def lr(C, **kw): return LogisticRegression(C=C, max_iter=3000, **kw)
# выбор C: один раз на цель и набор признаков; внутреннее разбиение по тем же группам внутри обучающей части первой части
_tr0 = np.where(fold != 0)[0]
_in_tr, _in_va = next(GroupKFold(n_splits=4, shuffle=True, random_state=a.seed + 7).split(_tr0, groups=groups[_tr0]))
_in_tr, _in_va = _tr0[_in_tr], _tr0[_in_va]
chosen_C = {}
def pick_C(X, y, tag, **kw):
    if a.C != 'auto': return float(a.C)
    sc = StandardScaler().fit(X[_in_tr]); Xt, Xv = sc.transform(X[_in_tr]), sc.transform(X[_in_va])
    best = None
    for C in [float(c) for c in a.C_grid.split(',')]:
        m = lr(C, **kw).fit(Xt, y[_in_tr])
        cls = np.unique(y); P = np.full((len(Xv), len(cls)), 1e-6); P[:, np.searchsorted(cls, m.classes_)] = m.predict_proba(Xv)
        ll = log_loss(y[_in_va], P / P.sum(1, keepdims=True), labels=cls)
        if best is None or ll < best[0]: best = (ll, C)
    chosen_C[tag] = best[1] if best else 1.0
    return chosen_C[tag]
def level_metrics(pred, mask=None):
    mk = np.ones(N, bool) if mask is None else mask
    p, y = pred[mk], level[mk]
    if len(y) < 5: return None
    d = np.abs(p - y)
    rho = spearmanr(p, y).statistic if len(set(p)) > 1 else float('nan')
    hi = y >= 6
    return {'n': int(len(y)), 'mae': round(float(d.mean()), 3), 'exact': round(float((d == 0).mean()), 3), 'pm1': round(float((d <= 1).mean()), 3),
            'spearman': round(float(rho), 3), 'recall6+': round(float((p[hi] >= 6).mean()), 3) if hi.sum() else None, 'n6+': int(hi.sum())}

R = {'args': vars(a), 'n': N, 'n_all_conf': len(allF), 'no_text': noText, 'text_src': Counter(f['textSrc'] for f in F), 'by': Counter(str(f['label']['by']) for f in F),
     'encoder': enc_stats, 'split': split_info, 'n_by_target': n_by_target, 'skipped_binaries': skipped, 'level': {}, 'top_op': {}, 'binary': {}, 'slices': {}, 'coverage': {}}
base_level = {'3 всем': level_metrics(np.full(N, 3)), 'медиана обучающих частей': level_metrics(oof(M[:, :1], lambda Xt, Xs, tr: np.full(len(Xs), np.median(level[tr]))))}
R['level']['база'] = base_level
preds = {}
for name, X in FEATS.items():
    s = time.time()
    alphas = []
    def rfit(Xt, Xs, tr):
        m = RidgeCV(alphas=np.logspace(-1, 4.5, 12)).fit(Xt, level[tr]); alphas.append(float(m.alpha_)); return m.predict(Xs)
    ridge = oof(X, rfit)
    chosen_C[f'ridge_alpha/{name}'] = alphas
    r_round = np.clip(np.rint(ridge), 1, 10)
    classes = np.unique(level)
    C_lv = pick_C(X, level, f'level/{name}')
    def mc(Xt, Xs, tr):
        m = lr(C_lv).fit(Xt, level[tr]); P = np.zeros((len(Xs), len(classes))); P[:, np.searchsorted(classes, m.classes_)] = m.predict_proba(Xs); return P
    P = oof(X, mc)
    arg = classes[P.argmax(1)]
    # уверенность «±1»: лучшее окно из трёх соседних уровней
    win = np.stack([P[:, max(0, j - 1):j + 2].sum(1) for j in range(len(classes))], 1)
    wc = classes[win.argmax(1)]
    R['level'][name] = {'ridge_round': level_metrics(r_round), 'ridge_raw_mae': round(float(np.abs(ridge - level).mean()), 3), 'logreg': level_metrics(arg)}
    R['coverage'][f'level/{name}'] = {'exact': coverage(P.max(1), arg == level), 'pm1': coverage(win.max(1), np.abs(wc - level) <= 1)}
    # главная операция — top-1
    ops_cls = np.unique(top_op)
    C_op = pick_C(X, top_op, f'top_op/{name}')
    def mo(Xt, Xs, tr):
        m = lr(C_op).fit(Xt, top_op[tr]); Q = np.zeros((len(Xs), len(ops_cls))); Q[:, np.searchsorted(ops_cls, m.classes_)] = m.predict_proba(Xs); return Q
    Q = oof(X, mo); top_pred = ops_cls[Q.argmax(1)]
    R['top_op'][name] = {'acc': round(float((top_pred == top_op).mean()), 3), 'macro_f1': round(float(f1_score(top_op, top_pred, average='macro')), 3)}
    R['coverage'][f'top_op/{name}'] = coverage(Q.max(1), top_pred == top_op)
    preds[name] = {'level': r_round, 'top_op': top_pred, 'bin': {}, 'ridge': ridge, 'top_conf': Q.max(1), 'top_actual_p': Q[np.arange(N), np.searchsorted(ops_cls, top_op)]}
    for k, y in binaries.items():
        Cb = pick_C(X, y, f'{k}/{name}', class_weight='balanced')
        p = oof(X, lambda Xt, Xs, tr: lr(Cb, class_weight='balanced').fit(Xt, y[tr]).predict_proba(Xs)[:, 1])
        yhat = p >= 0.5
        R['binary'].setdefault(k, {'pos_share': round(float(y.mean()), 3), 'n_pos': int(y.sum())})[name] = {
            'f1': round(float(f1_score(y, yhat)), 3), 'auc': round(float(roc_auc_score(y, p)), 3), 'ap': round(float(average_precision_score(y, p)), 3),
            'kappa': round(float(cohen_kappa_score(y, yhat)), 3), 'cover': coverage(np.abs(p - 0.5), yhat == y)}
        preds[name]['bin'][k] = p
    log(f'{name}: уровень ±1 {R["level"][name]["ridge_round"]["pm1"]}, MAE {R["level"][name]["ridge_round"]["mae"]}; главная операция {R["top_op"][name]["acc"]}; {time.time() - s:.0f} с')
R['top_op']['база: самая частая'] = {'acc': round(float((top_op == Counter(top_op).most_common(1)[0][0]).mean()), 3)}

# ---------- разрезы: длина текста, известность, источник текста, источник разметки ----------
def bins_len(x): return np.select([x < 300, x < 700, x < 1200], ['<300', '300–699', '700–1199'], '1200+')
def bins_fame(x): return np.select([np.isnan(x), x < 10, x < 30], ['нет', '1–9', '10–29'], '30+')
viol = 'warn:Насилие' if 'warn:Насилие' in binaries else None
for sname, key in [('длина текста', bins_len(tlen)), ('разделы Википедии', bins_fame(fame)), ('источник текста', np.array([f['textSrc'] for f in F])),
                   ('разметка по', np.array([str(f['label']['by']) for f in F]))]:
    out = {}
    ORDER = ['<300', '300–699', '700–1199', '1200+', 'нет', '1–9', '10–29', '30+']
    for b in sorted(set(key), key=lambda b: (ORDER.index(b) if b in ORDER else 99, b)):
        mk = key == b
        if mk.sum() < 10: continue
        row = {'n': int(mk.sum())}
        for name in FEATS:
            lm = level_metrics(preds[name]['level'], mk)
            row[name] = {'mae': lm['mae'], 'pm1': lm['pm1'], 'top_op': round(float((preds[name]['top_op'][mk] == top_op[mk]).mean()), 3)}
            if viol and 0 < binaries[viol][mk].sum() < mk.sum():
                row[name]['auc_violence'] = round(float(roc_auc_score(binaries[viol][mk], preds[name]['bin'][viol][mk])), 3)
            aucs = [roc_auc_score(y[mk], preds[name]['bin'][k][mk]) for k, y in binaries.items() if 3 <= y[mk].sum() <= mk.sum() - 3]
            row[name]['auc_macro'] = round(float(np.mean(aucs)), 3) if aucs else None
        out[b] = row
    R['slices'][sname] = out
R['chosen_C'] = chosen_C
R['seconds'] = round(time.time() - t0, 1); R['peak_rss_gb'] = round(rss_gb(), 2)

# ---------- отчёт ----------
def default(o):
    if isinstance(o, (np.integer,)): return int(o)
    if isinstance(o, (np.floating,)): return float(o)
    if isinstance(o, Counter): return dict(o)
    raise TypeError(type(o))
json.dump(R, open(OUT + '.json', 'w'), ensure_ascii=False, indent=1, default=default)
if a.dump and 'emb+meta' in preds:
    # перепроверка (23.10, слово владельца): предсказание вне части — модель фильм не видела; расхождение с разметкой
    # само по себе не ошибка, а повод перечитать
    pr = preds['emb+meta']
    rows = [{'key': f['key'], 'level': int(level[i]), 'ridge': round(float(pr['ridge'][i]), 2), 'top_op': str(top_op[i]),
             'top_pred': str(pr['top_op'][i]), 'top_conf': round(float(pr['top_conf'][i]), 3), 'top_actual_p': round(float(pr['top_actual_p'][i]), 3),
             'ops': {k[3:]: round(float(v[i]), 3) for k, v in pr['bin'].items() if k.startswith('op:')}, 'by': str(f['label']['by']), 'textSrc': f['textSrc']}
            for i, f in enumerate(F)]
    json.dump(rows, open(a.dump, 'w'), ensure_ascii=False)
    log(f'оценки по фильмам: {a.dump} ({len(rows)})')
KAPPA = list(EMBS)[0] + '+meta'
L = [f'# Классификатор разметки на энкодере {a.model} — {time.strftime("%d.%m.%Y")}' + (f' (пробный, --limit {a.limit})' if a.limit else ''), '',
     f'Скрипт: `tools/markup-encoder.py` (выгрузка — `tools/markup-encoder-export.mts`). Фильмов в опыте **{N}** (уверенность {a.conf}: {len(allF)}, без текста {noText}).',
     f'Части: {a.folds} по группам (франшиза/связи Wikidata + режиссёр одной компонентой): групп {split_info["groups"]}, крупнейшие {split_info["largest"]}, размеры частей {split_info["fold_sizes"]}.',
     f'Источник текста: {dict(R["text_src"])}. Разметка по: {dict(R["by"])}.',
     *([f'Доп. текст: `{a.extra_text}` (у {len(XT)} ключей), опыт сужен до фильмов с ним; режимы {MODES} → наборы {list(EMBS)}; '
        f'медиана длины входа, знаков: {_mlen}' + (f'; both: рецензиям {a.rev_chars or a.max_chars // 2} из {a.max_chars}' if 'both' in MODES else '') + '.']
       if a.extra_text else []),
     f'Энкодер: посчитано {enc_stats["computed"]}, из кэша {enc_stats["cached"]}, {enc_stats["seconds"]} с на {a.device} (batch {a.batch}, до {a.max_tokens} токенов, {a.max_chars} знаков).',
     f'Весь прогон {R["seconds"]} с, пик памяти процесса {R["peak_rss_gb"]} ГБ.',
     'C логрегрессии (выбор по log-loss, медиана по целям): ' + ', '.join(f'{n} {np.median([v for t, v in chosen_C.items() if t.endswith("/" + n) and not t.startswith("ridge")]):g}' for n in FEATS)
     + '; alpha ridge: ' + ', '.join(f'{n} {np.median(chosen_C["ridge_alpha/" + n]):g}' for n in FEATS) + '.', '',
     'Агент ↔ агент (калибровка, n = 46, советская классика): уровень точно 74%, ±1 100%, MAE 0,26, Спирмен 0,96; главная операция 85%; κ(Насилие) 0,83.', '',
     '## Уровень сложности', '', '| признаки | модель | MAE | точно | ±1 | Спирмен | 6+ найдено |', '|---|---|---|---|---|---|---|']
for nm, v in base_level.items(): L.append(f'| база | {nm} | {v["mae"]} | {v["exact"]} | {v["pm1"]} | — | {v["recall6+"]} |')
for name in FEATS:
    for mn, key in [('ridge + округление', 'ridge_round'), ('логрегрессия', 'logreg')]:
        v = R['level'][name][key]; L.append(f'| {name} | {mn} | {v["mae"]} | {v["exact"]} | {v["pm1"]} | {v["spearman"]} | {v["recall6+"]} (из {v["n6+"]}) |')
L += ['', '## Главная операция (top-1)', '', '| признаки | точность | macro-F1 |', '|---|---|---|']
for name, v in R['top_op'].items(): L.append(f'| {name} | {v["acc"]} | {v.get("macro_f1", "—")} |')
L += ['', '## Бинарные цели (логрегрессия, class_weight=balanced, порог 0,5)', '', '| цель | доля + | ' + ' | '.join(f'{n} F1 / AUC' for n in FEATS) + f' | κ {KAPPA} |', '|---|---|' + '---|' * len(FEATS) + '---|']
for k, v in R['binary'].items(): L.append(f'| {k} | {v["pos_share"]} ({v["n_pos"]}) | ' + ' | '.join(f'{v[n]["f1"]} / {v[n]["auc"]}' for n in FEATS) + f' | {v[KAPPA]["kappa"]} |')
if skipped: L += ['', f'Пропущены (меньше {a.min_pos} положительных или отрицательных): ' + ', '.join(f'{k} ({n})' for k, n in skipped.items())]
L += ['', '## Уверенные случаи: какую долю можно отдать автоматом', '',
      'Самые уверенные первыми; доля фильмов, на которой согласие с агентом ≥ 90% / 95% (не меньше 20 фильмов). У редких бинарных меток высокая доля',
      'получается и у «всегда нет» — смотреть рядом с долей положительных.', '', '| цель | ' + ' | '.join(f'{n} 90% / 95%' for n in FEATS) + ' |', '|---|' + '---|' * len(FEATS)]
for t in ['level:exact', 'level:pm1', 'top_op']:
    cells = []
    for n in FEATS:
        c = R['coverage'][f'level/{n}'][t.split(':')[1]] if t.startswith('level') else R['coverage'][f'top_op/{n}']
        cells.append(f'{c["90"]} / {c["95"]}')
    L.append(f'| {t} | ' + ' | '.join(cells) + ' |')
for k, v in R['binary'].items(): L.append(f'| {k} (большинство {round(max(v["pos_share"], 1 - v["pos_share"]), 3)}) | ' + ' | '.join(f'{v[n]["cover"]["90"]} / {v[n]["cover"]["95"]}' for n in FEATS) + ' |')
for sname, rows in R['slices'].items():
    L += ['', f'## Разрез: {sname}', '', '| корзина | n | ' + ' | '.join(f'{n} ±1 / MAE / оп. / AUC(Нас.) / AUC ср.' for n in FEATS) + ' |', '|---|---|' + '---|' * len(FEATS)]
    for b, row in rows.items():
        L.append(f'| {b} | {row["n"]} | ' + ' | '.join(f'{row[n]["pm1"]} / {row[n]["mae"]} / {row[n]["top_op"]} / {row[n].get("auc_violence", "—")} / {row[n]["auc_macro"]}' for n in FEATS) + ' |')
open(OUT + '.md', 'w').write('\n'.join(L) + '\n')
log(f'итог → {OUT}.md, {OUT}.json; пик памяти {R["peak_rss_gb"]} ГБ')
