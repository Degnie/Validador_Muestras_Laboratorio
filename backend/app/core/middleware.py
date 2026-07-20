import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

MAX_BODY_BYTES = 1 * 1024 * 1024  # 1 MB: esta API es de solo lectura, no espera payloads grandes.

BASE_SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    """Rechaza requests cuyo Content-Length declarado supere el límite, antes de leer el body."""

    def __init__(self, app, max_bytes: int = MAX_BODY_BYTES):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length is not None and int(content_length) > self.max_bytes:
            return JSONResponse(
                status_code=413,
                content={"detail": f"Payload demasiado grande (máximo {self.max_bytes} bytes)"},
            )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """`csp_default_src`: 'self' cuando este mismo proceso sirve el bundle de React (el
    ejecutable todo-en-uno), 'none' cuando es solo API JSON detrás de otro servidor (nginx,
    que ya pone su propia CSP para los estáticos que sirve él)."""

    def __init__(self, app, csp_default_src: str = "none"):
        super().__init__(app)
        self.headers = {
            **BASE_SECURITY_HEADERS,
            "Content-Security-Policy": f"default-src '{csp_default_src}'",
        }

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.update(self.headers)
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window limit per client IP, in-process memory (single-worker-friendly; a
    shared store like Redis is only needed once this runs behind >1 gunicorn worker).

    Solo cuenta contra `/api/*`. En el despliegue con nginx esto era automático (nginx sirve
    los estáticos sin pasar por acá); en el ejecutable todo-en-uno este mismo proceso también
    sirve el bundle de React, y una sola carga de página ya son ~10 requests (HTML + JS +
    CSS + fuentes) -- si esos contaran contra el límite, un par de recargas agotarían el
    cupo y romperían la SPA entera (buscador, export, auto-refresh) sin que hubiera abuso
    real de la API."""

    def __init__(self, app, max_requests: int = 60, window_seconds: float = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = self._hits[client_ip]
        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()

        if len(hits) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Demasiadas solicitudes, intentá de nuevo en un momento"},
                headers={"Retry-After": str(int(self.window_seconds))},
            )

        hits.append(now)
        return await call_next(request)
