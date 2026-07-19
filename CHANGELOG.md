# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [Unreleased]

Segunda pasada de madurez sobre la UI: mobile-first real (grilla responsiva), semántica de
tabla con roles ARIA explícitos, soporte de `forced-colors` (Alto Contraste), feedback táctil,
code-splitting de "Alertas pendientes", anuncio por lector de pantalla en cada auto-refresh
exitoso, y una cuenta regresiva sutil al próximo refresco (que se pausa si hay una fila
expandida). Sin cambios de modelos, lógica de negocio ni contratos de API/estado -- se pidió
también reintroducir un selector de densidad (Cómodo/Compacto) junto al `ThemeToggle`, pero
se omitió a propósito: el usuario ya había pedido sacar ese control explícitamente hacía poco.

### Added
- **[Frontend] Grilla responsiva, mobile-first** (`Dashboard.tsx::FILA_GRID`): `grid-cols-1`
  en pantallas chicas (Muestra/Estado/Detalle apilados, uno por línea) y
  `md:grid-cols-[140px_180px_1fr]` desde tablet en horizontal/monitor -- antes la grilla de 3
  columnas de ancho fijo era la única variante, apretada en un celular.
- **[Frontend] Roles ARIA explícitos en la tabla** (`Dashboard.tsx`): el layout de resultados
  (hecho con `<div>` + CSS Grid, no un `<table>` nativo) ahora expone `role="table"` en el
  contenedor, `role="rowgroup"` para el encabezado y para el cuerpo, `role="row"` en cada fila
  (encabezado y datos) y `role="columnheader"`/`role="cell"` en cada celda -- un lector de
  pantalla lo navega como una tabla real en vez de una lista de `<div>` sin semántica.
- **[Frontend] Soporte de `forced-colors` (Alto Contraste de Windows)**: los badges de estado
  suman `forced-colors:border` (ese modo aplana fondos/colores de marca a los del sistema, y
  sin un borde explícito el badge perdía su delimitador); el panel de detalle expandido suma
  `forced-colors:border-transparent` (su `shadow-sm` desaparece en Alto Contraste, y dejar el
  borde de marca transparente evita pelear con el borde que el sistema fuerza).
- **[Frontend] Feedback táctil** (`active:scale-95 transition-transform` en botones y
  campanitas de alerta): en una tablet de laboratorio, un toque ahora se siente reconocido con
  una reacción visual inmediata, no solo con el `hover` (que un dedo nunca dispara).
- **[Frontend] Sombra en el encabezado de la tabla al hacer scroll** (`Dashboard.tsx`): la
  fila "Muestra/Estado/Detalle" suma `shadow-md` + borde más marcado apenas el cuerpo de la
  tabla se desplaza (`onScroll` sobre el contenedor con `overflow-y-auto`), como delimitador
  visual claro de que hay contenido "debajo" del header sticky.
- **[Frontend] Botón "Contraer" pegajoso dentro del detalle** (`Dashboard.tsx::DetalleMuestra`):
  la tabla de pruebas de una muestra pasa a un contenedor `max-h-72 overflow-y-auto` propio
  (para checklists largos), con un botón "Contraer" en `sticky bottom-2` dentro de esa misma
  zona de scroll -- no hace falta volver a subir para cerrar el panel.
- **[Frontend] CTA "Limpiar búsqueda" en el estado vacío**: si una búsqueda no encuentra
  nada, aparece un botón que limpia el input y devuelve el foco a la región de resultados
  (`tabIndex={-1}` + `.focus()` programático) -- solo se muestra cuando el vacío es producto
  de una búsqueda (`query` no vacío), no en el estado vacío "de verdad".
- **[Frontend] Sprite de íconos como HTML estático** (`index.html`): el `<svg>` con los 3
  `<symbol>` de estado pasa de un componente React (`EstadoIconSprite`, renderizado en cada
  montaje de `Dashboard`) a markup fijo al final de `<body>` -- el mismo contenido siempre,
  sin props ni lógica, así que no hace falta pagar el costo de crearlo por JS.
- **[Frontend] `<link rel="preload">` para las 3 fuentes locales** (`index.html`): sin este
  hint, el navegador recién las descubre al parsear `main.css`; con `crossorigin` (fuentes
  siempre cuentan como carga "anónima" aunque sean same-origin, si no se declara el navegador
  las descarga dos veces).
- **[Frontend] `AlertasPanel` con `React.lazy`/`Suspense`** (`DashboardPage.tsx`): separa su
  chunk (`AlertasPanel-*.js`, ~4 KB/1.6 KB gzip, verificado con un build real) del chunk de
  `DashboardPage` -- el panel sigue montado siempre (`hidden`, no desmontado, para conservar
  su estado), así que el chunk se pide enseguida igual, pero queda cacheable aparte y no
  infla el bundle que el navegador parsea al arrancar.
- **[Frontend] Anuncio por lector de pantalla en cada auto-refresh** (`DashboardPage.tsx`):
  una región `aria-live="polite"` (`sr-only`, invisible) dice "Datos actualizados a las
  {hora}" cada vez que `dataUpdatedAt` cambia -- salvo en la carga inicial, que no es una
  "actualización". Cubre auto-refresh, "Actualizar" manual y una búsqueda nueva por igual.
- **[Frontend] Cuenta regresiva al próximo auto-refresh, pausada con una fila expandida**
  (`Dashboard.tsx` + `DashboardPage.tsx`): texto chico y apagado bajo "última sincronización"
  ("próximo refresco en Ns"), recalculado cada segundo a partir de `ultimaSyncTimestamp` --
  no es un timer de refetch propio, solo lectura para mostrar. `Dashboard` avisa por callback
  (`onFilaExpandidaChange`) cuándo hay una fila abierta; `DashboardPage` usa ese booleano para
  poner `refetchInterval: false` mientras tanto, así un refresh en segundo plano no reordena
  la fila que el técnico está leyendo.

### Fixed
- **`<link rel="modulepreload" href="/src/main.tsx">` rompía el build de producción**
  (arrastrado de una iteración anterior, encontrado al verificar este cambio con un build
  real): Vite no sabe resolver ese archivo como el entrypoint vía un `<link>` genérico (ya lo
  maneja aparte por el propio `<script type="module">`), y terminaba incrustando el código
  fuente TypeScript crudo como un data URI base64 dentro del HTML final --
  `dist/index.html` bajaba de 2.95 KB a 4.39 KB por esto. Se sacó: Vite ya genera solo los
  `modulepreload` que hacen falta de verdad (`vendor-react`, `vendor-query`) automáticamente.

### Rechazado / Descartado
- **Selector de densidad (Cómodo/Compacto) junto al `ThemeToggle`**: pedido en este prompt,
  descartado -- el usuario había pedido sacar ese control (botón "Vista compacta") en una
  iteración anterior ("ya no suma"); reintroducirlo bajo otro nombre habría revertido ese
  pedido explícito sin que lo pidiera de nuevo. Confirmado con el usuario antes de omitirlo.
- **Roles ARIA de tabla también en `DetalleMuestra`**: no hacía falta -- esa tabla de
  pruebas ya es un `<table>` HTML nativo (con `<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` reales),
  tiene la semántica correcta sin necesidad de ARIA explícito.

## [1.12.0] - 2026-07-19

Refactor de la capa de presentación: transiciones suaves para la fila expandible, persistencia
del DOM (scroll, filas abiertas) al alternar entre el dashboard y "Alertas pendientes",
paleta semántica alineada a los tonos por defecto de Tailwind, y varios refuerzos de
accesibilidad (`aria-controls`, `motion-safe:`, auditoría de `axe-core` en dev). Sin cambios
de modelos, lógica de negocio ni contratos de API -- estrictamente capa visual.

### Added
- **[Frontend] Transición de apertura/cierre con CSS Grid** (`Dashboard.tsx::DetalleMuestra`):
  el panel de detalle de cada muestra pasa a montarse siempre (antes se montaba/desmontaba
  condicionalmente) envuelto en un `grid` cuyo `grid-template-rows` anima entre `0fr`
  (colapsado) y `1fr` (abierto) -- una transición de "alto automático" real, sin medir alturas
  en JS. `motion-reduce:transition-none` respeta `prefers-reduced-motion`. Colapsado, el panel
  lleva `aria-hidden="true"` (nunca `display:none`, para no romper la transición) y queda
  fuera del árbol de accesibilidad y de las búsquedas por rol de las pruebas.
- **[Frontend] `aria-controls` en el botón que expande cada fila** (`Dashboard.tsx::Fila`):
  el ID de muestra ahora referencia el panel que despliega (`aria-controls="detalle-{id}"`),
  además del `aria-expanded` que ya tenía -- patrón estándar de disclosure widget.
- **[Frontend] Botón "Contraer todo"**: colapsa la fila expandida (si hay una) desde el
  header; deshabilitado cuando no hay ninguna abierta.
