"""Признаки формы сценария (внутренний опыт 24.10, «сценарии против разметки»; в продукт и в git не идёт).

Сценарии IMSDb лежат вне репозитория: /Volumes/внешний/datasets/imsdb/*.txt («for educational purposes only»,
права у студий). Этот файл — только код разбора, текста сценариев здесь нет и в выход он не попадает:
в features.json — числа и названия локаций/персонажей не пишутся.

Запуск (лёгкое, только numpy):
  python3 -I tools/screenplay-features.py            # признаки -> derived/features.json
  python3 -I tools/screenplay-features.py analyze    # сопоставление с разметкой -> derived/analysis.json
  python3 -I tools/screenplay-features.py inspect FILE.txt   # отладка разбора одного файла
"""
import collections, html, json, math, os, re, sys

DATA = "/Volumes/внешний/datasets/imsdb"
OUT = f"{DATA}/derived"
FILMS = "/Users/dmitrij/recomend/.cache/eval/markup-encoder/films.json"
OOF = "/Users/dmitrij/recomend/.cache/eval/markup-encoder/oof-2410.json"

# ---------- разбор ----------

HEAD = re.compile(
    r"^(?:(?:SCENE|SEQ\.?|SC\.?)\s*\d+\w*\s*[-.:]*\s*|\d+[A-Z]?\.?\s*|[A-Z]?\d+[A-Z]?\s*[-.)]\s*)?"
    r"(INT\.?\s*/\s*EXT|EXT\.?\s*/\s*INT|INT\.?\s*&\s*EXT|EXT\.?\s*&\s*INT|I/E|E/I|INTERIOR|EXTERIOR|INT|EXT)"
    r"(?=[\s.:/,-])[\s.:/,-]*")
TRANS = re.compile(r"(\bTO:?$|^FADE\b|^CUT\b|^DISSOLVE|^SMASH|^MATCH CUT|^WIPE|^IRIS|^THE END\b|^END\b|^CONTINUED|"
                   r"\(CONTINUED\)|^\(?MORE\)?$|^CONT'?D|^OMIT|^TRANSITION|^FREEZE FRAME|^TITLE CARD|^BLACK\.?$)")
SHOT = re.compile(r"^(CLOSE|EXTREME|ANGLE|ANOTHER ANGLE|NEW ANGLE|REVERSE|POV\b|.*'S POV|HIS POV|HER POV|INSERT|WIDE|"
                  r"FULL SHOT|MEDIUM|TWO SHOT|TRACKING|PULLING|PUSHING|PAN\b|TILT|CRANE|AERIAL|HIGH ANGLE|LOW ANGLE|"
                  r"ON |BACK ON|BACK TO|OVER |UNDER |SERIES OF|MONTAGE|SUPER|SUPERIMPOSE|TITLE|CREDITS|MAIN TITLE|"
                  r"LATER|MOMENTS LATER|SAME|CONTINUOUS|INTERCUT|SPLIT SCREEN|SLOW MOTION|DREAM|FLASHBACK|END OF|"
                  r"THE SCREEN|SCREEN|SOUND|MUSIC|SILENCE|DARKNESS|BLACK|WHITE|NIGHT|DAY|DAWN|DUSK|MORNING|EVENING|"
                  r"SHOT|VIEW|FAVORING|OUR VIEW|CAMERA|STOCK|ESTABLISHING|SFX|VFX|NOTE)")
TIME = re.compile(r"^(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DUSK|DAWN|SUNSET|SUNRISE|NOON|MIDNIGHT|LATE|EARLY|LATER|"
                  r"CONTINUOUS|SAME|SAME TIME|MOMENTS LATER|A MOMENT LATER|MINUTES LATER|SECONDS LATER|MAGIC HOUR|"
                  r"FLASHBACK|FLASH BACK|PRESENT|PRESENT DAY|THE PRESENT|DREAM|NIGHTMARE|MEMORY|FANTASY|"
                  r"\d{4}|\(.*\)|LATE NIGHT|EARLY MORNING|PRE-DAWN|PREDAWN|TWILIGHT|FIRST LIGHT|BEFORE DAWN|"
                  r"DAYS? LATER|WEEKS? LATER|MONTHS? LATER|YEARS? LATER|NEXT DAY|THE NEXT DAY|NEXT MORNING|"
                  r"CONT'?D|CONTINUING|INTERCUT|RAIN|SNOW|STORM|DAY \d+|NIGHT \d+|DAY/NIGHT|NIGHT/DAY)\b")
