# -*- coding: utf-8 -*-
"""Таблица разметки в Google Drive: проверить доступ, скачать, залить новую версию.

    python3 tools/markup-google.py check | pull | push

Ключ сервисного аккаунта — ~/.config/recomend/google-sa.json (или GOOGLE_SA_FILE): вне
проекта, потому что репозиторий публичный, а архивы проекта уже однажды унесли .env.local.
ID файла — MARKUP_SHEET_ID в .env.local, не в коде: по ID и ссылке «для всех» таблицу открыл
бы кто угодно из читающих репозиторий.

push меняет содержимое того же файла (Drive API, files.update): ссылка, доступы и история
версий в Google остаются. Перед заливкой сверяется время изменения со временем последнего
pull — если за это время таблицу кто-то правил, заливка отменяется, чтобы не стереть правку.
После заливки сверяется MD5: Google считает его сам, так что совпадение значит, что лёг
ровно наш файл.

Нужны google-auth и requests (их ставит deploy/markup-sync.command в .cache/venv).
"""
import hashlib, json, os, shutil, sys, time
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKUP = os.path.join(ROOT, '.cache/markup')
PULLED = os.path.join(MARKUP, 'google.xlsx')
META = os.path.join(MARKUP, 'google.meta.json')
BUILT = os.path.join(MARKUP, 'film_reviews.xlsx')
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
API = 'https://www.googleapis.com/drive/v3/files/'
UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files/'


def env_local(name):
    """Переменная из окружения или .env.local — питон .env.local сам не читает."""
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
        key, scopes=['https://www.googleapis.com/auth/drive'])
    return AuthorizedSession(creds), creds.service_account_email


def file_id():
    fid = env_local('MARKUP_SHEET_ID')
    if not fid:
        sys.exit('нет MARKUP_SHEET_ID в .env.local — это id из ссылки на таблицу (/d/<id>/)')
    return fid


def meta(s, fid):
    r = s.get(API + fid, params={'supportsAllDrives': 'true',
              'fields': 'id,name,mimeType,size,modifiedTime,md5Checksum,capabilities(canEdit)'})
    if r.status_code == 404:
        sys.exit('файл не виден сервисному аккаунту — выдайте ему доступ в «Настройках доступа»')
    r.raise_for_status()
    return r.json()


def check():
    s, email = session()
    m = meta(s, file_id())
    print('аккаунт: %s' % email)
    print('файл: %s (%s), изменён %s' % (m['name'], m['mimeType'].rsplit('.', 1)[-1], m['modifiedTime']))
    can = m.get('capabilities', {}).get('canEdit')
    print('может править: %s' % ('да' if can else 'НЕТ — выдайте аккаунту права редактора'))
    return 0 if can else 1


def pull():
    s, _ = session()
    fid = file_id()
    m = meta(s, fid)
    r = s.get(API + fid, params={'alt': 'media', 'supportsAllDrives': 'true'})
    r.raise_for_status()
    if r.content[:2] != b'PK':
        sys.exit('вместо xlsx пришло что-то другое (%s) — таблицу пересоздали как родную Google-таблицу?'
                 % r.headers.get('content-type'))
    os.makedirs(os.path.join(MARKUP, 'backups'), exist_ok=True)
    open(PULLED, 'wb').write(r.content)
    # копия каждой скачанной версии: заливка заменяет файл целиком, и если в разметке что-то
    # пойдёт не так, вернуть можно отсюда (и из истории версий в самом Google)
    stamp = time.strftime('%Y-%m-%d-%H%M%S')
    open(os.path.join(MARKUP, 'backups', 'google-%s.xlsx' % stamp), 'wb').write(r.content)
    json.dump({'modifiedTime': m['modifiedTime'], 'pulledAt': stamp}, open(META, 'w'))
    print('скачал: %.1f КБ, версия от %s → %s' % (len(r.content) / 1024, m['modifiedTime'],
                                                   os.path.relpath(PULLED, ROOT)))
    return 0


def push():
    s, _ = session()
    fid = file_id()
    if not os.path.exists(META):
        sys.exit('сначала pull: без него не с чем сверить, не правил ли кто таблицу')
    was = json.load(open(META))['modifiedTime']
    m = meta(s, fid)
    if not m.get('capabilities', {}).get('canEdit'):
        sys.exit('аккаунт не может править файл — выдайте ему права редактора')
    if m['modifiedTime'] != was:
        sys.exit('таблицу правили после скачивания (%s → %s). Ничего не залил: запустите '
                 'синхронизацию заново, она заберёт и эту правку.' % (was, m['modifiedTime']))
    body = open(BUILT, 'rb').read()
    r = s.patch(UPLOAD + fid, params={'uploadType': 'media', 'supportsAllDrives': 'true',
                'fields': 'id,modifiedTime,md5Checksum,size'},
                data=body, headers={'Content-Type': XLSX})
    r.raise_for_status()
    got = r.json()
    ok = got.get('md5Checksum') == hashlib.md5(body).hexdigest()
    json.dump({'modifiedTime': got['modifiedTime'], 'pushedAt': time.strftime('%Y-%m-%d-%H%M%S')}, open(META, 'w'))
    # снимок того, что теперь лежит в Google: по нему import-markup отличит правку человека
    # от догадки машины, которую мы сами туда положили
    if ok:
        shutil.copyfile(os.path.join(MARKUP, 'film-reviews.json'), os.path.join(MARKUP, 'pushed.json'))
    print('залил: %.1f КБ, версия от %s, MD5 %s' % (len(body) / 1024, got['modifiedTime'],
                                                  'совпал' if ok else 'НЕ СОВПАЛ'))
    return 0 if ok else 1


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    sys.exit({'check': check, 'pull': pull, 'push': push}.get(cmd, lambda: sys.exit('check | pull | push'))())
