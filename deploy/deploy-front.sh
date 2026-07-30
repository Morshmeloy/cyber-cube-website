#!/bin/bash
set -e

# === НАСТРОЙКИ ===
SERVER="macar@192.168.0.188"
SSH_KEY="$HOME/.ssh/id_ed25519"
APP_DIR="/home/macar/d4tech"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Сборка фронта..."
cd "$PROJECT_ROOT/frontend" && npm run build

echo "==> Загрузка на сервер (во временную папку)..."
ssh -i "$SSH_KEY" "$SERVER" "mkdir -p $APP_DIR/deploy/dist"
rsync -avz --delete \
  -e "ssh -i $SSH_KEY" \
  "$PROJECT_ROOT/frontend/dist/" "$SERVER:$APP_DIR/deploy/dist/"

echo "==> Перенос в докорут хостового nginx (/usr/share/nginx/html)..."
ssh -t -i "$SSH_KEY" "$SERVER" "sudo rsync -a --delete $APP_DIR/deploy/dist/ /usr/share/nginx/html/ && sudo chown -R www-data:www-data /usr/share/nginx/html"

echo "Фронт задеплоен!"
