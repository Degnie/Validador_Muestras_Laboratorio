# ADR-001: Stack Tecnológico

## Estado

Aceptado.

## Contexto

El laboratorio hoy verifica manualmente, área por área, que cada muestra
tenga todas las pruebas requeridas antes de emitir el informe final. Esa
verificación cruza cuatro fuentes de Excel (Recepción, Análisis Químico,
Validación de Informes y un Checklist Maestro) que pueden tener columnas
renombradas, IDs de muestra con typos, y desfases de actualización entre
archivos. El objetivo de este MVP es automatizar ese cruce en un dashboard
de solo lectura, sin tocar los procesos ni los Excel originales.

## Decisión

- **Backend: FastAPI (Python).** Expone la API de forma asíncrona y con
  tipado (Pydantic) sin el boilerplate de otros frameworks. Python es
  también el lenguaje natural para el punto siguiente.
- **Procesamiento de datos: Pandas + TheFuzz.** Pandas es la herramienta
  estándar para leer, normalizar y cruzar múltiples DataFrames de Excel
  (manejo de columnas alteradas, tipos, valores faltantes). TheFuzz aporta
  la búsqueda difusa necesaria para tolerar errores tipográficos en los IDs
  de muestra al cruzarlos contra el Checklist Maestro.
- **Frontend: React + TypeScript + Vite.** Separar el dashboard del backend
  permite iterar la UI (tabla de estados, alertas de desfase) sin redeploy
  del servicio de datos, y el tipado compartido (los mismos campos que
  expone la API) reduce errores de integración. Vite da un ciclo de
  desarrollo rápido para un proyecto de este tamaño.
- **Separación frontend/backend** en vez de un monolito (p. ej. Flask +
  Jinja) porque el dashboard necesita refrescos frecuentes e interactividad
  (filtros, alertas) que un enfoque de solo plantillas server-side haría
  más rígido, y porque escala mejor si más adelante se agregan más
  vistas o consumidores de la misma API.

## Consecuencias

- Dos procesos a correr en desarrollo (API en `:8000`, Vite en `:5173`),
  mitigado con el proxy de Vite hacia `/api`.
- Python 3.14 (versión instalada en esta máquina) no tiene wheels
  precompilados para las versiones "clásicas" fijadas originalmente
  (`pandas==2.2.3`, `pydantic==2.10.4`) y no hay toolchain de compilación
  (MSVC/Rust) disponible para compilarlas desde código fuente. Se resolvió
  subiendo esas dependencias a las primeras versiones que sí publican wheel
  para `cp314` (`pandas==3.0.3`, `pydantic==2.13.4`, `fastapi==0.121.2`) y
  omitiendo `python-Levenshtein` (acelerador clásico de `thefuzz` sin
  wheel para 3.14). Corrección posterior: no hizo falta que `thefuzz`
  cayera a Python puro — desde la 0.20, `thefuzz` delega internamente en
  `rapidfuzz` (C++, vectorizado con SIMD), que sí tiene wheel para 3.14. La
  búsqueda difusa y por código ya corre acelerada sin ningún cambio de
  código; solo se fijó `rapidfuzz` explícito en `requirements.txt` para que
  esa dependencia real deje de estar oculta detrás de `thefuzz`. El stack
  elegido (React + FastAPI + Pandas) no cambió.
