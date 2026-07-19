"""Known header variants seen across lab areas -> canonical column name."""

COLUMN_ALIASES: dict[str, str] = {
    "id": "id_muestra",
    "idmuestra": "id_muestra",
    "id_muestra": "id_muestra",
    "codigomuestra": "id_muestra",
    "fecharecepcion": "fecha_recepcion",
    "prueba": "prueba",
    "pruebarequerida": "prueba_requerida",
    "tipoanalisis": "tipo_analisis",
    "resultado": "resultado",
    "valor": "valor",
    "validado": "validado",
    "tecnicoquerealizo": "tecnico",
    "tecnico": "tecnico",
    "fecha": "fecha",
}
