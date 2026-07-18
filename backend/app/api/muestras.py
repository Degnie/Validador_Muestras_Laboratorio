import io

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.models.ingestion_schemas import AnalisisRow, ChecklistRow
from app.models.schemas import DashboardResponse
from app.services.fuzzy_match import correct_ids, search_by_code
from app.services.ingestion import (
    assert_safe_excel_file,
    check_file_freshness,
    read_excel_normalized,
    validate_rows,
)
from app.services.validation_rules import build_status

router = APIRouter(prefix="/api")

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _build_estados(settings) -> pd.DataFrame:
    try:
        for path in settings.area_paths.values():
            assert_safe_excel_file(path)

        checklist = read_excel_normalized(settings.checklist_path)
        area2 = read_excel_normalized(settings.area2_path)
        checklist = validate_rows(checklist, ChecklistRow)
        area2 = validate_rows(area2, AnalisisRow)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # openpyxl/zipfile errors on a corrupt or malicious file
        raise HTTPException(status_code=422, detail=f"Excel ilegible: {exc}") from exc

    master_ids = sorted(checklist["id_muestra"].unique())
    area2["id_muestra"] = correct_ids(area2["id_muestra"], master_ids)

    return build_status(checklist, area2)


@router.get("/muestras", response_model=DashboardResponse)
def get_muestras(request: Request) -> DashboardResponse:
    settings = request.app.state.settings
    estados = _build_estados(settings)
    alertas_desfase = check_file_freshness(settings.area_paths)

    return DashboardResponse(
        muestras=estados.to_dict(orient="records"),
        alertas_desfase=alertas_desfase,
    )


@router.get("/muestras/buscar", response_model=DashboardResponse)
def buscar_muestras(request: Request, q: str = Query(default="")) -> DashboardResponse:
    settings = request.app.state.settings
    estados = _build_estados(settings)

    coincidencias = set(search_by_code(q, list(estados["id_muestra"])))
    estados = estados[estados["id_muestra"].isin(coincidencias)]
    alertas_desfase = check_file_freshness(settings.area_paths)

    return DashboardResponse(
        muestras=estados.to_dict(orient="records"),
        alertas_desfase=alertas_desfase,
    )


@router.get("/muestras/exportar")
def exportar_muestras(request: Request) -> StreamingResponse:
    settings = request.app.state.settings
    estados = _build_estados(settings)

    buffer = io.BytesIO()
    estados.to_excel(buffer, index=False)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=validacion_muestras.xlsx"},
    )
