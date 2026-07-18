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
# Forma shell (vía `sh -c` + `exec`) en vez de la forma exec de array: es lo que permite que
# ${WEB_CONCURRENCY:-1} se expanda en runtime (Docker no expande variables dentro de un CMD en
# forma exec). `exec` reemplaza el proceso de sh por gunicorn, así gunicorn sigue siendo PID 1
# y recibe las señales de Docker directo, sin perder la semántica de la forma exec.
# -w ${WEB_CONCURRENCY:-1}: un solo worker por defecto, alineado a los 512M de
# deploy.resources.limits.memory (más de un worker Uvicorn + un DataFrame de Pandas cada uno
# puede superar ese límite). --max-requests recicla el worker cada N requests para cortar
# fugas de memoria acumuladas en procesos de larga vida.
CMD ["sh", "-c", "exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 -w ${WEB_CONCURRENCY:-1} --max-requests 1000"]
