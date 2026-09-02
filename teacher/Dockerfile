FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_SYSTEM_PYTHON=1 PATH="/app/.venv/bin:$PATH"
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY teacher_service/ ./teacher_service/
COPY index_pdf.py ./
COPY data/ ./data/
RUN mkdir -p /app/chroma_db && useradd --system --uid 10001 --home /app teacher && chown -R teacher:teacher /app
USER teacher
CMD ["uvicorn", "teacher_service.main:app", "--host", "127.0.0.1", "--port", "8002"]