EXT_RE = re.compile(r"\s*\((?:[^)]*)\)\s*")  # (V.O.) (O.S.) (CONT'D)
NUM_WORDS = r"(?:\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWELVE|FIFTEEN|TWENTY|THIRTY|FORTY|FIFTY|SEVERAL|MANY|A FEW|SOME)"
NONLIN = {
    "flashback": re.compile(r"\bFLASH[\s-]?BACKS?\b|\bFLASH[\s-]?FORWARDS?\b"),
    "intercut": re.compile(r"\bINTER[\s-]?CUT"),
    "time_jump": re.compile(NUM_WORDS + r"\s+(?:YEARS?|MONTHS?|DECADES?)\s+(?:EARLIER|LATER|BEFORE|AGO|PREVIOUSLY)\b|"
                            r"\bPRESENT DAY\b|\bBACK TO (?:THE )?PRESENT\b|\bTHE PRESENT\b|\bEARLIER\b(?=[\s.)-]*$)"),
    "dream": re.compile(r"\bDREAM|\bNIGHTMARE\b|\bFANTASY\b|\bHALLUCINATION|\bMEMORY\b|\bMEMORIES\b"),  # VISION не берём: чаще «экран», чем видение
}
STOP_NAMES = {"THE", "A", "AN", "AND", "OF", "TO", "IN", "IS", "WE", "HE", "SHE", "IT", "NO", "YES", "OK", "OKAY"}


def load_text(path):
    raw = open(path, "rb").read().decode("utf-8", errors="replace")
    t = html.unescape(raw).replace("\r\n", "\n").replace("\r", "\n")
    t = t.replace("\xa0", " ").replace("\x96", "-").replace("\x97", "--").replace("\x92", "'").replace("’", "'")
    t = t.replace("–", "-").replace("—", "--").replace("\x93", '"').replace("\x94", '"')
    t = t.expandtabs(8)
    repaired = False
    if t.count("\n") < 100 and len(t) > 20000:  # переводы строк потеряны: в тексте остались только отступы
        t = re.sub(r" {5,}", lambda m: "\n" + m.group(0), t)
        repaired = True
    return t, repaired


def indent(l):
    return len(l) - len(l.lstrip(" "))


def is_upper(s):
    letters = re.sub(r"[^A-Za-z]", "", s)
    return len(letters) >= 2 and letters == letters.upper()


def clean_head(s):
    s = re.sub(r"^\s*[A-Z]?\d+[A-Z]?[.)]?\s*(?=[A-Z]{3})", "", s)
    s = re.sub(r"\s+[A-Z]?\d+[A-Z]?\.?\s*$", "", s)
    return s.strip()


def is_heading(s):
    return bool(HEAD.match(clean_head(s) if re.match(r"^[A-Z]?\d", s) else s)) and is_upper(s[:40])


def cue_name(s):
    name = EXT_RE.sub(" ", s).strip()
    name = re.sub(r"\bCONT'?D\.?|\bCONTINUING\b|\bCONT\.?$", "", name).strip(" .:-")
    return name


def is_cue_cand(s):
    if s and len(s) <= 20 and re.fullmatch(r"\d{1,2}", cue_name(s)) and "(" in s:  # персонажи-номера («9 (CONT'D)»)
        return True
    if s and len(s) <= 20 and re.fullmatch(r"[B-HJ-Z]", cue_name(s)):  # однобуквенные имена (Z в «Муравье Антце»)
        return True
    if not s or len(s) > 45 or not is_upper(EXT_RE.sub(" ", s)) or is_heading(s) or TRANS.search(s) or SHOT.match(s):
        return False
    name = cue_name(s)
    if not name or len(name) > 32 or len(name.split()) > 4 or name in STOP_NAMES:
        return False
    if re.fullmatch(r"\d{1,2}", name) and s != name:  # персонажи-номера («9 (CONT'D)»); голые цифры — номера страниц
        return True
    if not re.match(r"^[A-Z0-9][A-Z0-9 .'&#/-]*$", name) or not re.search(r"[A-Z]{2}", name):
        return False
    if re.search(r"[.!?:;,]$", s) and not s.endswith(")"):
        return False
    if re.search(r"\b(INT|EXT)\b", name):
        return False
    return True


def location_of(s):
    s = clean_head(s)
    m = HEAD.match(s)
    rest = s[m.end():] if m else s
    rest = re.sub(r"\s+[A-Z]?\d+[A-Z]?\.?\s*$", "", rest)
    parts = [p.strip(" .,:") for p in re.split(r"\s+-+\s+|\s+--\s*|\s*--\s+|\s*/\s*(?=DAY|NIGHT)|\.\s+(?=[A-Z])|,\s+(?=DAY|NIGHT|LATER)", rest)]
    parts = [p for p in parts if p]
    while len(parts) > 1 and TIME.match(parts[-1]):
        parts.pop()
    if parts and TIME.match(parts[0]) and len(parts) == 1:
        parts = []
    norm = lambda p: re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9' ]", " ", p.upper())).strip()
    parts = [norm(p) for p in parts]
    parts = [re.sub(r"^THE ", "", p) for p in parts if p]
    if not parts:
        return None, None
    return parts[0], " / ".join(parts)


def pctl(xs, q):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))] if xs else 0


