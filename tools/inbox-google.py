# -*- coding: utf-8 -*-
"""Входная форма в Google: лист «Ссылки», куда владелец вставляет ссылки на каналы и ролики (06.10).

    python3 tools/inbox-google.py check            — доступ к файлу и к Sheets API
    python3 tools/inbox-google.py setup            — разложить форму в пустой таблице (один раз)
    python3 tools/inbox-google.py pull             — строки формы в stdout (JSON)
    python3 tools/inbox-google.py clear HELD.json  — удалить строки, все ссылки которых уже в базе

Это обычная таблица Google (не xlsx): с ней работаем через Sheets API построчно, а не заливкой файла
целиком — так очистка не сотрёт строку, вписанную между забором и очисткой. Удаляется только строка,
чьи ссылки сервер подтвердил (`held` из POST /api/admin/inbox), и только если она с тех пор не менялась.

ID файла — INBOX_SHEET_ID в .env.local; ключ сервисного аккаунта — тот же, что у таблицы разметки
(~/.config/recomend/google-sa.json или GOOGLE_SA_FILE). Нужны google-auth и requests (.cache/venv).
"""
import json, os, re, sys
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = 'https://sheets.googleapis.com/v4/spreadsheets/'
SHEET = 'Ссылки'
HELP = 'Как заполнять'
HEADER = ['Ссылка', 'Фильм или сериал (если знаете)', 'Заметка']
KEEP_ROWS = 300
URL_RE = re.compile(r'https?://[^\s<>"\'«»)\]]+')

HELP_TEXT = [
    ['Форма для ссылок'],
    [''],
    ['Лист «Ссылки» — по одной ссылке в строке (можно и несколько через пробел или с новой строки в одной ячейке).'],
    ['Подходят: ролик YouTube, канал YouTube (@ник или /channel/…), канал или пост Telegram (t.me/…).'],
    ['Колонка «Фильм» — если ролик о конкретном фильме или сериале: «Дюна (2021)», «Дом Дракона (сериал, 2022)».'],
    ['Колонка «Заметка» — что угодно: эссеист или обзорщик, о книгах, почему прислано.'],
    [''],
    ['Что дальше: сборщик забирает строки в базу приложения (утром и в 16:00), разбор — во вкладке «Ссылки» пульта.'],
    ['В 16:00 строки, которые уже в базе, исчезают из формы. Строка, которую не удалось забрать, остаётся.'],
]


def env_local(name):
    if os.environ.get(name):
        return os.environ[name]
    p = os.path.join(ROOT, '.env.local')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            k, _, v = line.strip().partition('=')
            if k == name:
                return v.strip().strip('"').strip("'")
    return None


def session():
    key = os.environ.get('GOOGLE_SA_FILE') or os.path.expanduser('~/.config/recomend/google-sa.json')
    if not os.path.exists(key):
        sys.exit('нет ключа сервисного аккаунта: %s' % key)
    creds = service_account.Credentials.from_service_account_file(
        key, scopes=['https://www.googleapis.com/auth/spreadsheets'])
    return AuthorizedSession(creds), creds.service_account_email


def sheet_id():
    fid = env_local('INBOX_SHEET_ID')
    if not fid:
        sys.exit('нет INBOX_SHEET_ID в .env.local — это id из ссылки на форму (/d/<id>/)')
    return fid


def fail(r, what):
    try:
        msg = r.json().get('error', {}).get('message', r.text[:300])
    except ValueError:
        msg = r.text[:300]
    if r.status_code == 403 and ('has not been used' in msg or 'is disabled' in msg):
        sys.exit('%s: в проекте сервисного аккаунта выключен Google Sheets API — включить в консоли Google Cloud (APIs & Services → Google Sheets API → Enable). %s' % (what, msg))
    if r.status_code in (403, 404):
        sys.exit('%s: таблица не видна сервисному аккаунту — выдайте ему права редактора («Настройки доступа»). %s' % (what, msg))
    sys.exit('%s: %s %s' % (what, r.status_code, msg))


def props(s, fid):
    r = s.get(API + fid, params={'fields': 'properties.title,sheets.properties'})
    if not r.ok:
        fail(r, 'таблица')
    return r.json()


def sheet_props(meta, title):
    for sh in meta.get('sheets', []):
        if sh['properties']['title'] == title:
            return sh['properties']
    return None


def values(s, fid, rng):
    r = s.get(API + fid + '/values/' + rng, params={'valueRenderOption': 'FORMATTED_VALUE'})
    if not r.ok:
        fail(r, 'чтение')
    return r.json().get('values', [])


def batch(s, fid, requests):
    if not requests:
        return
    r = s.post(API + fid + ':batchUpdate', json={'requests': requests})
    if not r.ok:
        fail(r, 'правка')


def check():
    s, email = session()
    m = props(s, sheet_id())
    print('аккаунт: %s' % email)
    print('таблица: %s; листы: %s' % (m['properties']['title'], ', '.join(sh['properties']['title'] for sh in m.get('sheets', []))))
    print('лист «%s»: %s' % (SHEET, 'есть' if sheet_props(m, SHEET) else 'нет — python3 tools/inbox-google.py setup'))
    return 0


