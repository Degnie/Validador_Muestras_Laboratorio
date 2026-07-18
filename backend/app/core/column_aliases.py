"""Known header variants seen across lab areas -> canonical column name."""

COLUMN_ALIASES: dict[str, str] = {
    "idmuestra": "id_muestra",
    "id_muestra": "id_muestra",
    "codigomuestra": "id_muestra",
    "fecharecepcion": "fecha_recepcion",
    "prueba": "prueba",
    "pruebarequerida": "prueba_requerida",
    "resultado": "resultado",
    "validado": "validado",
}