def parse(path):
    text, repaired = load_text(path)
    L = text.split("\n")
    n = len(L)
    S = [l.strip() for l in L]
    I = [indent(l) for l in L]
    nonblank = [i for i in range(n) if S[i]]

    def next_nb(i, k=3):
        j, seen = i + 1, 0
        while j < n and seen <= k:
            if S[j]:
                return j
            j += 1
            seen += 1
        return None

    noise = set()
    for i in nonblank:
        s = S[i]
        if re.match(r"^\(?\d+[A-Z]?\.?\)?$", s) or re.match(r"^\(?(CONTINUED|MORE|CONT'?D)\)?:?$", s) or \
                re.match(r"^\d*\s*CONTINUED:?\s*(\(\d+\))?\s*\d*$", s) or re.search(r"REVISIONS?\b.*\d{4}|\bDRAFT\b.*\d{2}", s) and is_upper(s):
            noise.add(i)

    heads_ie = [i for i in nonblank if i not in noise and len(S[i]) < 110 and is_heading(S[i])]
    long_lines = [I[i] for i in nonblank if len(S[i]) >= 50 and not is_upper(S[i])]
    A = collections.Counter(long_lines).most_common(1)[0][0] if len(long_lines) >= 30 else \
        collections.Counter(I[i] for i in nonblank).most_common(1)[0][0]
    cands = [i for i in nonblank if i not in noise and is_cue_cand(S[i])]
    # кандидат в имя говорящего: за ним (в пределах пары строк) — не заголовок, не другое имя, не переход
    def followed_by_speech(i):
        j = next_nb(i, 1)
        if j is None:
            return False
        s = S[j]
        return not (is_heading(s) or is_cue_cand(s) or TRANS.search(s) or j in noise)
    cands = [i for i in cands if followed_by_speech(i)]
    deep = [i for i in cands if I[i] >= A + 4]
    mode = "indented" if len(deep) >= 40 and len(deep) >= 0.5 * len(cands) else "flat"

    lens = [len(S[i]) for i in nonblank]
    unwrapped = pctl(lens, 0.9) > 110
    dialogue = set()
    paren = set()
    cue_lines = []
    if mode == "indented":
        firsts = []
        for i in deep:
            j = next_nb(i, 1)
            if j is not None and not S[j].startswith("("):
                firsts.append(I[j])
        D = collections.Counter(firsts).most_common(1)[0][0] if firsts else A + 10
        Dlo = max(A + 2, pctl(firsts, 0.05) - 1) if firsts else D - 2  # реплики бывают центрованы — берём нижний край
        lc = collections.Counter(long_lines)
        act_ind = [k for k, v in lc.items() if v >= 0.05 * len(long_lines) and k < D - 1]  # бывает несколько отступов действия
        if act_ind:
            Dlo = max(Dlo, max(act_ind) + 2)
        if D <= A + 1:
            mode = "flat"
    if mode == "indented":
        cue_lines = [i for i in deep if I[i] >= D + 2 or I[i] >= A + 15]
        for i in cue_lines:
            j, in_par = i + 1, False
            while j < n:
                s = S[j]
                if not s:
                    k = next_nb(j, 2)
                    if k is None or not (Dlo <= I[k] <= D + 12) or is_cue_cand(S[k]) and I[k] >= D + 2 or is_heading(S[k]):
                        break
                    j = k
                    continue
                if j in noise:
                    j += 1
                    continue
                if I[j] < Dlo or len(s) > 58 or is_heading(s) or TRANS.search(s) and I[j] > D + 8 or (is_cue_cand(s) and I[j] >= D + 2 and j != i):
                    break
                if s.startswith("(") or in_par:
                    paren.add(j)
                    in_par = not s.rstrip().endswith(")")
                else:
                    dialogue.add(j)
                j += 1
    else:
        firsts = []
        for i in cands:
            j = next_nb(i, 1)
            if j is not None and not S[j].startswith("("):
                firsts.append(len(S[j]))
        Wd = pctl(firsts, 0.9) or 60
        Wa = pctl(lens, 0.9) or 60
        narrow = Wa - Wd >= 10
        cue_lines = [i for i in cands if len(cue_name(S[i])) > 1]  # одиночные буквы без отступа — буквицы, не имена
        for i in cue_lines:
            j, in_par, taken = i + 1, False, 0
            while j < n:
                s = S[j]
                if not s:
                    if taken == 0 and j - i <= 2:  # пустая строка между именем и репликой
                        j += 1
                        continue
                    break
                if j in noise:
                    j += 1
                    continue
                if is_heading(s) or TRANS.search(s) or is_cue_cand(s):
                    break
                if s.startswith("(") or in_par:
                    paren.add(j)
                    in_par = not s.rstrip().endswith(")")
                    j += 1
                    continue
                if narrow and len(s) > Wd + 4:
                    break
                dialogue.add(j)
                taken += 1
                if unwrapped:
                    break
                lim = Wd if narrow else Wa
                if len(s) < 0.6 * lim and not s.endswith(("--", ",", "...")):  # абзац реплики кончился
                    break
                j += 1

    # заголовки сцен: INT./EXT., а если их мало — «слаги» (строка капслоком на отступе действия, отделённая пустыми)
    cue_set = set(cue_lines)
    heads = list(heads_ie)
    head_mode = "intext"
    words_total_est = sum(len(S[i].split()) for i in nonblank)
    if len(heads_ie) < max(25, words_total_est / 1500):
        head_mode = "slug"
        for i in nonblank:
            s = S[i]
            if i in cue_set or i in dialogue or i in paren or i in noise or i in heads_ie:
                continue
            if not is_upper(s) or len(s) > 70 or len(s) < 4 or TRANS.search(s) or SHOT.match(s):
                continue
            if mode == "indented" and abs(I[i] - A) > 2:
                continue
            prev_blank = i == 0 or not S[i - 1]
            nxt_blank = i + 1 >= n or not S[i + 1]
            if prev_blank and nxt_blank and not re.search(r"[!?]$", s) and len(s.split()) <= 8:
                heads.append(i)
        heads = sorted(set(heads))

    # ---- подсчёт ----
    wre = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
    head_set = set(heads)
    toks_all, toks_dia = [], []
    action_words = dia_words = 0
    for i in nonblank:
        if i in noise or i in head_set or i in cue_set or i in paren or TRANS.search(S[i]) and len(S[i]) < 30:
            continue
        w = [x.lower() for x in wre.findall(S[i])]
        toks_all += w
        if i in dialogue:
            dia_words += len(w)
            toks_dia += w
        else:
            action_words += len(w)
    total = action_words + dia_words

    # реплики: имя -> слова
    speeches = []  # (line, name, words, vo)
    dl = sorted(dialogue)
    import bisect
    for k, i in enumerate(cue_lines):
        nxt = cue_lines[k + 1] if k + 1 < len(cue_lines) else n
        a, b = bisect.bisect_left(dl, i), bisect.bisect_left(dl, nxt)
        w = sum(len(wre.findall(S[j])) for j in dl[a:b])
        if w == 0:
            continue
        s = S[i]
        name = cue_name(s)
        vo = bool(re.search(r"\(\s*V\s*[./]?\s*[O0]\b|\bV\.[O0]\b|\bVOICE[- ]?OVER\b|\bNARRAT", s, re.I))
        speeches.append((i, name, w, vo))

    spk_words = collections.Counter()
    spk_cues = collections.Counter()
    for _, name, w, _ in speeches:
        spk_words[name] += w
        spk_cues[name] += 1
    speakers = [k for k, v in spk_cues.items() if v >= 2]
    sw = sum(spk_words.values()) or 1
    probs = [v / sw for v in spk_words.values()]
    eff_speakers = math.exp(-sum(p * math.log(p) for p in probs if p > 0)) if probs else 0
    top_speaker_share = max(probs) if probs else 0
    vo_words = sum(w for _, _, w, vo in speeches if vo)

    # сцены
    scenes = []
    hs = heads + [n]
    sp_lines = [s[0] for s in speeches]
    for k in range(len(heads)):
        a, b = hs[k], hs[k + 1]
        lo, hi = bisect.bisect_left(sp_lines, a), bisect.bisect_left(sp_lines, b)
        sp = speeches[lo:hi]
        words = sum(len(wre.findall(S[j])) for j in range(a + 1, b) if S[j] and j not in noise and j not in cue_set and j not in paren)
        top, full = location_of(S[a])
        hm = HEAD.match(clean_head(S[a]))
        kind = hm.group(1).replace(" ", "") if hm else ""
        scenes.append({"int": kind.startswith(("INT", "I/", "INTERIOR")), "words": words, "dia": sum(x[2] for x in sp), "speakers": len({x[1] for x in sp}), "top": top, "full": full})
    ns = len(scenes)
    locs_top = collections.Counter(s["top"] for s in scenes if s["top"])
    locs_full = collections.Counter(s["full"] for s in scenes if s["full"])
    with_loc = sum(locs_top.values()) or 1
    silent = [s for s in scenes if s["dia"] == 0 and s["words"] >= 5]
    real = [s for s in scenes if s["words"] >= 5]

    # нелинейность — только по строкам вне реплик (ремарки, заголовки)
    nl = collections.Counter()
    for i in nonblank:
        if i in dialogue or i in paren:
            continue
        s = S[i]
        if not (is_upper(s) or i in head_set or re.search(r"[A-Z]{4}", s)):
            continue
        for k, rx in NONLIN.items():
            # учитываем только капслок-вхождения (в описании действия слово «dream» строчными — не маркер)
            for m in rx.finditer(s):
                if m.group(0) == m.group(0).upper():
                    nl[k] += 1

    def ttr_windows(toks, w):
        ch = [toks[i:i + w] for i in range(0, len(toks) - w + 1, w)]
        return sum(len(set(c)) / w for c in ch) / len(ch) if ch else None

    per10k = lambda x: round(x * 10000 / total, 3) if total else None
    feats = {
        "words": total,
        "scenes": ns,
        "locations": len(locs_top),
        "locations_full": len(locs_full),
        "top_location_share": round(locs_top.most_common(1)[0][1] / with_loc, 3) if locs_top else None,
        "top3_location_share": round(sum(v for _, v in locs_top.most_common(3)) / with_loc, 3) if locs_top else None,
        "int_share": round(sum(1 for s in scenes if s["int"]) / ns, 3) if ns and head_mode == "intext" else None,
        "speakers": len(speakers),
        "speakers_eff": round(eff_speakers, 2),
        "top_speaker_share": round(top_speaker_share, 3),
        "dialogue_share": round(dia_words / total, 3) if total else None,
        "words_per_scene": round(total / ns, 1) if ns else None,
        "scenes_per_10k": per10k(ns),
        "mean_speech_len": round(dia_words / len(speeches), 2) if speeches else None,
        "speeches_per_10k": per10k(len(speeches)),
        "ttr_1000": round(ttr_windows(toks_all, 1000), 4) if len(toks_all) >= 1000 else None,
        "ttr_dialogue_500": round(ttr_windows(toks_dia, 500), 4) if len(toks_dia) >= 500 else None,
        "silent_scene_share": round(len(silent) / len(real), 3) if real else None,
        "mean_speakers_per_scene": round(sum(s["speakers"] for s in real) / len(real), 2) if real else None,
        "vo_share": round(vo_words / dia_words, 3) if dia_words else None,
        "onscreen_dialogue_share": round((dia_words - vo_words) / total, 3) if total else None,
        "flashback_10k": per10k(nl["flashback"]),
        "intercut_10k": per10k(nl["intercut"]),
        "time_jump_10k": per10k(nl["time_jump"]),
        "dream_10k": per10k(nl["dream"]),
        "nonlinear_10k": per10k(nl["flashback"] + nl["time_jump"] + nl["dream"]),
    }
    quality = "ok"
    why = []
    if len(speeches) < 150:
        why.append("мало распознанных реплик")
    if head_mode == "slug":
        why.append("нет INT./EXT. — сцены по слагам")
    if repaired:
        why.append("восстановлены переводы строк")
    if total < 12000:
        why.append("короткий текст (обрывок или стенограмма)")
    if total and dia_words / total > 0.85:
        why.append("почти один диалог — стенограмма, не сценарий")
    if total < 8000 or (total and dia_words / total > 0.85) or (len(speeches) < 60 and mode == "flat"):
        quality = "bad"
    elif why:
        quality = "weak"
    parse_info = {"mode": mode, "head_mode": head_mode, "unwrapped": unwrapped, "action_indent": A,
                  "cues": len(speeches), "heads_intext": len(heads_ie), "quality": quality, "why": why}
    return feats, parse_info


