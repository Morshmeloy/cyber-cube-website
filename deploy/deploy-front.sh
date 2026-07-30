#!/bin/bash
set -e

# === НАСТРОЙКИ ===
SERVER="user@your-server-ip"
SSH_KEY="$HOME/.ssh/id_ed25519"
APP_DIR="/home/user/d4tech"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Сборка фронта..."
cd "$PROJECT_ROOT/frontend" && npm run build

echo "==> Загрузка на сервер..."
ssh -i "$SSH_KEY" "$SERVER" "mkdir -p $APP_DIR/deploy/dist"
rsync -avz --delete \
  -e "ssh -i $SSH_KEY" \
  "$PROJECT_ROOT/frontend/dist/" "$SERVER:$APP_DIR/deploy/dist/"

echo "Фронт задеплоен!"