- **[Frontend] Sprite de íconos de estado** (`Dashboard.tsx::EstadoIconSprite`): los 3 íconos
  de estado (Completo/Faltante/Adicionales) pasan de un `<path>` completo repetido por fila a
  un único bloque de `<symbol>` (oculto, sin layout) referenciado por cada fila con
  `<use href="#icono-...">` -- con varias decenas de filas en pantalla, el DOM de la tabla
  queda con un `<use>` liviano por ícono en vez de repetir el mismo path SVG completo.
- **[Frontend] Header y controles de búsqueda sticky** (`Dashboard.tsx`): el header (título +
  buscador + acciones) y el encabezado de la tabla de resultados llevan `sticky top-0 z-10`
  con fondo opaco -- se mantienen visibles al hacer scroll dentro de la lista de muestras.
- **[Frontend] Detalle expandido con estilo de tarjeta**: `border-l-4 border-primary
  bg-surface shadow-sm` en vez del borde superior plano anterior -- se distingue mejor de la
  fila que lo abre y del resto de la tabla.
- **[Frontend] `motion-safe:` en las animaciones de carga**: el skeleton de carga inicial
  (`animate-pulse`) y el ícono de "Actualizar" girando ahora respetan
  `prefers-reduced-motion` en vez de animar incondicionalmente.
- **[Frontend] Auditoría de accesibilidad en desarrollo** (`main.tsx`): `@axe-core/react`
  (nueva devDependency) audita el árbol montado y tira warnings de contraste/ARIA por
  consola -- solo cuando `import.meta.env.DEV` es verdadero; Vite elimina esa rama entera
  (y el chunk de `axe-core`) del build de producción, así que no pesa en el bundle real.
- **[Frontend] `<link rel="modulepreload">` para el entrypoint** (`index.html`): hint
  explícito para el módulo principal -- Vite ya arma el grafo de precarga real para el build
  de producción; esto solo adelanta el descubrimiento del entrypoint en el HTML servido.

### Changed
- **[Frontend] Paleta "menos estridente"** (`main.css`): el acento y los 3 semánticos pasan
  de los tonos a medida del "manifiesto de laboratorio" a la familia de colores por defecto
  de Tailwind -- `--color-primary` de `#0e6e63` a `#2563eb` (blue-600), `--color-success` a
  `#059669` (emerald-600), `--color-warning` a `#d97706` (amber-600), `--color-danger` a
  `#e11d48` (rose-600, no rose-500: rose-500 sobre blanco no llega al contraste 4.5:1 exigido
  para texto normal, y este token se usa como texto en badges/banners, no solo como
  decoración). Los neutros de modo claro (`paper`/`surface`/`line`/`ink`) pasan a la escala
  `slate` de Tailwind. **El modo oscuro no toca sus neutros** (siguen en negro/gris puro,
  pedido explícito de la iteración anterior): solo se suavizan sus acentos (`blue-400`,
  `emerald-400`, `amber-400`, `rose-400`).
- **[Frontend] `DashboardPage.tsx` mantiene las dos vistas montadas**: en vez de renderizar
  condicionalmente `Dashboard` o `AlertasPanel` (desmontando el que no se ve), ambos quedan
  siempre montados dentro de un `<div hidden={...}>` cada uno. Antes, pasar a "Alertas
  pendientes" y volver perdía el scroll de la tabla y la fila expandida (React desmontaba y
  remontaba `Dashboard` desde cero); con `hidden`, ese estado sobrevive. `getByRole` de
  Testing Library ya excluye por defecto los elementos con el atributo `hidden`, así que las
  pruebas existentes no necesitaron acotar sus búsquedas por rol -- sí hizo falta acotar un
  par de búsquedas por texto (`getByText`) que ahora encuentran contenido en ambos paneles.
