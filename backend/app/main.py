import logging
import os
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.muestras import router as muestras_router
from app.core.config import Settings
from app.core.middleware import MaxBodySizeMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware

logger = logging.getLogger(__name__)


def _base_path() -> Path:
    # PyInstaller --onedir (desde 6.0): sys._MEIPASS es la carpeta "_internal" que
    # acompaña al .exe, no la carpeta del .exe en sí -- ahí es donde --add-data deja los
    # datos empaquetados (el "dist" del frontend). En dev, dos niveles arriba de este
    # archivo (backend/app/main.py -> backend/).
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent


def _env_dir() -> Path:
    # El .env vive junto al .exe -- lo que el analista realmente ve y edita en el
    # Explorador de Windows -- no en "_internal", que es donde queda el resto de los
    # datos empaquetados. En dev coincide con _base_path().
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return _base_path()


def _load_env_file(path: Path) -> None:
    # ponytail: parser .env mínimo (KEY=VALUE, sin comillas/expansión) -- alcanza para la
    # única variable que el manual le pide tocar al analista (DATA_DIR), sin sumar
    # python-dotenv como dependencia nueva. Si hace falta algo más rico más adelante, ahí
    # sí vale la pena esa librería.
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


BASE_PATH = _base_path()
_load_env_file(_env_dir() / ".env")
DIST_PATH = BASE_PATH / "dist"
SERVE_SPA = DIST_PATH.is_dir()


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="Validador Centralizado de Muestras de Laboratorio")
    app.state.settings = settings or Settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware, csp_default_src="self" if SERVE_SPA else "none")
    app.add_middleware(MaxBodySizeMiddleware)
    app.add_middleware(RateLimitMiddleware)

    @app.exception_handler(Exception)
    async def sanitized_error_handler(request: Request, exc: Exception) -> JSONResponse:
        # Nunca devolver el mensaje/traceback real al cliente: solo va al log del servidor.
        logger.exception("Error no controlado en %s", request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})

    app.include_router(muestras_router)

    if SERVE_SPA:
        app.mount("/assets", StaticFiles(directory=DIST_PATH / "assets"), name="assets")

        @app.get("/{catchall:path}", include_in_schema=False)
        def serve_react_app(catchall: str):
            # Registrada al final: /api/*, /docs, /openapi.json ya fueron resueltas antes de
            # llegar acá, así que este catch-all solo ve rutas de la SPA (o basura).
            if catchall.startswith("api/"):
                return JSONResponse(status_code=404, content={"detail": "Endpoint no encontrado"})
            static_file = DIST_PATH / catchall
            if catchall and static_file.is_file():
                return FileResponse(static_file)
            return FileResponse(DIST_PATH / "index.html")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    # 127.0.0.1, no 0.0.0.0: este proceso corre sin autenticación en una PC de escritorio
    # de laboratorio que comparte red con otras áreas -- el manual solo pide entrar por
    # localhost, escuchar en todas las interfaces expondría el validador a esa red sin motivo.
    uvicorn.run(app, host="127.0.0.1", port=8000)
