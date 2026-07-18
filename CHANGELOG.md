# Changelog

## [1.1.0] - 2026-07-18

Esta iteración fue una auditoría orientada a preparación para producción: memoria, arquitectura de la capa de reglas y hardening de la API y los contenedores.

**Nuevos cambios implementados:**

- Refactorización de la capa de ingesta (`backend/app/services/ingestion.py`) a lectura streaming por lotes vía `openpyxl` en modo `read_only`, y agregué validación de *magic bytes* (no solo la extensión `.xlsx`) antes de intentar parsear cualquier archivo.
- Implementé el patrón Chain of Responsibility en `backend/app/services/validation_rules.py` (`ReglaPruebasFantasma` → `ReglaPruebasFaltantes` → `ReglaCompleto`) para poder agregar reglas de laboratorio nuevas sin tocar las existentes.
- Hardening de `backend/app/main.py`: límite de tamaño de payload (413), headers de seguridad (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) y un manejador de excepciones que nunca devuelve el stack trace real al cliente.
- Reescribí ambos `Dockerfile` con build multi-etapa: el backend corre con Gunicorn + workers de Uvicorn bajo un usuario `appuser` sin privilegios, y el frontend se compila con Node/Vite y se sirve con `nginx-unprivileged` (puerto 8080, sin root).
- Sincronicé el contrato de datos entre `frontend/src/types/muestra.ts` y `backend/app/models/schemas.py` agregando una guarda de forma en tiempo de ejecución (`isDashboardResponse`) en `api.ts`, para que un desalineamiento futuro sea un error explícito y no un fallo silencioso en el Dashboard.
- Manejo de errores de red resiliente: `api.ts` ahora tipa los errores como `ApiError` (con el código HTTP) y `Dashboard.tsx` los traduce a un banner con mensaje amigable en vez de dejar la pantalla en blanco o mostrar el error crudo.
- Amplié la suite de tests: casos límite de ingesta (archivos corruptos, extensión falseada, tamaño excedido), 413/422 en la API, no fuga de stack traces, y fallos de red simulados en el flujo de búsqueda/exportación del frontend.

**Hallazgo de esta iteración (no era un cambio de stock, era una corrección de documentación):** la nota que había dejado sobre que `thefuzz` corría "en modo Python puro" por no tener `python-Levenshtein` para Python 3.14 era incorrecta. Desde la versión 0.20, `thefuzz` delega internamente en `rapidfuzz` (C++, vectorizado), que sí publica wheel para 3.14 — ya estaba instalado como dependencia transitiva. Lo dejé fijado explícito en `requirements.txt` y corregí la nota en el README y en el ADR.

**Recomendaciones rechazadas:** ninguna en esta sesión; se mantuvo el stack de [ADR-001-Stack-Tecnologico.md](docs/ADR-001-Stack-Tecnologico.md).

## Iteración 1

**Nuevos cambios implementados:**

- Incorporación de barra de búsqueda rápida por código en el Dashboard (Frontend).
- Optimización de ingesta de Excel por chunks para evitar sobrecarga de memoria (Backend).
- Creación de suite de pruebas de integración obligatorias para el flujo de validación.
- Creación de configuración Docker (`docker-compose.yml`) y `.env.example` para despliegue local aislado.
- Implementación de React Query y virtualización de listas en la UI.

**Recomendaciones rechazadas:** Ninguna en esta sesión. Se mantuvieron las tecnologías dictadas en [ADR-001-Stack-Tecnologico.md](docs/ADR-001-Stack-Tecnologico.md).
