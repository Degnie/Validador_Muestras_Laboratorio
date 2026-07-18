from fastapi import APIRouter, Request

from app.models.schemas import DashboardResponse
from app.services.fuzzy_match import correct_ids
from app.services.ingestion import check_file_freshness, read_excel_normalized
from app.services.validation_rules import build_status

router = APIRouter(prefix="/api")


@router.get("/muestras", response_model=DashboardResponse)
def get_muestras(request: Request) -> DashboardResponse:
    settings = request.app.state.settings

    checklist = read_excel_normalized(settings.checklist_path)
    area2 = read_excel_normalized(settings.area2_path)

    master_ids = sorted(checklist["id_muestra"].unique())
    area2["id_muestra"] = correct_ids(area2["id_muestra"], master_ids)

    estados = build_status(checklist, area2)
    alertas_desfase = check_file_freshness(settings.area_paths)

    return DashboardResponse(
        muestras=estados.to_dict(orient="records"),
        alertas_desfase=alertas_desfase,
    )
