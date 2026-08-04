#!/bin/bash
set -e

# === НАСТРОЙКИ ===
SERVER="macar@192.168.0.188"
SSH_KEY="$HOME/.ssh/id_ed25519"
APP_DIR="/home/macar/d4tech"
IMAGE_NAME="d4tech-web"
TAR_FILE="d4tech-backend.tar"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 1. Сборка Docker-образа бэкенда локально..."
docker build -t "$IMAGE_NAME:latest" "$PROJECT_ROOT/backend"

echo "==> 2. Сохраняем образ в архив $TAR_FILE..."
docker save -o "$TAR_FILE" "$IMAGE_NAME:latest"

echo "==> 3. Копируем архив на сервер..."
ssh -i "$SSH_KEY" "$SERVER" "mkdir -p $APP_DIR/deploy"
scp -i "$SSH_KEY" "$TAR_FILE" "$SERVER:$APP_DIR/"

echo "==> 4. Загружаем образ на сервере..."
ssh -i "$SSH_KEY" "$SERVER" "docker load -i $APP_DIR/$TAR_FILE"

echo "==> 5. Копируем конфиги деплоя (docker-compose.prod.yml, nginx.conf, .env.production)..."
rsync -avz \
  --exclude='dist' \
  --exclude='certbot-webroot' \
  -e "ssh -i $SSH_KEY" \
  "$PROJECT_ROOT/deploy/" "$SERVER:$APP_DIR/deploy/"

echo "==> 6. Запускаем контейнеры на сервере (без пересборки)..."
ssh -i "$SSH_KEY" "$SERVER" "cd $APP_DIR/deploy && docker compose -f docker-compose.prod.yml up -d"

echo "==> 7. Чистим неиспользуемые образы на сервере..."
ssh -i "$SSH_KEY" "$SERVER" "docker image prune -f"

echo "==> 8. Удаляем архив на сервере и локально..."
ssh -i "$SSH_KEY" "$SERVER" "rm -f $APP_DIR/$TAR_FILE"
rm -f "$TAR_FILE"

echo "Бэк задеплоен!"
