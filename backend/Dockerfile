# --- Etapa 1: build de dependencias ---
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Etapa 2: imagen final, sin toolchain de compilación ni tests ---
FROM python:3.12-slim

RUN useradd --create-home --shell /usr/sbin/nologin appuser
COPY --from=builder /install /usr/local

WORKDIR /app
COPY app ./app
RUN chown -R appuser:appuser /app

USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/muestras', timeout=2)" || exit 1
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
