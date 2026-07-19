import io
from datetime import UTC, datetime

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.models.ingestion_schemas import ChecklistRow, PruebaRow
from app.models.schemas import DashboardResponse, NotificacionEvento
from app.services.fuzzy_match import correct_ids, search_by_code
from app.services.ingestion import (
    append_notificacion_csv,
    assert_safe_excel_file,
    check_file_freshness,
    read_excel_multisheet_normalized,
    read_excel_normalized,
    validate_rows,
)
from app.services.validation_rules import build_status

router = APIRouter(prefix="/api")

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _build_estados(settings) -> tuple[pd.DataFrame, list[str]]:
    try:
        for path in settings.source_paths.values():
            assert_safe_excel_file(path)

        checklist = read_excel_normalized(settings.checklist_path)
        checklist, errores_checklist = validate_rows(checklist, ChecklistRow)

        hojas = read_excel_multisheet_normalized(settings.datos_path)
        datos_por_hoja = []
        errores_datos: list[str] = []
        for nombre_hoja, hoja in hojas.items():
            hoja = hoja.copy()
            hoja["prueba"] = nombre_hoja
            hoja_validada, errores_hoja = validate_rows(hoja, PruebaRow)
            datos_por_hoja.append(hoja_validada)
            errores_datos.extend(f"{nombre_hoja} - {e}" for e in errores_hoja)
        datos = (
            pd.concat(datos_por_hoja, ignore_index=True)
            if datos_por_hoja
            else pd.DataFrame(columns=list(PruebaRow.model_fields.keys()))
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # openpyxl/zipfile errors on a corrupt or malicious file
        raise HTTPException(status_code=422, detail=f"Excel ilegible: {exc}") from exc

    master_ids = sorted(checklist["id_muestra"].unique())
    datos["id_muestra"] = correct_ids(
        datos["id_muestra"], master_ids, threshold=settings.fuzzy_correct_threshold
    )

    return build_status(checklist, datos), errores_checklist + errores_datos


@router.get("/muestras", response_model=DashboardResponse)
def get_muestras(request: Request) -> DashboardResponse:
    settings = request.app.state.settings
    estados, errores_validacion = _build_estados(settings)
    alertas_desfase = check_file_freshness(settings.source_paths)

    return DashboardResponse(
        muestras=estados.to_dict(orient="records"),
        alertas_desfase=alertas_desfase,
        errores_validacion=errores_validacion,
    )


@router.get("/muestras/buscar", response_model=DashboardResponse)
def buscar_muestras(request: Request, q: str = Query(default="")) -> DashboardResponse:
    settings = request.app.state.settings
    estados, errores_validacion = _build_estados(settings)

    coincidencias = set(search_by_code(q, list(estados["id_muestra"]), threshold=settings.fuzzy_search_threshold))
    estados = estados[estados["id_muestra"].isin(coincidencias)]
    alertas_desfase = check_file_freshness(settings.source_paths)

    return DashboardResponse(
        muestras=estados.to_dict(orient="records"),
        alertas_desfase=alertas_desfase,
        errores_validacion=errores_validacion,
    )


# Mismo rename que ya se aplica en la UI (Dashboard.tsx::ESTADO_LABEL): "Pruebas Fantasma" es
# el valor interno del contrato de la API, no lo que debe leer un técnico en el reporte.
ESTADO_LABEL_EXCEL = {"Completo": "Completo", "Faltante": "Faltante", "Pruebas Fantasma": "Pruebas Adicionales"}


def _build_reporte_excel(estados: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Arma el Excel que baja un técnico (no un programador): sin listas/dicts de Python
    literales en ninguna celda -- pruebas_faltantes/pruebas_fantasma se unen en texto plano, y
    el detalle de cada prueba pasa a su propia hoja, una fila por prueba, ordenada por ID y
    nombre de prueba (mucho más fácil de ordenar/filtrar en Excel que un blob desordenado)."""
    resumen = pd.DataFrame(
        {
            "ID": estados["id_muestra"],
            "Estado": estados["estado"].map(ESTADO_LABEL_EXCEL),
            "Tipo_analisis": estados["tipo_analisis"],
            "Pruebas_faltantes": estados["pruebas_faltantes"].apply(lambda ps: ", ".join(ps) if ps else "Ninguna"),
            "Pruebas_adicionales": estados["pruebas_fantasma"].apply(lambda ps: ", ".join(ps) if ps else "Ninguna"),
        }
    )

    detalle_filas = []
    for _, fila in estados.iterrows():
        realizadas = {p["nombre_prueba"]: p for p in fila["pruebas"]}
        exigidas = sorted(set(fila["pruebas_faltantes"]) | (set(realizadas) - set(fila["pruebas_fantasma"])))
        for nombre in exigidas:
            prueba = realizadas.get(nombre)
            detalle_filas.append(
                {
                    "ID": fila["id_muestra"],
                    "Prueba": nombre,
                    "Resultado": prueba["resultado"] if prueba else "Pendiente",
                    "Valor": prueba["valor"] if prueba else "—",
                    "Tecnico": prueba["tecnico"] if prueba else "—",
                    "Fecha": prueba["fecha"] if prueba else "—",
                }
            )
        for nombre in sorted(fila["pruebas_fantasma"]):
            prueba = realizadas.get(nombre)
            detalle_filas.append(
                {
                    "ID": fila["id_muestra"],
                    "Prueba": f"{nombre} (adicional)",
                    "Resultado": prueba["resultado"] if prueba else "—",
                    "Valor": prueba["valor"] if prueba else "—",
                    "Tecnico": prueba["tecnico"] if prueba else "—",
                    "Fecha": prueba["fecha"] if prueba else "—",
                }
            )

    columnas_detalle = ["ID", "Prueba", "Resultado", "Valor", "Tecnico", "Fecha"]
    detalle = pd.DataFrame(detalle_filas, columns=columnas_detalle).sort_values(["ID", "Prueba"], kind="stable")
    return resumen, detalle.reset_index(drop=True)


@router.get("/muestras/exportar")
def exportar_muestras(request: Request) -> StreamingResponse:
    settings = request.app.state.settings
    estados, _errores_validacion = _build_estados(settings)
    resumen, detalle = _build_reporte_excel(estados)

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer) as writer:
        resumen.to_excel(writer, sheet_name="Resumen", index=False)
        detalle.to_excel(writer, sheet_name="Detalle_pruebas", index=False)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=validacion_muestras.xlsx"},
    )


@router.post("/notificaciones", status_code=204)
async def registrar_notificacion(evento: NotificacionEvento, request: Request) -> None:
    """La Watchlist vive en localStorage (frontend); cuando el frontend detecta que una
    prueba faltante de un item vigilado se completó, reporta el evento acá para dejar
    rastro server-side. Append en un thread aparte para no bloquear el event loop con I/O
    de archivo sincrónico (stdlib csv, sin aiofiles)."""
    settings = request.app.state.settings
    fecha_deteccion = datetime.now(UTC).isoformat()
    await run_in_threadpool(
        append_notificacion_csv,
        settings.notificaciones_csv_path,
        evento.id_muestra,
        evento.prueba,
        fecha_deteccion,
    )
