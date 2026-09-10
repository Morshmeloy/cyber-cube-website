# Внутренний ИИ-преподаватель D4Tech

Рабочий сервис: `teacher_service.main:app` (FastAPI), Ollama и Chroma. Docker Compose запускает один worker; веб-браузер обращается к нему через авторизованный основной API, а не напрямую.

- [Исправления и общая схема](../README.md)
- [Исследование RAG](../docs/teacher-rag-design.md)
- [Проверки, внедрение и откат](../docs/teacher-validation-rollout.md)
- [Исторический README автономного теста](README.legacy.md) — не инструкция к текущему production-сервису.

## Настройка

Скопировать `env.ai.example` в `.env.ai`, задать собственный случайный `TEACHER_SERVICE_TOKEN` длиной не менее 32 символов и доступные адреса Ollama/teacher. Тот же token должен быть настроен только в основном API. Не передавать его во frontend. Подготовить модели, указанные в env; сохранить прежний Chroma volume при обновлении.

```bash
docker compose -f docker-compose.ai.yml build
docker compose -f docker-compose.ai.yml up -d teacher
```

`/health` подтверждает жизнь процесса; готовность моделей и индекса проверяется служебным `/v1/status`. Генерации: `/v1/chat/mistakes`, `/v1/chat/detail`, `/v1/chat/free`. Все служебные пути требуют `X-Teacher-Token`.

Ограничения очереди действуют в одном процессе. Не увеличивать workers/replicas без общей очереди. Индексатор `index_pdf.py` поддерживает один PDF за запуск и сохраняет резервную коллекцию; обновление индекса требует окна обслуживания. Метаданные страницы — происхождение фрагмента, а не автоматическая гарантия истинности цитаты модели.

## Тесты

Из корня репозитория:

```bash
uv sync --frozen --project teacher
uv run --project teacher python -m pytest teacher/tests
```
