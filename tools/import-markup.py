# -*- coding: utf-8 -*-
"""Прочитать размеченный film_reviews.xlsx и сложить решения людей в tools/markup-verdicts.json.

    python3 tools/import-markup.py [--in файл.xlsx | --url <ссылка на Google-таблицу>] [--dry]

С `--url` таблица берётся прямо из Google Таблиц в текущем виде — годится обычная ссылка из
адресной строки, она сама превращается в выгрузку .xlsx. Нужен доступ «по ссылке» хотя бы на
чтение: скачивание идёт без входа в аккаунт. Закрытый док так не прочитать — будет HTML
страницы входа вместо файла, и скрипт об этом скажет.

Нужен openpyxl (его же ставит deploy/markup-xlsx.command в .cache/venv).

Решением человека считается не всякая заполненная ячейка: 697 строк таблица отдаёт уже
заполненными догадкой машины, и принять их за разметку — значит записать догадку в правду.
Человеческое решение — это либо «Проверено» = «да», либо значение, отличное от догадки.

Ключ фильма берётся со скрытого листа «Справочник» того же файла, а не из наших моков: если
человек прислал файл, собранный неделю назад, правильный ключ лежит именно в нём.
Что вписано руками и в списке не нашлось — не теряем: это очередь на добавление фильмов.
"""
import json, os, re, sys
from datetime import date
from openpyxl import load_workbook

def arg(name, default):
    return sys.argv[sys.argv.index('--' + name) + 1] if '--' + name in sys.argv[:-1] else default

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = arg('in', os.path.join(ROOT, '.cache/markup/film_reviews.xlsx'))
URL = arg('url', None)
REF = os.path.join(ROOT, '.cache/markup/film-reviews.json')
OUT = os.path.join(ROOT, 'tools/markup-verdicts.json')
DRY = '--dry' in sys.argv
NOT_A_FILM = '— не про фильм —'
VIDEO = re.compile(r'(?:v=|youtu\.be/|/shorts/)([A-Za-z0-9_-]{11})')

if URL:
    # из ссылки на док достаём id и берём выгрузку всей книги: скрытый «Справочник» с ключами
    # в ней тоже есть, и дальше код не различает, откуда файл
    import subprocess
    m = re.search(r'/spreadsheets/d/([A-Za-z0-9_-]+)', URL)
    if not m:
        sys.exit('не похоже на ссылку Google Таблиц: %s' % URL)
    dl = 'https://docs.google.com/spreadsheets/d/%s/export?format=xlsx' % m.group(1)
    SRC = os.path.join(ROOT, '.cache/markup/google.xlsx')
    os.makedirs(os.path.dirname(SRC), exist_ok=True)
    # качаем curl'ом, а не из питона: у него системное хранилище корневых сертификатов, а у
    # свежего python.org-сборки своего нет, и urllib падает на проверке сертификата Google
    r = subprocess.run(['curl', '-fsSL', '--location-trusted', '-o', SRC, dl], capture_output=True)
    if r.returncode != 0:
        sys.exit('не скачалось (curl %d: %s). Проверьте доступ «по ссылке» у дока.'
                 % (r.returncode, r.stderr.decode()[:200].strip()))
    head = open(SRC, 'rb').read(4)
    if head[:2] != b'PK':
        sys.exit('вместо книги пришла страница — скорее всего, у дока нет доступа по ссылке.')
    print('скачал из Google Таблиц: %.1f КБ' % (os.path.getsize(SRC) / 1024))

if not os.path.exists(SRC):
    sys.exit('нет файла %s — соберите deploy/markup-xlsx.command и отдайте его людям' % SRC)

wb = load_workbook(SRC, data_only=True)
# «Разметка» — имя из первой сборки (26.09, до разделения на ярусы); читаем и его
SHEETS = [n for n in ('Обзоры', 'Эссе', 'Разметка') if n in wb.sheetnames]
if not SHEETS:
    sys.exit('в книге нет листов разметки, есть: %s' % ', '.join(wb.sheetnames))
