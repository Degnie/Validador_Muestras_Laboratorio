from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.muestras import router as muestras_router
from app.core.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="Validador Centralizado de Muestras de Laboratorio")
    app.state.settings = settings or Settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    app.include_router(muestras_router)
    return app


app = create_app()