def setup():
    """Форма в пустой таблице. Лист с данными не трогаем: если «Ссылки» уже есть и в нём что-то
    вписано — только шапка и оформление."""
    s, _ = session()
    fid = sheet_id()
    m = props(s, fid)
    reqs = []
    main = sheet_props(m, SHEET)
    if not main:
        first = m['sheets'][0]['properties']
        # пустой первый лист новой таблицы («Лист1», «Sheet1») — становится формой
        rows = values(s, fid, "'%s'!A1:C5" % first['title'])
        if not rows and len(m['sheets']) == 1:
            reqs.append({'updateSheetProperties': {'properties': {'sheetId': first['sheetId'], 'title': SHEET}, 'fields': 'title'}})
            main = {'sheetId': first['sheetId'], 'title': SHEET}
        else:
            reqs.append({'addSheet': {'properties': {'title': SHEET, 'index': 0}}})
    batch(s, fid, reqs)
    m = props(s, fid)
    main = sheet_props(m, SHEET)
    sid = main['sheetId']
    r = s.put(API + fid + "/values/'%s'!A1:C1" % SHEET, params={'valueInputOption': 'RAW'}, json={'values': [HEADER]})
    if not r.ok:
        fail(r, 'шапка')
    reqs = [
        {'updateSheetProperties': {'properties': {'sheetId': sid, 'gridProperties': {'frozenRowCount': 1, 'columnCount': 3}}, 'fields': 'gridProperties(frozenRowCount,columnCount)'}},
        {'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': 1},
                        'cell': {'userEnteredFormat': {'textFormat': {'bold': True}, 'backgroundColor': {'red': 0.93, 'green': 0.93, 'blue': 0.93}}},
                        'fields': 'userEnteredFormat(textFormat,backgroundColor)'}},
        {'repeatCell': {'range': {'sheetId': sid, 'startRowIndex': 1},
                        'cell': {'userEnteredFormat': {'wrapStrategy': 'WRAP', 'verticalAlignment': 'TOP'}},
                        'fields': 'userEnteredFormat(wrapStrategy,verticalAlignment)'}},
    ]
    for i, w in enumerate([420, 300, 360]):
        reqs.append({'updateDimensionProperties': {'range': {'sheetId': sid, 'dimension': 'COLUMNS', 'startIndex': i, 'endIndex': i + 1},
                                                   'properties': {'pixelSize': w}, 'fields': 'pixelSize'}})
    if not sheet_props(m, HELP):
        reqs.append({'addSheet': {'properties': {'title': HELP}}})
    batch(s, fid, reqs)
    r = s.put(API + fid + "/values/'%s'!A1:A%d" % (HELP, len(HELP_TEXT)), params={'valueInputOption': 'RAW'}, json={'values': HELP_TEXT})
    if not r.ok:
        fail(r, 'памятка')
    print('форма готова: лист «%s» (шапка, закреплена), памятка «%s»' % (SHEET, HELP))
    return 0


def read_rows(s, fid):
    """Строки формы: номер (с 2), ячейки, ссылки из первой ячейки (их может быть несколько)."""
    out = []
    for i, row in enumerate(values(s, fid, "'%s'!A2:C" % SHEET)):
        cells = [(row[j] if j < len(row) else '').strip() for j in range(3)]
        if not any(cells):
            continue
        urls = URL_RE.findall(cells[0]) or URL_RE.findall(' '.join(cells))
        out.append({'row': i + 2, 'cells': cells, 'urls': urls})
    return out


def pull():
    s, _ = session()
    rows = read_rows(s, sheet_id())
    items = []
    for r in rows:
        for u in r['urls']:
            items.append({'url': u, 'film': r['cells'][1] or None, 'note': r['cells'][2] or None, 'row': r['row']})
    # строки без единой ссылки — вписано не то; их не трогаем и показываем
    bad = [r for r in rows if not r['urls']]
    json.dump({'items': items, 'rows': rows, 'bad': bad}, sys.stdout, ensure_ascii=False)
    return 0


def clear(held_file):
    """Удалить строки, все ссылки которых сервер подтвердил. Перед удалением строки читаются заново:
    строка, поменявшаяся после забора, остаётся до следующего раза."""
    held_doc = json.load(open(held_file, encoding='utf-8'))
    held = set(held_doc.get('held', []))
    taken = {r['row']: r['cells'] for r in held_doc.get('rows', [])}
    s, _ = session()
    fid = sheet_id()
    m = props(s, fid)
    main = sheet_props(m, SHEET)
    if not main:
        sys.exit('нет листа «%s»' % SHEET)
    drop = []
    kept = 0
    for r in read_rows(s, fid):
        if r['urls'] and all(u in held for u in r['urls']) and taken.get(r['row']) == r['cells']:
            drop.append(r['row'])
        else:
            kept += 1
    reqs = [{'deleteDimension': {'range': {'sheetId': main['sheetId'], 'dimension': 'ROWS', 'startIndex': row - 1, 'endIndex': row}}}
            for row in sorted(drop, reverse=True)]
    batch(s, fid, reqs)
    # форма не должна усохнуть до шапки: пустые строки для следующих ссылок
    m = props(s, fid)
    count = sheet_props(m, SHEET)['gridProperties']['rowCount']
    if count < KEEP_ROWS:
        batch(s, fid, [{'appendDimension': {'sheetId': main['sheetId'], 'dimension': 'ROWS', 'length': KEEP_ROWS - count}}])
    print(json.dumps({'deleted': len(drop), 'kept': kept}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'check':
        sys.exit(check())
    if cmd == 'setup':
        sys.exit(setup())
    if cmd == 'pull':
        sys.exit(pull())
    if cmd == 'clear' and len(sys.argv) > 2:
        sys.exit(clear(sys.argv[2]))
    sys.exit(__doc__)