keys = {}                                    # ярлык фильма → ключ
if 'Справочник' in wb.sheetnames:
    ref = wb['Справочник']
    for label, key in ref.iter_rows(min_row=2, max_col=2, values_only=True):
        if label and key:
            keys[str(label).strip()] = str(key).strip()

# чем была заполнена колонка «Фильм», когда таблицу отдавали: чтобы отличить подтверждение
# от нетронутой догадки. Файла нет — считаем решением только «Проверено» = «да».
guess = {}
if os.path.exists(REF):
    ref_data = json.load(open(REF, encoding='utf-8'))
    for r in ref_data.get('review', []) + ref_data.get('essay', []) + ref_data.get('rows', []):
        m = VIDEO.search(r['url'])
        if m:
            guess[m.group(1)] = r['film']

was = {}
if os.path.exists(OUT):
    was = json.load(open(OUT, encoding='utf-8')).get('videos', {})

verdicts, stats = dict(was), {'подтвердили': 0, 'поправили': 0, 'не про фильм': 0,
                              'нет у нас': 0, 'пропустили': 0, 'со стороны фильма': 0,
                              'изменили прежнее': 0}
rows_read = 0

def put(vid, v, bucket):
    v['at'] = date.today().isoformat()
    stats[bucket] += 1
    old = was.get(vid)
    if old and {k: old.get(k) for k in ('key', 'why', 'film')} != {k: v.get(k) for k in ('key', 'why', 'film')}:
        stats['изменили прежнее'] += 1
    verdicts[vid] = v

for name in SHEETS:
    ws = wb[name]
    rows_read += ws.max_row - 1
    for row in ws.iter_rows(min_row=2, max_col=6, values_only=True):
        url, film, _title, _ch, _date, checked = (list(row) + [None] * 6)[:6]
        if not url:
            continue
        m = VIDEO.search(str(url))
        if not m:
            continue
        vid = m.group(1)
        film = str(film).strip() if film else ''
        ok = str(checked).strip().lower() in ('да', 'yes', 'x', '+', 'true', '1') if checked else False
        before = guess.get(vid, '')

        if not film:
            stats['пропустили'] += 1
            continue
        if not ok and film == before:
            stats['пропустили'] += 1       # догадка, которую никто не смотрел, — не разметка
            continue

        if film == NOT_A_FILM:
            put(vid, {'key': None, 'why': 'не про фильм'}, 'не про фильм')
        elif film in keys:
            put(vid, {'key': keys[film], 'film': film}, 'подтвердили' if film == before else 'поправили')
        else:
            put(vid, {'key': None, 'why': 'нет у нас', 'film': film}, 'нет у нас')

# Лист «Без разбора» — та же разметка, но со стороны фильма: строка знает фильм, человек
# приносит ссылку. Здесь подтверждать нечего, догадки машины в этом листе нет.
if 'Без разбора' in wb.sheetnames:
    for film, _year, _talk, link in wb['Без разбора'].iter_rows(min_row=2, max_col=4, values_only=True):
        if not link or not film:
            continue
        m = VIDEO.search(str(link))
        if not m:
            continue
        label = str(film).strip()
        if label not in keys:
            continue
        put(m.group(1), {'key': keys[label], 'film': label}, 'со стороны фильма')

body = {'//': 'Ручная разметка «ролик → фильм». Пишет tools/import-markup.py из film_reviews.xlsx,'
              ' читает tools/build-essay-index.mts. Правда сильнее догадки: перегенерация индекса'
              ' её не сотрёт. Править руками можно, ключ — id ролика на YouTube.',
        'updated': date.today().isoformat(),
        'videos': dict(sorted(verdicts.items()))}
if not DRY:
    json.dump(body, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=False)

print('прочитано строк: %d (листы: %s)' % (rows_read, ', '.join(SHEETS)))
for k, n in stats.items():
    print('  %s: %d' % (k, n))
print('решений всего в %s: %d%s' % (os.path.relpath(OUT, ROOT), len(verdicts), ' (--dry, файл не тронут)' if DRY else ''))
unknown = [v['film'] for v in verdicts.values() if v.get('why') == 'нет у нас']
if unknown:
    print('фильмов, которых у нас нет (%d): %s' % (len(unknown), ', '.join(sorted(set(unknown))[:10])))