# ---------- сопоставление файлов с ключами разметки ----------

def norm_title(s):
    s = html.unescape(s or "").lower().replace("&", "and")
    s = re.sub(r"^(the|a|an) ", "", s)
    s = re.sub(r", (the|a|an)$", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def load_films():
    films = json.load(open(FILMS))["films"]
    ours = {}
    for f in films:
        if f.get("orig") and f["orig"] != "None":
            ours.setdefault(norm_title(f["orig"]), f)
    return films, ours


def match_files(files, ours):
    idx_path = f"{DATA}/index.json"
    by_file = {}
    if os.path.exists(idx_path):
        for r in json.load(open(idx_path)):
            by_file[r["file"]] = r["key"]
    out = {}
    for fn in files:
        if fn in by_file:
            out[fn] = by_file[fn]
            continue
        base = fn[:-4].replace("_", " ")
        cands = [base, re.sub(r" (The|A|An)$", "", base)]
        for c in cands:
            k = norm_title(c)
            if k in ours:
                out[fn] = ours[k]["key"]
                break
    return out


def run_features():
    files = sorted(f for f in os.listdir(DATA) if f.endswith(".txt") and f != "NOTE.txt")
    films, ours = load_films()
    keymap = match_files(files, ours)
    byk = {f["key"]: f for f in films}
    rows = []
    for fn in files:
        try:
            feats, info = parse(f"{DATA}/{fn}")
        except Exception as e:  # noqa
            print("ошибка разбора", fn, e, file=sys.stderr)
            continue
        k = keymap.get(fn)
        f = byk.get(k) if k else None
        rows.append({"file": fn, "key": k, "title": f["title"] if f else None, "orig": f["orig"] if f else None,
                     "year": f["year"] if f else None, "parse": info, "features": feats})
        print(f"{fn[:34]:34} {info['quality']:4} {info['mode'][:4]} {info['head_mode']:6} реплик {info['cues']:5} "
              f"сцен {feats['scenes']:4} лок {feats['locations']:4} диал {feats['dialogue_share']} гов {feats['speakers']}")
    os.makedirs(OUT, exist_ok=True)
    json.dump({"note": "внутренний опыт 24.10; числа по сценариям IMSDb, текста нет", "n": len(rows), "rows": rows},
              open(f"{OUT}/features.json", "w"), ensure_ascii=False, indent=1)
    print("файлов:", len(rows), "с ключом:", sum(1 for r in rows if r["key"]), "->", f"{OUT}/features.json")


# ---------- статистика ----------

def rankdata(x):
    import numpy as np
    x = np.asarray(x, float)
    order = x.argsort(kind="mergesort")
    r = np.empty(len(x))
    xs = x[order]
    i = 0
    while i < len(x):
        j = i
        while j + 1 < len(x) and xs[j + 1] == xs[i]:
            j += 1
        r[order[i:j + 1]] = (i + j) / 2 + 1
        i = j + 1
    return r


def spearman(x, y, perms=4000, seed=1):
    import numpy as np
    rx, ry = rankdata(x), rankdata(y)
    rx, ry = rx - rx.mean(), ry - ry.mean()
    den = math.sqrt((rx ** 2).sum() * (ry ** 2).sum()) or 1
    rho = float((rx * ry).sum() / den)
    rng = np.random.default_rng(seed)
    P = np.array([rng.permutation(ry) for _ in range(perms)])
    null = (P @ rx) / den
    p = float((np.abs(null) >= abs(rho) - 1e-12).mean())
    return rho, max(p, 1 / perms)


def auc(x, y, perms=4000, seed=2):
    import numpy as np
    x, y = np.asarray(x, float), np.asarray(y, bool)
    r = rankdata(x)
    n1, n0 = y.sum(), (~y).sum()
    if n1 == 0 or n0 == 0:
        return None, None
    a = float((r[y].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))
    rng = np.random.default_rng(seed)
    null = []
    for _ in range(perms):
        yy = rng.permutation(y)
        null.append((r[yy].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))
    null = np.array(null)
    p = float((np.abs(null - 0.5) >= abs(a - 0.5) - 1e-12).mean())
    return a, max(p, 1 / perms)


def bh(ps):
    m = len(ps)
    order = sorted(range(m), key=lambda i: ps[i])
    q = [0] * m
    prev = 1
    for rank, i in reversed(list(enumerate(order, 1))):
        prev = min(prev, ps[i] * m / rank)
        q[i] = prev
    return q


BARRIERS = ["Разговорная форма", "Мало слов", "Много линий", "Нелинейное время", "Одна комната",
            "Ненадёжный рассказчик", "Фрагментарная структура"]
FEATS = ["words", "scenes", "locations", "locations_full", "top_location_share", "top3_location_share", "int_share", "speakers",
         "speakers_eff", "top_speaker_share", "dialogue_share", "words_per_scene", "scenes_per_10k",
         "mean_speech_len", "speeches_per_10k", "ttr_1000", "ttr_dialogue_500", "silent_scene_share",
         "mean_speakers_per_scene", "vo_share", "onscreen_dialogue_share", "flashback_10k", "intercut_10k", "time_jump_10k", "dream_10k",
         "nonlinear_10k"]


def run_analyze():
    import numpy as np
    F = json.load(open(f"{OUT}/features.json"))["rows"]
    films = {f["key"]: f for f in json.load(open(FILMS))["films"]}
    oof = {r["key"]: r for r in json.load(open(OOF))}
    rows = []
    for r in F:
        if not r["key"] or r["key"] not in films or r["parse"]["quality"] == "bad":
            continue
        lab = films[r["key"]]["label"] or {}
        if lab.get("level") is None:
            continue
        rows.append({**r, "year": films[r["key"]].get("year"), "level": lab["level"], "barriers": lab.get("barriers") or [],
                     "ridge": oof.get(r["key"], {}).get("ridge"), "conf": lab.get("confidence")})
    res = {"n": len(rows), "n_files": len(F), "excluded_bad": [r["file"] for r in F if r["parse"]["quality"] == "bad"],
           "no_key": [r["file"] for r in F if not r["key"]]}

    def col(name, rr):
        return [x["features"].get(name) for x in rr]

    # 1) уровень
    lev = []
    for fe in FEATS:
        pairs = [(x["features"].get(fe), x["level"]) for x in rows if x["features"].get(fe) is not None]
        if len(pairs) < 20:
            continue
        rho, p = spearman([a for a, _ in pairs], [b for _, b in pairs])
        lev.append({"feature": fe, "n": len(pairs), "rho": round(rho, 3), "p": round(p, 4)})
    for q, d in zip(bh([d["p"] for d in lev]), lev):
        d["q"] = round(q, 3)
    # частная (по рангам) с поправкой на год — старые сценарии и уровень могут быть связаны
    yrs = [x["year"] or 0 for x in rows]
    lv_all = [x["level"] for x in rows]
    r_ly = spearman(lv_all, yrs, perms=10)[0]
    res["level_year_rho"] = round(r_ly, 3)
    for d in lev:
        xs = [x["features"].get(d["feature"]) for x in rows]
        idx = [i for i, v in enumerate(xs) if v is not None]
        r_xy = spearman([xs[i] for i in idx], [lv_all[i] for i in idx], perms=10)[0]
        r_xz = spearman([xs[i] for i in idx], [yrs[i] for i in idx], perms=10)[0]
        r_yz = spearman([lv_all[i] for i in idx], [yrs[i] for i in idx], perms=10)[0]
        d["rho_year"] = round(r_xz, 3)
        d["partial_year"] = round((r_xy - r_xz * r_yz) / math.sqrt(max(1e-9, (1 - r_xz ** 2) * (1 - r_yz ** 2))), 3)
    res["level"] = sorted(lev, key=lambda d: -abs(d["rho"]))
    # только хороший разбор
    ok = [x for x in rows if x["parse"]["quality"] == "ok"]
    lev_ok = []
    for fe in FEATS:
        pairs = [(x["features"].get(fe), x["level"]) for x in ok if x["features"].get(fe) is not None]
        if len(pairs) < 20:
            continue
        rho, p = spearman([a for a, _ in pairs], [b for _, b in pairs])
        lev_ok.append({"feature": fe, "n": len(pairs), "rho": round(rho, 3), "p": round(p, 4)})
    res["level_ok_only"] = sorted(lev_ok, key=lambda d: -abs(d["rho"]))

    # 2) барьеры
    bar = []
    for b in BARRIERS:
        ys = [b in x["barriers"] for x in rows]
        npos = sum(ys)
        entry = {"barrier": b, "pos": npos, "neg": len(ys) - npos, "auc": []}
        if npos >= 3:
            for fe in FEATS:
                pairs = [(x["features"].get(fe), b in x["barriers"]) for x in rows if x["features"].get(fe) is not None]
                a, p = auc([u for u, _ in pairs], [v for _, v in pairs])
                if a is None:
                    continue
                entry["auc"].append({"feature": fe, "auc": round(a, 3), "p": round(p, 4)})
        bar.append(entry)
    allp = [d["p"] for e in bar for d in e["auc"]]
    qs = bh(allp) if allp else []
    k = 0
    for e in bar:
        for d in e["auc"]:
            d["q"] = round(qs[k], 3)
            k += 1
        e["auc"].sort(key=lambda d: -abs(d["auc"] - 0.5))
    res["barriers"] = bar

    # 3) ошибка классификатора по описанию
    rr = [x for x in rows if x["ridge"] is not None]
    res["ridge_n"] = len(rr)
    if rr:
        lv = np.array([x["level"] for x in rr], float)
        rg = np.array([x["ridge"] for x in rr], float)
        res["ridge_mae"] = round(float(np.abs(lv - rg).mean()), 3)
        res["ridge_rho_level"] = round(spearman(rg, lv)[0], 3)
        err = []
        for fe in FEATS:
            pairs = [(x["features"].get(fe), x["level"] - x["ridge"]) for x in rr if x["features"].get(fe) is not None]
            if len(pairs) < 20:
                continue
            rho, p = spearman([a for a, _ in pairs], [b for _, b in pairs])
            err.append({"feature": fe, "n": len(pairs), "rho": round(rho, 3), "p": round(p, 4)})
        for q, d in zip(bh([d["p"] for d in err]), err):
            d["q"] = round(q, 3)
        res["residual"] = sorted(err, key=lambda d: -abs(d["rho"]))
        # LOO: гребневая поправка ошибки по признакам сценария (стандартизованные ранги), без и с признаками
        use = [fe for fe in FEATS if all(x["features"].get(fe) is not None for x in rr)]
        X = np.column_stack([rankdata(col(fe, rr)) for fe in use])
        X = (X - X.mean(0)) / (X.std(0) + 1e-9)
        resid = lv - rg
        out = {}
        for lam in (10, 30, 100, 300):
            pred = np.zeros(len(rr))
            for i in range(len(rr)):
                m = np.ones(len(rr), bool)
                m[i] = False
                Xm, ym = X[m], resid[m]
                mu = ym.mean()
                w = np.linalg.solve(Xm.T @ Xm + lam * np.eye(X.shape[1]), Xm.T @ (ym - mu))
                pred[i] = mu + X[i] @ w
            out[str(lam)] = {"mae": round(float(np.abs(lv - (rg + pred)).mean()), 3),
                             "rho": round(spearman(rg + pred, lv, perms=10)[0], 3)}
        # и поправка просто на средний сдвиг (LOO) — честная база для сравнения
        pred0 = np.array([np.delete(resid, i).mean() for i in range(len(rr))])
        out["shift_only"] = {"mae": round(float(np.abs(lv - (rg + pred0)).mean()), 3)}
        res["residual_loo"] = {"features": use, "by_lambda": out}

    # 4) споры сценария с разметкой
    def q_of(fe, v, rr=rows):
        vals = sorted(x["features"][fe] for x in rr if x["features"].get(fe) is not None)
        return sum(1 for u in vals if u <= v) / len(vals) if vals else None
    disputes = []
    for x in rows:
        f, b, why = x["features"], set(x["barriers"]), []
        qd = q_of("dialogue_share", f["dialogue_share"]) if f["dialogue_share"] is not None else None
        if "Мало слов" in b and qd is not None and qd >= 0.6:
            why.append(f"«Мало слов», а доля диалога {f['dialogue_share']:.0%} (выше {qd:.0%} выборки); сцен без реплик {f['silent_scene_share']:.0%}")
        if "Разговорная форма" in b and qd is not None and qd <= 0.3:
            why.append(f"«Разговорная форма», а доля диалога {f['dialogue_share']:.0%} (ниже, чем у {1-qd:.0%} выборки)")
        if "Одна комната" in b and (f["locations"] >= 25 or (f["top_location_share"] or 0) < 0.25):
            why.append(f"«Одна комната», а локаций {f['locations']}, главная — {f['top_location_share']:.0%} сцен")
        if "Много линий" in b and q_of("speakers_eff", f["speakers_eff"]) <= 0.2:
            why.append(f"«Много линий», а речь сосредоточена: эфф. говорящих {f['speakers_eff']}, первый — {f['top_speaker_share']:.0%} реплик по словам")
        if "Нелинейное время" in b and (f["nonlinear_10k"] or 0) == 0 and (f["intercut_10k"] or 0) == 0:
            why.append("«Нелинейное время», а в ремарках нет ни FLASHBACK, ни скачков во времени, ни сна/памяти")
        if "Нелинейное время" not in b and (f["flashback_10k"] or 0) + (f["time_jump_10k"] or 0) >= 4 \
                and q_of("nonlinear_10k", f["nonlinear_10k"]) >= 0.9:
            why.append(f"нет «Нелинейного времени», а маркеров флешбэков/скачков {f['flashback_10k'] + f['time_jump_10k']:.1f} на 10 тыс. слов (верхние 10%)")
        if "Мало слов" not in b and qd is not None and qd <= 0.07 and (f["silent_scene_share"] or 0) >= 0.6:
            why.append(f"нет «Мало слов», а доля диалога {f['dialogue_share']:.0%}, сцен без реплик {f['silent_scene_share']:.0%}")
        qo = q_of("onscreen_dialogue_share", f["onscreen_dialogue_share"]) if f["onscreen_dialogue_share"] is not None else None
        if "Разговорная форма" not in b and qo is not None and qo >= 0.93:
            why.append(f"нет «Разговорной формы», а доля диалога в кадре (без закадра) {f['onscreen_dialogue_share']:.0%} (верхние 7% выборки) — справка: болтливость ещё не форма")
        if "Много линий" not in b and q_of("speakers_eff", f["speakers_eff"]) >= 0.95 and f["top_speaker_share"] <= 0.15:
            why.append(f"нет «Много линий», а речь размазана: эфф. говорящих {f['speakers_eff']}, первый — {f['top_speaker_share']:.0%}")
        if "Ненадёжный рассказчик" in b and (f["vo_share"] or 0) == 0:
            why.append("«Ненадёжный рассказчик» без закадрового голоса (не обязательно ошибка — справка)")
        if why:
            disputes.append({"key": x["key"], "title": x["title"], "orig": x["orig"], "level": x["level"], "barriers": x["barriers"],
                             "quality": x["parse"]["quality"], "why": why})
    res["disputes"] = disputes
    # распределение уровней и барьеров в выборке
    res["levels"] = dict(sorted(collections.Counter(x["level"] for x in rows).items()))
    json.dump(res, open(f"{OUT}/analysis.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: res[k] for k in ("n", "n_files", "levels", "ridge_n")}, ensure_ascii=False))
    print("уровень:")
    for d in res["level"][:12]:
        print(f"  {d['feature']:24} rho {d['rho']:+.2f} p {d['p']:.3f} q {d['q']:.2f} n {d['n']}  год {d['rho_year']:+.2f} частн {d['partial_year']:+.2f}")
    for e in res["barriers"]:
        print(e["barrier"], e["pos"], "/", e["pos"] + e["neg"])
        for d in e["auc"][:4]:
            print(f"   {d['feature']:24} AUC {d['auc']:.2f} p {d['p']:.3f} q {d['q']:.2f}")
    if rr:
        print("ошибка ridge, MAE", res["ridge_mae"], "rho(ridge,level)", res["ridge_rho_level"])
        for d in res["residual"][:8]:
            print(f"  {d['feature']:24} rho {d['rho']:+.2f} p {d['p']:.3f} q {d['q']:.2f}")
        print("  LOO:", res["residual_loo"]["by_lambda"])
    print("споров:", len(disputes))
    for d in disputes:
        print(" ", d["key"], d["title"], "|", "; ".join(d["why"]))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "analyze":
        run_analyze()
    elif len(sys.argv) > 2 and sys.argv[1] == "inspect":
        feats, info = parse(sys.argv[2])
        print(json.dumps(info, ensure_ascii=False))
        print(json.dumps(feats, ensure_ascii=False, indent=1))
    else:
        run_features()
