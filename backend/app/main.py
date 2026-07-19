import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.muestras import router as muestras_router
from app.core.config import Settings
from app.core.middleware import MaxBodySizeMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="Validador Centralizado de Muestras de Laboratorio")
    app.state.settings = settings or Settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(MaxBodySizeMiddleware)
    app.add_middleware(RateLimitMiddleware)

    @app.exception_handler(Exception)
    async def sanitized_error_handler(request: Request, exc: Exception) -> JSONResponse:
        # Nunca devolver el mensaje/traceback real al cliente: solo va al log del servidor.
        logger.exception("Error no controlado en %s", request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})

    app.include_router(muestras_router)
    return app


app = create_app()
