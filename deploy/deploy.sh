#!/bin/bash
set -e

cd "$(dirname "$0")"

bash deploy-front.sh
bash deploy-back.sh

echo "Всё задеплоено!"