- **[Frontend] `ThemeToggle`**: `aria-label` pasa de un texto dinámico ("Cambiar a modo
  claro"/"Cambiar a modo oscuro") a uno fijo ("Alternar modo oscuro") -- patrón más estándar
  para un botón de alternar con `aria-pressed` (el estado ya lo comunica `aria-pressed`, la
  etiqueta describe la acción, no el resultado).

### Verificado
- **`vite.config.ts` sin referencias a `react-window`**: ya estaba limpio desde que se
  retiró la virtualización (iteración "detalle granular por prueba") -- se revisó de nuevo
  contra este pedido y no hizo falta ningún cambio.
- `.density-compact`/`.density-comfortable` (`main.css`): ya existían como punto de extensión
  documentado desde el rediseño visual; no se tocaron.

### Rechazado / Descartado
- **Persistir sin `hidden`, ej. clases CSS de opacidad**: `hidden` es el atributo nativo
  correcto acá -- oculta de pantalla y del árbol de accesibilidad a la vez (Testing Library y
  los lectores de pantalla ya lo entienden sin ARIA adicional), sin reinventar ese
  comportamiento con clases propias.
- **Montar/desmontar el panel de detalle solo al primer click (en vez de todas las filas
  siempre)**: para el volumen de esta app (decenas de filas) el costo de tener todas las
  tablas de detalle colapsadas en el DOM es aceptable y es lo que permite animar tanto la
  apertura como el cierre sin lógica adicional. Documentado como punto a revisar si el
  dataset crece a miles de filas.

### Fixed
- **Buzón de notificaciones se veía detrás del encabezado de la tabla**: el header principal
  (`Dashboard.tsx`) y el encabezado de la tabla de resultados eran ambos `sticky` con
  `z-10` -- al empatar, el que viene después en el DOM (el encabezado de la tabla) gana el
  apilamiento y tapaba el desplegable del buzón, que cuelga del header principal. El header
  principal pasa a `z-20`: al ser un contenedor con posición propia, sube como una sola
  unidad de apilamiento (con el desplegable adentro) por encima del encabezado de la tabla.
- **"Última sincronización" no se actualizaba con el auto-refresh** (`Dashboard.tsx` /
  `DashboardPage.tsx`): el timestamp vivía en un `useState` que un `useEffect` pisaba cuando
  cambiaba `data` -- pero React Query hace *structural sharing* por defecto: si un refetch en
  segundo plano trae contenido idéntico al anterior, `data` conserva la misma referencia, el
  efecto nunca se dispara, y el reloj quedaba congelado aunque el polling sí le pegara al
  backend cada 60s. Fix: `Dashboard` recibe `ultimaSyncTimestamp` como prop (viene de
  `dataUpdatedAt` de `useQuery`, que cambia en cada fetch exitoso sin importar el contenido)
  en vez de derivarlo de la referencia de `data`; se borró el estado/efecto local, que ya no
  hacía falta. Test de regresión: re-renderiza con dos `ultimaSyncTimestamp` distintos y el
  mismo `data`, y verifica que la etiqueta cambia igual.

### Added
- **[Frontend] Auto-refresh cada 60s** (`DashboardPage.tsx`): antes no había ningún refetch
  automático -- el dashboard solo se actualizaba con una búsqueda nueva o el botón
  "Actualizar" manual. `useQuery` ahora suma `refetchInterval: 60_000`; React Query pausa el
  polling con la pestaña sin foco (`refetchIntervalInBackground` en su default `false`), así
  que no genera tráfico de fondo con la app minimizada. 60s es un intervalo prudente
  considerando que cada request relee y revalida el Excel entero (streaming por lotes, pero
  igual O(filas)) más el fuzzy matching de IDs -- con datasets de hasta ~5000 muestras y un
  solo worker de Gunicorn (`WEB_CONCURRENCY=1`, ver ADR-001), un intervalo más corto podría
  encadenar requests sobre el archivo más grande del rango soportado.

## [1.11.0] - 2026-07-19

Modo oscuro corregido (negro neutro, no verdoso), sistema de códigos de error para que un
técnico químico entienda el mensaje sin jerga de programador ("input", "string"), y Docker
verificado end-to-end ahora que la virtualización ya está habilitada en la máquina.

### Added
- **[Backend] Sistema de códigos de error** (`backend/app/core/error_codes.py`): cada error
  que puede llegarle al usuario tiene un `CodigoError` (mensaje en español sin jerga +
  código tipo `VAL-002`/`ARCH-004`) y una excepción `ErrorAplicacion(ValueError)` que arma el
  string final (`"{mensaje} (código {codigo})"`). `ingestion.py::validate_rows` ya no
  expone el texto crudo de pydantic ("Input should be a valid string") en
  `errores_validacion`: usa `CAMPO_LEGIBLE` para nombrar la columna en español y elige
  `VAL-001` (falta el dato) o `VAL-002` (dato con formato inválido) según el tipo de error.
  `assert_safe_excel_file` usa `ARCH-001..005` para los errores de archivo completo, y
  loguea el detalle técnico real (tamaños, ratios de compresión) server-side vía
  `logger.warning` en vez de devolverlo al cliente.
- **[Docs] `docs/CODIGOS_ERROR.md`**: tabla de referencia para el programador -- cada
  código, el mensaje que ve el técnico, y la causa técnica real (tipo de excepción, dónde se
  genera). El dashboard nunca muestra esta tabla; es lo que hay que buscar si un técnico
  reporta un código.
- **[Frontend] `ApiError.esAmigable`**: `fetchJson`/`exportDashboard`/`exportAlertasPendientes`
  ahora leen el `detail` del cuerpo de la respuesta de error (antes se descartaba: un 422
  siempre mostraba el mismo texto genérico "Los datos recibidos son inválidos", sin importar
  qué pasó realmente). Cuando el backend manda un `detail` (ya es el mensaje amigable +
  código), `friendlyMessage` lo muestra tal cual; si el cuerpo no es JSON legible (ej. un 413
  sin body), cae al mensaje genérico de siempre.

### Changed
- **[Frontend] Modo oscuro, neutros a negro puro**: `--color-paper`/`--color-surface`/
  `--color-line`(-strong)/`--color-ink`(-soft) pasan de una familia con tinte verde
  (`#10221d`/`#172a24`/...) a grises neutros sobre negro casi puro (`#0a0a0a`/`#131313`/...)
  -- el ajuste de saturación de esta ronda era solo para el modo claro; el oscuro debía
  quedar como en el diseño original. Los acentos (primary/success/warning/danger) no
  cambiaron.
- **[Docs] README/`.env.example`**: se quita la nota "Pendiente" sobre habilitar
  virtualización para Docker (ya está activo en la máquina) y se corrige el comentario
  desactualizado de `.env.example` ("4 Excel de origen" → `Datos.xlsx` +
  `Checklist_Maestro.xlsx`, vigente desde la ingesta multipestaña).

### Verificado
- **`docker compose up --build`**: primera vez que corre en esta máquina (antes bloqueado
  por falta de virtualización). Build de ambas imágenes limpio, contenedores healthy,
  `GET /api/muestras` responde `200` directo al backend (`:8000`) y a través del proxy
  `/api` de nginx en el frontend (`:5173`) -- confirma que el hardening de contenedores
  documentado en el ADR-001 (Gunicorn+Uvicorn, usuario sin privilegios, nginx-unprivileged)
  funciona de punta a punta, no solo en la definición de los `Dockerfile`.

## [1.10.0] - 2026-07-19

Comodidad para el cliente: los 2 Excel exportables (dashboard y alertas pendientes) pasan a
tener encabezado distinguible y columnas anchas automáticamente; modo oscuro con botón
explícito arriba de la página; y se retocó la paleta de color claro (el `warning` se veía
casi blanco contra `--color-surface`).

### Added
- **[Backend] `services/xlsx_style.py::formatear_hoja`**: helper compartido que pone el
  encabezado en negrita blanca sobre fondo verde-azulado (el mismo `--color-primary` del
  frontend), le agrega bordes a toda la grilla, congela la fila de encabezado
  (`freeze_panes`) y ensancha cada columna según su contenido más largo (min 10, max 60
  caracteres) -- así el técnico no tiene que agrandar columnas a mano cada vez que abre el
  archivo. Aplicado a las 3 hojas que existen hoy: `Resumen`, `Detalle_pruebas` y
  `Alertas_pendientes`.
- **[Backend] `POST /api/notificaciones/exportar`**: nuevo endpoint que recibe la lista de
  alertas pendientes (viven en `localStorage`, el backend no las conoce hasta que se las
  mandan) y devuelve un `.xlsx` real de una hoja (`ID`, `Prueba_pendiente`, `Alerta_creada`
  ya formateada `dd/mm/aaaa hh:mm`), con el mismo `formatear_hoja`. Reemplaza al `.csv`
  generado a mano de la iteración anterior -- ver "Rechazado" para por qué no se generó
  `.xlsx` directo en el navegador.
- **[Frontend] `useTheme`/`ThemeToggle`** (`frontend/src/hooks/useTheme.ts`,
  `frontend/src/components/ThemeToggle.tsx`): botón sol/luna en una barra angosta arriba del
  "sheet" principal (`App.tsx`), visible en las dos vistas (dashboard y alertas). Sin
  preferencia guardada, sigue `prefers-color-scheme` del sistema operativo; un click fija
  `data-theme` en `<html>` (persistido en `localStorage`) que manda por sobre la preferencia
  del sistema en ambos sentidos.
- **[Frontend] Paleta de modo oscuro completa** (`main.css`): `--color-primary`,
  `--color-paper`/`--color-surface` (fondo de página/tarjeta), `--color-line`(-strong),
  `--color-ink`(-soft) y los 3 semánticos (success/warning/danger, con sus `-bg` en `rgba`
  semitransparente en vez de un sólido, para que funcionen sobre cualquier tono de fondo
  oscuro) redefinidos bajo `@media (prefers-color-scheme: dark)` y
  `:root[data-theme="dark"]`. Ningún componente cambió: todos ya consumían estos tokens vía
  clases de Tailwind (`bg-paper`, `text-ink-soft`, etc.), así que redefinir las variables
  alcanzó.

### Changed
- **[Frontend] Paleta de modo claro, contraste del `warning`**: `--color-warning` pasa de
  `#8a5a0f` a `#9c5c02` (más saturado) y `--color-warning-bg` de `#f6ecd6` a `#fbe7bd` (más
  cálido/saturado) -- la combinación anterior quedaba casi indistinguible contra
  `--color-surface`. `--color-surface` pasa de `#ffffff` a `#fafcfb` (un blanco apenas
  atenuado) para que ese fondo no "lave" los colores semánticos más suaves. `body` ahora fija
  explícitamente `background-color`/`color` con los tokens (antes dependía del blanco por
  defecto del navegador), para que el modo oscuro también tiña el margen fuera del "sheet".

### Rechazado / Descartado
- **Librería de generación de `.xlsx` en el navegador (sheetjs/exceljs) para el export de
  Alertas pendientes**: descartado en esta iteración también -- ahora que ese reporte
  necesita el mismo encabezado/columnas formateadas que el resto (pedido explícito de esta
  ronda), se resolvió mandando los datos al backend (`POST /api/notificaciones/exportar`),
  que ya tiene `openpyxl`/`pandas` y el helper `formatear_hoja` compartido, en vez de sumar
  una dependencia de formato de planillas al bundle del cliente.
- **Selector de 3 posiciones (claro/oscuro/sistema) en vez de un toggle binario**: el pedido
  fue "un botón pequeño"; un botón de 2 estados (claro ↔ oscuro) ya cubre el caso de uso, y
  la preferencia del sistema sigue siendo el default implícito mientras el usuario no lo
  toque (no hace falta una tercera opción explícita para volver a "seguir al sistema").

## [1.9.0] - 2026-07-19

Ajustes de UX sobre la vista de detalle granular, pedidos tras revisar la iteración anterior: expansión in-line (no al pie de la lista), columna **Valor**, renombre "Pruebas Fantasma" → "Pruebas Adicionales" con su color, y alertas de finalización por prueba puntual (no por muestra completa) con protección anti-duplicados.

### Added
- **[Backend] Columna `Valor` en `Datos.xlsx`**: `PruebaRow`/`PruebaDetalle` agregan `valor: str` (columna `Valor` en cada pestaña, alias `valor` en `column_aliases.py`); `validation_rules.py::build_status` lo propaga en `pruebas`. `data_mock/generar_datos_mock.py` y `_grande.py` regenerados con un valor literal + unidad por tipo de prueba (`pH` → `"7.2"`, `Metales_Pesados` → `"0.02 mg/L"`, etc.).
- **[Frontend] Columna "Valor"** en la tabla de detalle (`Dashboard.tsx`), entre Resultado y Técnico.
- **[Frontend] Alertas por prueba puntual** (`frontend/src/hooks/useAlertas.ts`, reemplaza a `useWatchlist.ts`): cada campanita en la columna "Alerta" (solo visible en pruebas faltantes) registra una alerta con clave `id_muestra::prueba` en `localStorage`. Un segundo click sobre la misma campanita no crea una alerta duplicada -- `crearAlerta` devuelve `false` si ya existía, y `DashboardPage` muestra un toast "La alerta ya fue generada" (variante `info` nueva en `Toast.tsx`) en vez de silenciarlo. Si una muestra tiene 2+ pruebas faltantes, cada una tiene su propia campanita y genera su propia alerta independiente.
- **[Frontend] Detección de finalización simplificada** (`DashboardPage.tsx`): ya no hace falta guardar una foto de `pruebas_faltantes` anterior (como en la iteración pasada, basada en Watchlist por muestra completa) -- alcanza con revisar, en cada respuesta nueva, si la prueba de cada alerta activa sigue en `pruebas_faltantes`; si no, se completó, se dispara la notificación local + `POST /api/notificaciones`, y la alerta se resuelve (deja de chequearse).
- **[Frontend] Botón "Actualizar"** (`Dashboard.tsx`, `AlertasPanel.tsx`): refetch manual bajo demanda vía `refetch()` de TanStack Query -- no hay polling automático en segundo plano (evaluado y descartado, ver "Rechazado" más abajo); el técnico dispara la actualización cuando la necesita, con el mismo ícono girando (`isFetching`) que ya usaba el spinner del buscador.
- **[Frontend] Panel "Alertas pendientes"** (`frontend/src/components/AlertasPanel.tsx`): vista alternativa (sin router, solo un `useState<"dashboard" | "alertas">` en `DashboardPage.tsx` -- la app sigue teniendo una sola ruta real) que lista toda alerta activa (`id_muestra`, prueba, fecha de creación) ordenada de más antigua a más nueva. Una alerta desaparece de esta lista en cuanto se resuelve (la prueba se completó y ya se notificó), así el técnico ve de un vistazo qué sigue pendiente sin tener que revisar muestra por muestra. Accesible desde un botón en el header del dashboard con badge de cantidad pendiente; el panel tiene sus propios botones "Volver al panel principal" y "Actualizar".
- **[Frontend] `useAlertas` pasa a guardar objetos, no solo claves**: cada alerta activa ahora persiste `{id_muestra, prueba, creada}` (antes solo la clave `id_muestra::prueba`) para poder mostrar la fecha de creación en el panel nuevo. `listaAlertas` (array ordenado) reemplaza al `alertas` (Set) que exponía el hook antes.
- **[Backend] Export a Excel legible para técnicos** (`api/muestras.py::_build_reporte_excel`): `GET /api/muestras/exportar` pasa de un único sheet con columnas `id_muestra`/`pruebas_fantasma`/`pruebas` (esta última con literales de Python tipo `[{'nombre_prueba': ...}]`, ilegible para alguien que no programa) a dos hojas -- **Resumen** (`ID`, `Estado`, `Tipo_analisis`, `Pruebas_faltantes`, `Pruebas_adicionales`, con las listas unidas en texto plano y `"Ninguna"` cuando no hay) y **Detalle_pruebas** (`ID`, `Prueba`, `Resultado`, `Valor`, `Tecnico`, `Fecha`: una fila por prueba, ordenada por `ID` y `Prueba`, en vez de un blob desordenado). `Estado` usa el mismo rename que la UI (`"Pruebas Fantasma"` → `"Pruebas Adicionales"`).
- **[Frontend] Export CSV del panel "Alertas pendientes"** (`AlertasPanel.tsx::exportarAlertasCsv`): reporte descargable (`ID`, `Prueba_pendiente`, `Alerta_creada`) de lo que todavía no se resolvió -- vive enteramente en el cliente (las alertas son de `localStorage`, el backend no las conoce), así que se genera un `.csv` a mano (con BOM UTF-8 para que Excel no rompa acentos/ñ) en vez de sumar una librería de `.xlsx` en el navegador solo para este reporte chico. Deshabilitado cuando no hay alertas pendientes.

### Changed
- **[Frontend] "Pruebas Fantasma" se muestra como "Pruebas Adicionales"**: cambio solo de etiqueta (`ESTADO_LABEL` en `Dashboard.tsx`) -- el valor interno del contrato (`EstadoMuestra`, la respuesta de la API) sigue siendo `"Pruebas Fantasma"`, para no romper el contrato backend/frontend ni la data histórica del CSV de auditoría por un cambio puramente de copy. El Excel exportado sí traduce la etiqueta (ver "Added" arriba), porque ahí el lector es el técnico, no otro sistema.
- **[Frontend] Colores de estado**: `Faltante` pasa de naranja (`warning`) a rojo (`danger`); `Pruebas Fantasma`/"Adicionales" pasa de rojo a naranja. Mismos tokens semánticos ya definidos en `main.css`, sin paleta nueva.
- **[Frontend] Expansión de detalle in-line, no react-window**: el ID de muestra ahora expande el detalle justo debajo de su propia fila (empujando el resto de la lista hacia abajo con el flujo normal del documento), en vez de un panel único al pie de toda la tabla. Esto requirió reemplazar la virtualización de `react-window` (que asume alturas de fila fijas, incompatible con una fila de altura variable que se expande) por una lista mapeada dentro de un contenedor `overflow-y-auto` -- para el volumen de muestras de esta app (decenas, no miles) la virtualización no se justificaba frente a la complejidad de sostenerla con alturas dinámicas. Dependencia `react-window` desinstalada (`package.json`, `vite.config.ts::manualChunks`, comentarios en `App.tsx`/`tests/setup.ts`).
- **[Frontend] Se retira el ícono de estrella/Watchlist por muestra completa**: reemplazado por las alertas por prueba puntual (más preciso: el pedido original de "avisar cuando se complete" es sobre una prueba faltante concreta, no sobre la muestra en su conjunto).

### Eliminado (Removed)
- **[Frontend] Botón "Vista compacta"**: quitado a pedido explícito ("ya no suma") junto con todo el estado/prop `compacta` en `Dashboard.tsx` -- la fila vuelve a tener un único alto fijo, sin puntos de extensión sin usar.

### Rechazado / Descartado
- **Polling automático (`refetchInterval`) para refrescar el dashboard solo**: evaluado y descartado por ahora a pedido explícito -- se prefirió un botón "Actualizar" manual (control directo del técnico sobre cuándo se re-lee el Excel, sin requests de fondo silenciosos) en vez de un intervalo fijo. Punto de extensión documentado acá por si una iteración futura pide refresco automático de verdad.
- **Router (React Router) para el panel de Alertas pendientes**: la app sigue teniendo una sola ruta real; el toggle `dashboard`/`alertas` es un `useState` en `DashboardPage.tsx`, no una URL nueva -- mismo criterio que ya se aplicó para el `React.lazy` de `App.tsx` (ver ADR-001).
- **Librería de generación de `.xlsx` en el navegador (sheetjs/exceljs) para el export de Alertas pendientes**: descartado. Un `.csv` con BOM UTF-8 cubre la necesidad ("un archivo que un técnico pueda abrir en Excel") sin sumar una dependencia nueva ni el peso de esa librería al bundle del cliente.

## [1.8.0] - 2026-07-18

Detalle granular por prueba, Watchlist y buzón de notificaciones local. Cambio de requerimientos aprobado: la ingesta pasa de 3 Excel por área a 1 Excel multipestaña (`Datos.xlsx`, una pestaña por prueba) + `Checklist_Maestro.xlsx` (ahora también dicta el `tipo_analisis` por muestra); el frontend agrega una vista expandible por muestra, una Lista de Vigilancia persistida en `localStorage` y un buzón de notificaciones que avisa cuando una prueba faltante de un item vigilado se completa. (Nota: la Watchlist por muestra completa y la expansión al pie de la lista descriptas acá fueron reemplazadas en la iteración "Unreleased" de arriba por alertas por prueba puntual y expansión in-line -- se deja esta entrada tal cual para el historial.)

### Added
- **[Backend] `MuestraEstado.tipo_analisis` y `MuestraEstado.pruebas: list[PruebaDetalle]`** (`backend/app/models/schemas.py`): cada muestra ahora expone el tipo de análisis solicitado y el detalle (`nombre_prueba`, `resultado`, `tecnico`, `fecha`) de cada prueba realmente realizada, no solo los nombres de las faltantes/fantasma.
- **[Backend] Ingesta multipestaña** (`backend/app/services/ingestion.py::read_excel_multisheet_normalized`): reutiliza el mismo streaming por lotes de `read_excel_normalized` (openpyxl `read_only`) pero por cada pestaña de un workbook, devolviendo `{nombre_hoja: DataFrame}`. `api/muestras.py::_build_estados` itera esas pestañas, inyecta `prueba=nombre_hoja` (el nombre de la prueba nunca fue una columna del archivo, lo asigna la pestaña) y concatena todo antes del fuzzy matching de IDs -- mismo pipeline que antes, una sola fuente además del checklist.
- **[Backend] `POST /api/notificaciones`** (`backend/app/api/muestras.py`): recibe `{id_muestra, prueba}` y hace *append* async (vía `run_in_threadpool`, sin bloquear el event loop) a `data_mock/historial_notificaciones.csv` con `backend/app/services/ingestion.py::append_notificacion_csv` (stdlib `csv`, sin dependencia nueva). Es el único endpoint no-`GET` de la API; `CORSMiddleware.allow_methods` pasa a `["GET", "POST"]`.
- **[Frontend] Vista expandible por muestra** (`Dashboard.tsx`): el ID de cada muestra es un botón que despliega/colapsa una tabla comparando lo exigido por el Checklist (`tipo_analisis` + toda prueba con resultado, o "Faltante" resaltado en rojo si no hay dato) contra lo realmente encontrado en `Datos.xlsx`, imprimiendo resultado/técnico/fecha literal. Las pruebas fantasma se listan aparte, marcadas "no solicitada". El estado de expansión vive en `Dashboard` (no en `react-window`, que no soporta alturas de fila dinámicas sin reescribir la virtualización) -- el panel de detalle se renderiza una sola vez, debajo de la lista virtualizada, no como fila expandida in-line.
- **[Frontend] Lista de Vigilancia** (`frontend/src/hooks/useWatchlist.ts`): un ícono de estrella por fila añade/quita la muestra de una lista persistida en `localStorage` (`isWatched`/`toggleWatch`), sin backend ni estado de servidor -- consistente con el ADR-001 (ver sección "Conflictos ADR" más abajo).
- **[Frontend] Buzón de notificaciones** (`frontend/src/components/NotificationBell.tsx`, `frontend/src/hooks/useNotificaciones.ts`): ícono de sobre con badge de no-leídas; `DashboardPage.tsx` compara, en cada respuesta nueva de `/api/muestras`, la foto anterior de `pruebas_faltantes` de cada muestra vigilada contra la actual -- toda prueba que salió de esa lista se reporta como notificación local (persistida en `localStorage`, sobrevive a un refresh) y se manda a `POST /api/notificaciones` (best-effort: si falla la red, la notificación local ya se mostró y no se reintenta).

### Changed
- **[Backend] `backend/app/core/config.py`**: `area1_path`/`area2_path`/`area3_path`/`area_paths` se reemplazan por `datos_path` (`Datos.xlsx`), `checklist_path` (sin cambios de nombre) y `source_paths` (usado por `check_file_freshness` para las alertas de desfase). `notificaciones_csv_path` es nuevo.
- **[Backend] `backend/app/services/validation_rules.py::build_status`**: agrupa el checklist por `id_muestra` tomando también `tipo_analisis` (primer valor del grupo, se asume consistente por muestra) y arma `pruebas: list[dict]` con el detalle de cada fila de `Datos.xlsx` que matchea esa muestra. La lógica de estado (Completo/Faltante/Pruebas Fantasma, cadena de reglas) no cambió.
- **[data_mock] `generar_datos_mock.py` / `generar_datos_mock_grande.py`**: generan `Datos.xlsx` (multipestaña: `pH`, `Metales_Pesados`, `Microbiologia`, `Plaguicidas`, ...) y `Checklist_Maestro.xlsx` con `tipo_analisis`, en vez de los 3 `Area_*.xlsx` (eliminados de `data_mock/`). Los mismos escenarios de demo (completo/faltante/fantasma/typo/desfase) se preservan.

### Eliminado (Removed)
- **Validación a nivel de documento general**: `_build_estados` ya no valida "el archivo de Área 2 en su conjunto"; valida cada pestaña de `Datos.xlsx` por separado contra `PruebaRow` (partial-success por pestaña, igual que antes por archivo) y las agrega. La granularidad de la cross-validación pasa de "por archivo" a "por pestaña/prueba", según pide el PRD.
- `Area_1_Recepcion.xlsx`, `Area_2_Analisis_Quimico.xlsx`, `Area_3_Validacion_Informes.xlsx` de `data_mock/` (reemplazados por `Datos.xlsx`). `Area_1` nunca se leía en `_build_estados` (solo aportaba datos de cliente, fuera de alcance del dashboard) y `Area_3` solo se usaba para la alerta de desfase -- ninguna pérdida de funcionalidad real.

### Conflictos ADR
- Ninguno. `historial_notificaciones.csv` es un archivo plano (no una base de datos ni una cola de mensajes) y la Watchlist vive enteramente en `localStorage` del cliente -- ambos cumplen el espíritu del ADR-001 de no introducir infraestructura de estado nueva. Ver `docs/ADR-001-Stack-Tecnologico.md`.

### Rechazado / Descartado
- **Expansión de fila in-line dentro de `react-window`**: descartado. `react-window` (`List`) asume alturas de fila fijas/uniformes por su modelo de virtualización; soportar una fila expandida de altura variable habría requerido reescribir la medición de alturas o cambiar de librería, para una necesidad que un panel de detalle único debajo de la lista resuelve igual de bien con una fracción del código.
- **Base de datos o cola de mensajes para el historial de notificaciones**: descartado. Un CSV de solo-apéndice cubre la necesidad ("dejar rastro server-side") sin agregar infraestructura fuera del ADR-001.
- **Sincronizar la Watchlist entre pestañas/dispositivos (backend, WebSocket, `BroadcastChannel`)**: fuera de alcance del PRD ("el usuario podrá añadir muestras... a una Lista de Vigilancia" no pide sincronización); `localStorage` ya persiste entre sesiones del mismo navegador, que es lo pedido.
- **Reintento/cola de reintentos para `POST /api/notificaciones` si falla la red**: descartado. El buzón local ya mostró la notificación (la necesidad del usuario está cubierta); reintentar el registro de auditoría agrega una cola de reintentos client-side para un log que es best-effort por diseño.

## [1.7.0] - 2026-07-18

Rediseño visual y de accesibilidad del dashboard (frontend). Sin cambios en `backend/` ni en la lógica de `services/` (contratos de API y llamadas a `fetchDashboard`/`exportDashboard` intactos).

### Added
- **[A11y] Iconografía semántica de estado**: `Dashboard.tsx` agrega un ícono junto a cada etiqueta de estado (`Completo`/`Faltante`/`Pruebas Fantasma`) para no depender solo del color como distintivo — 3 SVG inline (trazos de Heroicons v2, MIT) en vez de sumar `lucide-react` u otra librería de íconos nueva; heredan el color de texto de la propia etiqueta vía `currentColor`, sin una paleta paralela. Cada ícono lleva `aria-hidden="true"` porque el texto de la etiqueta ya comunica el estado a lectores de pantalla.
- **[UX] Feedback de carga en la búsqueda**: `DashboardPage.tsx` expone `isFetching` de React Query (distinto de `isPending`, que ya gobierna el skeleton de carga inicial); `Dashboard.tsx` lo usa para mostrar un spinner dentro del input de búsqueda mientras hay una petición en curso (typeahead con `keepPreviousData`), sin ocultar los resultados anteriores.
- **[UX] Estado vacío**: `Dashboard.tsx` reemplaza la tabla por un mensaje cuando `data.muestras.length === 0` y no está cargando, para que "sin resultados" no se vea como una tabla en blanco. Sin `role="status"` propio (habría colisionado con el `role="status"` del toast de exportación en `findByRole` de los tests) — vive dentro de la región `role="region" aria-label="Resultados de la búsqueda"` ya existente, que ya cubre el contexto para lectores de pantalla.
- **[UI] Clases de densidad**: `.density-compact` / `.density-comfortable` en `main.css`, disponibles como punto de extensión (padding de fila 0.5rem/1rem); no hay todavía un control de UI que las aplique — no se agregó uno por no estar pedido.
- **[ADD] Tailwind CSS framework**: `tailwindcss` + `@tailwindcss/vite` (v4, integración como plugin de Vite, sin `tailwind.config.js` ni PostCSS separado). `frontend/src/main.css` reemplaza a `Dashboard.css` (eliminado) como única hoja de estilos, con un bloque `@theme` que declara la paleta semántica pedida como tokens de Tailwind: `--color-primary: #0056b3`, `--color-success: #28a745`, `--color-danger: #dc3545`, más `--color-warning`/`--color-warning-bg` para las alertas de desfase/validación (una cuarta categoría que la paleta dada no cubría explícitamente). Tipografía: `--font-sans` con `Inter, "Geist Sans"` como preferencia y fallback al stack sans-serif nativo del sistema operativo — **no se cargó ninguna fuente por CDN** (Google Fonts u otro), porque violaría la `Content-Security-Policy: style-src 'self'; connect-src 'self'` ya vigente en `nginx.conf` (ver sección "Rechazado" más abajo).
- **[ADD] Semantic UI layout and Responsive Grid**: `Dashboard.tsx` reestructurado a `<section aria-label="Panel de validación de muestras">` → `<header>` (buscador + exportar) + región de resultados (`role="region" aria-label="Resultados de la búsqueda"`); `App.tsx` aporta el `<header>` de página (título `<h1>`) y el único `<main>` del documento (evita `<main>` anidados). Grid de la tabla vía clases de Tailwind (`grid grid-cols-[140px_180px_1fr]`, antes CSS plano en `Dashboard.css`) con espaciados en múltiplos de 4px (`gap-2`, `px-3 py-2`, `p-4 md:p-6`).
- **[ADD] Accessibility enhancements (ARIA, WCAG contrast)**: estados de foco visibles vía `:focus-visible` (Tailwind `focus-visible:outline-2 focus-visible:outline-primary`) en input de búsqueda, botón de exportar y botón de cierre de los toasts — antes sin estilo de foco explícito. `<label htmlFor="buscar-muestra" className="sr-only">` asociado al input (antes solo `placeholder`, no accesible para lectores de pantalla). Región de resultados con `aria-busy` durante la carga. Toasts con `aria-live="polite"` en el contenedor y `role="alert"`/`role="status"` por variante (error vs. éxito), consistente con el patrón ya usado en los banners inline. Paleta verificada a ojo contra WCAG 2.1 AA para texto sobre fondo (`text-success`/`bg-success-bg`, `text-danger`/`bg-danger-bg` usan pares oscuro-sobre-claro, no el color plano de acento sobre blanco) — no se corrió una herramienta automatizada de contraste (deuda técnica, ver `docs/TESTING_STRATEGY.md`).
- **[ADD] Performance improvements (Lazy loading, Chunk splitting)**: `App.tsx` carga `DashboardPage` con `React.lazy` + `<Suspense fallback={<PageSkeleton />}>` — separa el bundle del dashboard (React Query, react-window, toda la lógica de cliente) del shell inicial. `vite.config.ts` agrega `build.rollupOptions.output.manualChunks` (`vendor-react`, `vendor-query`, `vendor-window`) para que el vendor pesado quede cacheado por el navegador entre releases, y `rollup-plugin-visualizer` (genera `dist/stats.html` en cada `vite build`, sin efecto en `vite dev`) para poder auditar el tamaño de los chunks a futuro. Verificado con un build real: `vendor-react` (134 KB / 43 KB gzip), `vendor-query` (46 KB / 14 KB gzip), `vendor-window` (8 KB / 3 KB gzip) y `DashboardPage` (4.6 KB / 1.9 KB gzip) quedan en chunks separados del `index.js` de arranque (7 KB / 3 KB gzip).
- Skeleton screens: `Dashboard.tsx` recibe una prop `isLoading` y renderiza `TablaSkeleton` (filas `animate-pulse`) en vez de la tabla real durante la carga inicial — reemplaza el `<p>Cargando...</p>` que antes devolvía `DashboardPage.tsx` completo (y que, al desmontar toda la vista, era la causa original del bug de foco corregido en la iteración anterior).
- Sistema de Toast (`frontend/src/components/Toast.tsx`, `ToastProvider`/`useToast`): notificaciones de éxito/error para la exportación a Excel, con auto-dismiss (4s) y cierre manual. Construido a mano con `useState`/`useContext` de React, sin librería nueva (ver "Rechazado").

### Changed
- `DashboardPage.tsx`: el resultado de `exportDashboard()` ahora se comunica vía `useToast()` en vez de un `useState<ApiError | null>` local con un `<p role="alert">` propio; un intento de exportación nuevo descarta el toast del intento anterior (mismo comportamiento de "no dejar un error viejo colgado" que tenía el `setExportError(null)` original, ahora vía `dismissToast`). La lógica de la query (`fetchDashboard`, `keepPreviousData`, `debouncedQuery`) no cambió.
- `ErrorBoundary.tsx`: restilizado con clases de Tailwind (antes dependía de `.alerta-error` en `Dashboard.css`, ahora eliminado).

### Rechazado / Descartado
- **Cargar Inter/Geist desde Google Fonts (u otro CDN)**: descartado. Violaría la CSP `style-src 'self'; connect-src 'self'` ya vigente en `frontend/nginx.conf` desde 1.2.0, que esta iteración no tocó. Se usa el nombre de la fuente como preferencia en el `font-stack` de CSS, con fallback nativo — funciona igual de bien visualmente en la enorme mayoría de sistemas operativos modernos sin una request de red externa.
- **Librería de Toast (react-hot-toast, sonner, etc.)**: descartado. La necesidad (mostrar 1-2 notificaciones simples de éxito/error, auto-dismiss, cierre manual) no justifica una dependencia nueva; ~80 líneas de React con Context + `useState` la cubren por completo.
- **React Router para el `React.lazy`/`Suspense` de rutas**: la app no tiene múltiples rutas (un único dashboard de solo lectura); agregar un router solo para justificar `React.lazy` habría sido la definición de sobreingeniería. Se aplicó `React.lazy` igual, pero sobre el único punto de entrada real (`DashboardPage`), separando su bundle del shell de `App.tsx` — cumple el objetivo de code-splitting sin inventar rutas que no existen.
- **`tailwind.config.js` / PostCSS separado**: descartado. Tailwind v4 vía `@tailwindcss/vite` no lo requiere; la configuración de tema vive en `main.css` con `@theme` (CSS-first), un archivo menos que mantener.
- **Herramienta automatizada de auditoría de contraste WCAG (axe-core, Lighthouse CI) en el pipeline de tests**: fuera de alcance de esta iteración (es tooling de CI, no un cambio de componente); la paleta se verificó manualmente contra los pares texto/fondo definidos. Deuda técnica registrada en `docs/TESTING_STRATEGY.md`.
- **Reescribir `services/api.ts` o `services/queryClient.ts`**: no aplica a este rediseño — la restricción explícita del pedido era no tocar la lógica de negocio ni las consultas de API, y no hizo falta: el rediseño visual es 100% capa de presentación.

## [1.6.0] - 2026-07-18

Auditoría técnica de 5 etapas (calidad, arquitectura, seguridad, resiliencia e infraestructura/memoria) sobre el contenido de esta versión: **aprobada sin hallazgos críticos ni vulnerabilidades**. Certifica el MVP "read-only" (FastAPI + Pandas + TheFuzz + React) descripto en `docs/ADR-001-Stack-Tecnologico.md` como maduro; no se requirió ninguna refactorización de lógica de negocio para cerrar esta ronda.

### Added
- Límite de memoria (`deploy.resources.limits.memory: 512M`) para el servicio `backend` en `docker-compose.yml`, para que un pico de la ingesta (streaming por lotes, ver "Rechazado" más abajo) no se lleve puesta la máquina host.
- Sanitización de input en el motor de búsqueda difusa (`backend/app/services/fuzzy_match.py::_sanitize_query`): el `q` que llega de `/api/muestras/buscar` se limpia de caracteres de control y se trunca a 200 caracteres antes de tocar `thefuzz`/`rapidfuzz`. `thefuzz` nunca interpreta el input como patrón (no hay superficie de inyección tipo regex/SQL), así que esto es defensa en profundidad contra input adversarial/ruido, no una vulnerabilidad que existiera antes.
- Tests de la sanitización nueva en `test_fuzzy_search.py`: caracteres de control, query de 10.000 caracteres, query compuesta solo por caracteres de control.
- `BACKEND_MEM_LIMIT` parametrizada: `docker-compose.yml` usa `deploy.resources.limits.memory: ${BACKEND_MEM_LIMIT:-512M}` en vez del valor fijo `512M`, con `BACKEND_MEM_LIMIT=512M` documentado en `.env.example`.
- Log de auditoría de seguridad al truncar una query: `_sanitize_query` (`fuzzy_match.py`) emite `logger.warning(...)` con la longitud original cuando la query supera los 200 caracteres, antes de truncarla — visibilidad server-side de intentos de input anómalo sin romper la respuesta al cliente. Tests nuevos: `test_search_by_code_logs_a_warning_when_truncating_an_oversized_query`, `test_search_by_code_does_not_log_when_query_is_within_the_limit`.
- `maxLength={200}` en el `<input>` de búsqueda (`frontend/src/components/Dashboard.tsx`), sincronizado con `MAX_QUERY_LENGTH` del backend — el usuario no puede ni empezar a escribir una query que el backend va a truncar igual. Test nuevo en `Dashboard.test.tsx`.
- `WEB_CONCURRENCY` y `--max-requests` parametrizados para los workers de Gunicorn (`backend/Dockerfile`, `docker-compose.yml`, `.env.example`): el `CMD` del Dockerfile pasa a forma shell (`sh -c "exec gunicorn ... -w ${WEB_CONCURRENCY:-1} --max-requests 1000"`, con `exec` para que gunicorn siga siendo PID 1 y reciba las señales de Docker) para poder expandir `${WEB_CONCURRENCY:-1}` en runtime — la forma exec de array no expande variables de entorno. Con 1 worker por defecto, el uso de memoria de un request de Pandas queda acotado a un solo proceso, alineado matemáticamente a los 512M de `BACKEND_MEM_LIMIT`; `--max-requests 1000` recicla el worker periódicamente para cortar fugas de memoria acumuladas en un proceso de larga vida.

### Changed
- Ninguno en esta iteración (la lógica de negocio, `validation_rules.py` y los modelos existentes no se tocaron, según lo pedido).

### Fixed
- **Foco del input de búsqueda se perdía al escribir** (reportado en pruebas manuales): cada letra generaba un `debouncedQuery` nuevo, que era un `queryKey` de React Query sin datos cacheados (`isPending: true`); `DashboardPage.tsx` reemplazaba toda la vista (input incluido) por `<p>Cargando...</p>` mientras la respuesta viajaba, destruyendo el input y su foco. Con latencia de red real la ventana es visible; el test de regresión anterior no lo detectaba porque el mock resolvía en el mismo tick. Fix: `placeholderData: keepPreviousData` en el `useQuery` de `DashboardPage.tsx`, que mantiene la tabla anterior en pantalla mientras llega la respuesta nueva. Test de regresión nuevo en `DashboardPage.test.tsx` que deja la segunda consulta colgada a propósito (verificado: falla sin el fix, pasa con él).

### Rechazado / Descartado
- **Manejador global de excepciones sanitizado (`backend/app/main.py`/`middleware.py`), streaming/chunking en `ingestion.py`, Multi-stage builds en ambos `Dockerfile`, cabeceras de seguridad + `try_files` de SPA en `nginx.conf`, sincronización `muestra.ts` ↔ `schemas.py`**: ya estaban implementados desde 1.1.0–1.5.0 (ver esas secciones). Se releyó el código de cada uno contra esta ronda de auditoría y no requirieron cambios; ver `docs/ADR-001-Stack-Tecnologico.md` para la referencia consolidada.
- **`queryClient.invalidateQueries()` tras mutaciones de lotes de muestras**: no aplica. La API es de solo lectura (`GET /api/muestras`, `/buscar`, `/exportar`); no existe ningún endpoint `POST`/`PUT`/`DELETE` en `api/muestras.py` que mute un lote de muestras. Introducir invalidación de caché para una mutación que no existe habría sido código muerto. Si en el futuro se agrega un endpoint de subida/edición, el punto de extensión ya está documentado en `docs/TESTING_STRATEGY.md` sección 2.
- **`backend/Dockerfile` a distroless o Alpine**: se mantiene `python:3.12-slim`. `pandas`/`numpy` no publican wheels para musl (Alpine); migrar forzaría compilar ambos desde código fuente dentro de la imagen (build lento y fragile, mismo tipo de problema de wheels ya documentado en el ADR-001 para Python 3.14). `slim` ya es la imagen mínima que no paga ese costo, y el build sigue siendo multi-stage con usuario `appuser` sin privilegios.
- **Colas de mensajes externas (RabbitMQ/Celery/Redis) para la ingesta**: descartado, fuera del stack fijado en el ADR-001; el chunking en memoria (`read_excel_normalized`, ya vigente desde 1.1.0) cubre el caso de uso sin agregar infraestructura nueva.
- **Reescritura de `fuzzy_match.py`/`validation_rules.py` más allá de la sanitización de input**: la cobertura de tests existente valida que los algoritmos cumplen la necesidad de negocio; no se tocó la lógica de matching/estado.
- **Truncamiento complejo a nivel de grafemas en `_sanitize_query`**: descartado por ser sobreingeniería excesiva para un MVP. `thefuzz` opera de forma segura sobre los caracteres tal cual llegan (no hay riesgo de crash ni de interpretación incorrecta por partir un grafema compuesto en dos code points), y el único efecto de un corte "feo" en medio de un emoji/carácter combinado sería una query rara que igual no matchea ningún `id_muestra` real. El costo de detectar límites de grafema (Unicode segmentation) no se justifica para ese riesgo marginal.
- **Migración a Alpine/Distroless en `backend/Dockerfile`**: se reitera el rechazo. `pandas`/`numpy` no publican wheels para musl; migrar rompería la compilación o forzaría instalar un toolchain de build dentro de la imagen final, contradiciendo el propio objetivo de una imagen mínima.
- **Bases de datos externas**: se reitera el rechazo en cumplimiento estricto con el ADR-001; el sistema sigue leyendo exclusivamente los 4 Excel de `DATA_DIR`.
- **Endpoint API unificado para compartir `MAX_QUERY_LENGTH` (200 caracteres) con el frontend**: descartado por sobreingeniería para la madurez actual del MVP. Hoy la constante vive duplicada (`MAX_QUERY_LENGTH` en `fuzzy_match.py`, `MAX_QUERY_LENGTH` en `Dashboard.tsx`) con un comentario cruzado que documenta la relación; agregar un endpoint solo para sincronizar un único número entero no se justifica frente al costo de una llamada de red extra en el arranque de la SPA.
- **Modificación del Rate Limiter para penalizar IPs específicas basadas en los logs de truncamiento**: descartado. `RateLimitMiddleware` ya limita por IP de forma genérica (60 req/min); acoplarlo a los logs de `_sanitize_query` mezclaría dos responsabilidades (rate limiting vs. detección de abuso) y requeriría un mecanismo de correlación log-a-IP que hoy no existe, fuera del alcance de esta iteración.
- **Refactorización a logs JSON estructurados**: descartado. El proyecto usa `logging` estándar de la stdlib sin un agregador de logs centralizado (no hay ELK/Datadog/etc. en el stack); estructurar a JSON sin un consumidor que lo aproveche es trabajo sin beneficio medible hoy.
- **Inyección de Request ID / IP en los logs de advertencia de `fuzzy_match.py`**: descartado para mantener la simplicidad del flujo asíncrono sin dependencias complejas de contexto (habría requerido `contextvars` o pasar el `Request` hasta una capa de servicio que hoy es agnóstica de HTTP). El log de truncamiento ya cumple su propósito (visibilidad de que ocurrió) sin necesitar trazabilidad por request.
- **Cualquier refactorización de código en el cierre de esta ronda de auditoría (2026-07-18)**: descartado explícitamente por regla YAGNI/anti-sobreingeniería. Las 5 etapas de la auditoría (calidad, arquitectura, seguridad, resiliencia, infraestructura/memoria) confirmaron que el diseño actual satisface las reglas de negocio sin complejidad ni dependencias injustificadas; no se tocó `validation_rules.py` ni ninguna estructura Pydantic, ya estabilizadas y probadas. Esta entrada existe para que una futura auditoría vea que el código ya fue revisado y aprobado sin cambios, en vez de volver a proponer los mismos puntos ya rechazados arriba.

## [1.5.0] - 2026-07-18

### Añadido (Added)
* `errores_validacion: list[str]` en `DashboardResponse` (`backend/app/models/schemas.py`): lista los mensajes de fila descartada por `/api/muestras` y `/api/muestras/buscar`. Reflejado en el frontend (`muestra.ts`, `api.ts::isDashboardResponse`) y mostrado en un banner nuevo (`Dashboard.tsx`, clase `.alerta-validacion`) que no oculta la tabla de resultados.
* `fuzzy_correct_threshold` / `fuzzy_search_threshold` en `backend/app/core/config.py` (con overrides `FUZZY_CORRECT_THRESHOLD` / `FUZZY_SEARCH_THRESHOLD`), inyectados en `correct_ids`/`search_by_code` desde `api/muestras.py` en vez de usar los defaults hardcodeados de `fuzzy_match.py`.
* Tests de hardening (`test_hardening.py`): query param malformado (inyección/HTML) y query param excesivamente largo (50k caracteres) contra `/api/muestras/buscar`, verificando que el middleware/endpoint no crashee.
* Tests de partial success (`test_ingestion.py`, `test_api.py`): fila inválida descartada sin abortar el resto del lote, lote 100% inválido devuelve resultado vacío sin excepción.

### Cambiado (Changed)
* **`validate_rows` (`backend/app/services/ingestion.py`) ahora es partial-success**: antes abortaba la ingesta completa (`raise ValueError`) ante la primera fila que no pasara el schema Pydantic; ahora descarta solo esa fila, sigue procesando el resto, y devuelve `(DataFrame, list[str])` con un mensaje por fila descartada. Un error de *archivo* completo (extensión, magic bytes, Zip Bomb, zip corrupto) sigue abortando con 422, porque ahí no hay "resto del lote" que rescatar.
* `test_known_http_errors_still_get_their_real_status_code` (`test_hardening.py`) ya no fuerza el 422 con una fila inválida (ese caso ahora es 200 partial-success); usa un archivo con magic bytes inválidos, que sigue siendo un error de archivo completo.

### Arreglado (Fixed)
* Ninguno en esta iteración.

### Rechazado / Descartado (Rejected/Discarded)
* **Manejador global de excepciones sanitizado, non-root + servidor ASGI de producción en `backend/Dockerfile`, multi-stage + non-root en `frontend/Dockerfile`, CSP/`X-Content-Type-Options`/`X-Frame-Options` en `nginx.conf`, `AbortController` en `api.ts` vía el `signal` de React Query, interceptor centralizado de errores HTTP (`ApiError`/`fetchJson`)**: ya estaban implementados desde 1.1.0–1.3.0 (ver esas secciones). Se verificaron contra la auditoría de esta iteración y no requirieron cambios.
* **Refactor de `download.ts` a "procesamiento async explícito de streams"**: descartado. `exportDashboard` ya devuelve el Blob vía `response.blob()` (asíncrono, no bloqueante); `triggerDownload` solo crea el `<a>` y dispara el click, sin trabajo de parsing que valga la pena mover a un Worker para el tamaño de archivo que maneja esta app (un Excel de unas pocas decenas de miles de filas). Envolver esto en más máquina asíncrona habría sido código sin beneficio medible.
* **Endpoint/gestión de errores por lote vía cola de mensajes o tabla de auditoría de errores**: descartado. El sistema no tiene base de datos ni cola de mensajes (ADR-001); `errores_validacion` se devuelve inline en la misma respuesta del dashboard, consistente con el resto de la arquitectura de solo lectura sobre 4 Excel.
* **Mover el umbral de `MAX_EXCEL_SIZE_MB` / `MAX_UNCOMPRESSED_MB` / `MAX_COMPRESSION_RATIO` a `config.py`**: descartado en esta iteración. La auditoría pedía explícitamente los umbrales de *fuzzy matching*; los límites de seguridad de ingesta (Zip Bomb, tamaño) son constantes de seguridad, no parámetros de negocio para ajustar en tests, y moverlos no estaba en el alcance pedido.

## [1.4.0] - 2026-07-18

### Añadido (Added)
* Test de regresión (`DashboardPage.test.tsx`, "keeps focus on the search input and debounces the fetch while typing") que escribe carácter por carácter con timers falsos y verifica que (a) `document.activeElement` sigue siendo el input después de cada tecla y (b) `fetchDashboard` se llama una sola vez recién al vencer el debounce, no en cada tecla.
* `HEALTHCHECK` en `backend/Dockerfile` (golpea `GET /api/muestras` con `urllib` de la stdlib, sin instalar `curl` en la imagen).

### Cambiado (Changed)
* Ninguno en esta iteración.

### Arreglado (Fixed)
* **Foco del input de búsqueda:** se investigó el reporte de que el input pierde el foco al escribir cada carácter y dispara una petición por tecla. El componente ya era correcto desde la 1.1.0 (`Dashboard.tsx` usa un `<input>` en un componente de función estable, sin recrearse entre renders; `DashboardPage.tsx` ya aplicaba `useDebounce(query, 300)` y el fetch solo se dispara cuando cambia `debouncedQuery`). No hizo falta ningún cambio de código — se dejó el test de regresión de la sección "Añadido" como evidencia verificable de que el comportamiento es correcto.

### Rechazado / Descartado (Rejected/Discarded)
* Patrón Strategy en `validation_rules.py`, streaming por lotes en `ingestion.py`, filtrado exacto previo a la búsqueda difusa en `fuzzy_match.py`, usuario no-root y multi-stage en ambos `Dockerfile`: ya estaban implementados desde 1.1.0–1.3.0, sin cambios.
* **Simular caídas de base de datos:** el proyecto no tiene base de datos (lee 4 Excel de `DATA_DIR`, sin ORM ni motor de datos en `config.py`). No se agregó una capa de base de datos solo para poder simular su caída.
* **Parseo de fechas ISO en `api.ts`/`muestra.ts`:** el contrato de datos (`schemas.py` / `muestra.ts`) no tiene ningún campo de fecha — es todo `str`/`list[str]`/el enum de estado. Agregar parseo de fechas habría sido código sin ningún campo que lo use.
* **Interceptores tipo Axios:** el stack fijado en el ADR-001 no usa Axios; `api.ts` ya centraliza la traducción de errores en un wrapper (`fetchJson`/`ApiError`) desde la 1.1.0, equivalente correcto para `fetch`.

## [1.3.0] - 2026-07-18

### Añadido (Added)
* `defusedxml` en `backend/requirements.txt` como mitigación de XXE: openpyxl detecta esta dependencia en su propio `__init__` (`openpyxl.DEFUSEDXML`) y, si está instalada, reemplaza automáticamente el parser XML stdlib por el de `defusedxml` en todo el proceso.
* Mitigación de Zip Bomb en `assert_safe_excel_file` (`backend/app/services/ingestion.py`): inspección del directorio central del zip (`zipfile.ZipFile(...).infolist()`, sin descomprimir nada) con rechazo si el tamaño descomprimido total supera 200 MB o el ratio de compresión supera 100x.
* Tests de inyección de fallos en `backend/tests/test_ingestion.py`: zip bomb por tamaño absoluto, zip bomb por ratio de compresión, y zip corrupto con magic bytes válidos pero contenido truncado.

### Cambiado (Changed)
* `isDashboardResponse` (`frontend/src/services/api.ts`) ahora valida cada `MuestraEstado` campo por campo (id string, estado dentro del enum válido, arrays de strings), no solo que `muestras`/`alertas_desfase` sean arrays.
* `fetchDashboard`/`exportDashboard` aceptan un `AbortSignal` y se lo pasan a `fetch`; `DashboardPage` usa el `signal` que la propia `queryFn` de TanStack Query provee, que aborta automáticamente cuando `debouncedQuery` cambia o el componente se desmonta. Un `AbortError` ya no se envuelve en `ApiError` (se re-lanza tal cual).

### Arreglado (Fixed)
* Ninguno en esta iteración.

### Rechazado / Descartado (Rejected/Discarded)
* Las optimizaciones de Docker y Nginx se suspendieron y se excluyeron de esta iteración por alcance explícitamente acotado.
* **Zod** para validación de esquemas: se mantuvo el guard hecho a mano (`isDashboardResponse`/`isMuestraEstado`), reforzado campo por campo. Agregar Zod habría sido una dependencia estructural nueva para resolver algo que un type guard sin dependencias ya cubre por completo.
* **`throwOnError: true` global** en `queryClient.ts`: `DashboardPage` ya maneja el error de la query localmente con un banner específico por código HTTP (0/413/422/500), cubierto por tests existentes. Ponerlo global habría reemplazado ese mensaje específico por el fallback genérico del `ErrorBoundary`.
* **Copias profundas en `validation_rules.py`:** ya opera sobre `set`/`groupby` por referencia, sin ningún `.copy()`/deep copy. No había nada que optimizar.
* **Streaming de exportación:** `exportar_muestras` ya devuelve `StreamingResponse` desde la iteración anterior. No se tocó.

## [1.2.0] - 2026-07-18

### Añadido (Added)
* `RateLimitMiddleware` (`backend/app/core/middleware.py`): ventana deslizante en memoria por IP, 60 req/min por defecto, responde 429 + `Retry-After`. Sin dependencias nuevas (usa solo `collections.deque`).
* `frontend/src/components/ErrorBoundary.tsx`: red de contención para errores de render de React que escapan al manejo de errores de React Query. Envuelve `DashboardPage` en `App.tsx`.
* Cabeceras de seguridad (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `CSP`) en `frontend/nginx.conf`, antes solo presentes en las respuestas de la API.
* `docs/TESTING_STRATEGY.md` (creación inicial).

### Cambiado (Changed)
* `try_files` en `nginx.conf` ahora también prueba `$uri/` antes de caer al fallback de SPA.

### Arreglado (Fixed)
* Ninguno en esta iteración.

### Rechazado / Descartado (Rejected/Discarded)
* `useMuestrasMutation`, invalidación de caché "tras la subida de un archivo maestro" y Optimistic UI, y tests de subida de archivos corruptos vía HTTP con 400/413: esta API es de solo lectura (`GET /api/muestras`, `/buscar`, `/exportar`); no existe ningún endpoint de subida ni mutación en el sistema. La validación de archivos corruptos ya se cubre donde sí existe: en la ingesta de los Excel de origen.

## [1.1.0] - 2026-07-18

### Añadido (Added)
* Validación de *magic bytes* (no solo la extensión `.xlsx`) antes de intentar parsear cualquier archivo.
* Patrón Chain of Responsibility en `backend/app/services/validation_rules.py` (`ReglaPruebasFantasma` → `ReglaPruebasFaltantes` → `ReglaCompleto`).
* Hardening de `backend/app/main.py`: límite de tamaño de payload (413), headers de seguridad (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) y manejador de excepciones que nunca devuelve el stack trace real al cliente.
* Guarda de forma en tiempo de ejecución (`isDashboardResponse`) en `api.ts`, sincronizando el contrato de datos entre `frontend/src/types/muestra.ts` y `backend/app/models/schemas.py`.
* Tipado de errores como `ApiError` (con código HTTP) en `api.ts`, traducido a banner con mensaje amigable en `Dashboard.tsx`.
* Casos de prueba de límite en ingesta (archivos corruptos, extensión falseada, tamaño excedido), 413/422 en la API, no fuga de stack traces, y fallos de red simulados en el flujo de búsqueda/exportación del frontend.

### Cambiado (Changed)
* Refactorización de la capa de ingesta (`backend/app/services/ingestion.py`) a lectura streaming por lotes vía `openpyxl` en modo `read_only`.
* Ambos `Dockerfile` reescritos con build multi-etapa: el backend corre con Gunicorn + workers de Uvicorn bajo un usuario `appuser` sin privilegios; el frontend se compila con Node/Vite y se sirve con `nginx-unprivileged` (puerto 8080, sin root).
* Corrección de una nota de documentación: `thefuzz` no corre "en modo Python puro" por no tener `python-Levenshtein` para Python 3.14 — desde la versión 0.20, `thefuzz` delega internamente en `rapidfuzz` (C++, vectorizado), que sí publica wheel para 3.14 y ya estaba instalado como dependencia transitiva. Se fijó explícito en `requirements.txt` y se corrigió la nota en el README y en el ADR.

### Arreglado (Fixed)
* Ninguno en esta iteración.

### Rechazado / Descartado (Rejected/Discarded)
* Ninguno en esta iteración; se mantuvo el stack de [ADR-001-Stack-Tecnologico.md](docs/ADR-001-Stack-Tecnologico.md).

## [1.0.0] - 2026-07-17

### Añadido (Added)
* Barra de búsqueda rápida por código en el Dashboard (Frontend).
* Suite de pruebas de integración obligatorias para el flujo de validación.
* Configuración Docker (`docker-compose.yml`) y `.env.example` para despliegue local aislado.
* React Query y virtualización de listas en la UI.

### Cambiado (Changed)
* Optimización de ingesta de Excel por chunks para evitar sobrecarga de memoria (Backend).

### Arreglado (Fixed)
* Ninguno en esta iteración (versión inicial).

### Rechazado / Descartado (Rejected/Discarded)
* Ninguno en esta iteración; se mantuvieron las tecnologías dictadas en [ADR-001-Stack-Tecnologico.md](docs/ADR-001-Stack-Tecnologico.md).
