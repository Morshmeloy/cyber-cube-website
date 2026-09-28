#!/usr/bin/env bash
# Включает штатную адресную книгу SOGo «Собранные адреса» в Mailcow.
# Скрипт идемпотентен: повторный запуск не добавляет дубли параметров.
set -Eeuo pipefail
umask 077

D4_MAILCOW_DIR="${1:-/opt/mailcow-dockerized}"
D4_CONFIG="$D4_MAILCOW_DIR/data/conf/sogo/sogo.conf"
D4_BACKUP_ROOT="${D4_SOGO_BACKUP_ROOT:-/var/backups/d4-sogo-collected-addresses}"
D4_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
D4_BACKUP="$D4_BACKUP_ROOT/$D4_STAMP"
D4_CANDIDATE=""
D4_INSTALLED=0

cleanup() {
    if [[ -n "$D4_CANDIDATE" ]]; then
        rm -f -- "$D4_CANDIDATE"
    fi
}

rollback() {
    D4_STATUS=$?
    trap - ERR
    set +e

    echo >&2
    echo "ОШИБКА — восстанавливаю прежнюю конфигурацию SOGo" >&2
    if [[ "$D4_INSTALLED" -eq 1 && -f "$D4_BACKUP/sogo.conf" ]]; then
        cp -a -- "$D4_BACKUP/sogo.conf" "$D4_CONFIG"
        (
            cd "$D4_MAILCOW_DIR"
            docker compose restart memcached-mailcow sogo-mailcow
        )
        echo "Предыдущая конфигурация восстановлена" >&2
    fi
    cleanup
    exit "$D4_STATUS"
}

trap cleanup EXIT
trap rollback ERR

if [[ "${EUID}" -ne 0 ]]; then
    echo "Запустите скрипт через sudo" >&2
    exit 1
fi

command -v docker >/dev/null
command -v python3 >/dev/null
test -f "$D4_CONFIG"
test -f "$D4_MAILCOW_DIR/docker-compose.yml"
docker compose version >/dev/null

echo "1/6 — резервная копия"
mkdir -p -- "$D4_BACKUP"
cp -a -- "$D4_CONFIG" "$D4_BACKUP/sogo.conf"
echo "Rollback: $D4_BACKUP/sogo.conf"

echo
echo "2/6 — подготовка конфигурации"
D4_CANDIDATE="$(mktemp "${D4_CONFIG}.candidate.XXXXXX")"

# Python здесь используется как безопасный парсер текста: он меняет только два
# параметра и вставляет их перед последней закрывающей скобкой конфигурации.
python3 - "$D4_CONFIG" "$D4_CANDIDATE" <<'PY'
from pathlib import Path
import re
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
text = source.read_text(encoding="utf-8")


def set_once(config: str, key: str, value: str) -> str:
    # Закомментированные строки вида // Key = ... не считаются настройкой.
    pattern = re.compile(
        rf"(?m)^(?![ \t]*//)[ \t]*{re.escape(key)}[ \t]*=[^;\n]*;[ \t]*$"
    )
    matches = list(pattern.finditer(config))
    if len(matches) > 1:
        raise SystemExit(f"Найдено несколько активных параметров {key}; исправьте вручную")
    line = f"    {key} = {value};"
    if matches:
        return pattern.sub(line, config, count=1)

    closing_brace = config.rfind("}")
    if closing_brace < 0:
        raise SystemExit("В sogo.conf не найдена закрывающая скобка")
    return config[:closing_brace] + line + "\n" + config[closing_brace:]


text = set_once(text, "SOGoMailAddOutgoingAddresses", "YES")
text = set_once(text, "SOGoSelectedAddressBook", "collected")
target.write_text(text, encoding="utf-8")
PY

chmod --reference="$D4_CONFIG" "$D4_CANDIDATE"
chown --reference="$D4_CONFIG" "$D4_CANDIDATE"

grep -Eq '^[[:space:]]*SOGoMailAddOutgoingAddresses[[:space:]]*=[[:space:]]*YES;' "$D4_CANDIDATE"
grep -Eq '^[[:space:]]*SOGoSelectedAddressBook[[:space:]]*=[[:space:]]*collected;' "$D4_CANDIDATE"

echo
echo "3/6 — установка"
if cmp -s -- "$D4_CONFIG" "$D4_CANDIDATE"; then
    echo "Настройки уже включены"
else
    mv -f -- "$D4_CANDIDATE" "$D4_CONFIG"
    D4_CANDIDATE=""
    D4_INSTALLED=1
    echo "Конфигурация обновлена"
fi

echo
echo "4/6 — перезапуск только SOGo и Memcached"
cd "$D4_MAILCOW_DIR"
docker compose config --quiet
docker compose restart memcached-mailcow sogo-mailcow

echo
echo "5/6 — ожидание контейнеров"
D4_READY=0
for D4_ATTEMPT in $(seq 1 30); do
    D4_RUNNING="$(docker compose ps --status running --services)"
    if grep -qx 'sogo-mailcow' <<<"$D4_RUNNING" &&
       grep -qx 'memcached-mailcow' <<<"$D4_RUNNING"; then
        D4_READY=1
        echo "Контейнеры запущены: попытка $D4_ATTEMPT/30"
        break
    fi
    sleep 2
done
test "$D4_READY" -eq 1

echo
echo "6/6 — итоговая проверка"
grep -nE 'SOGoMailAddOutgoingAddresses|SOGoSelectedAddressBook' "$D4_CONFIG"
docker compose ps sogo-mailcow memcached-mailcow

echo
echo "СОХРАНЕНИЕ АДРЕСАТОВ ВКЛЮЧЕНО"
echo "Новые неизвестные адресаты будут попадать в «Собранные адреса» после отправки письма."
echo "Ранее отправленные адресаты автоматически не восстанавливаются."
echo "Rollback: $D4_BACKUP/sogo.conf"
