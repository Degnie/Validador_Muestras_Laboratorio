# Manual de Usuario: Validador de Muestras de Laboratorio

Este documento explica cómo iniciar y configurar el Validador de Muestras en cualquier
computadora del área del laboratorio. No se requieren conocimientos técnicos avanzados ni
instalaciones de software especiales.

## 1. Requisitos Previos

- **Sistema Operativo:** Windows 10 o Windows 11.
- **Navegador Web:** Google Chrome, Microsoft Edge o Mozilla Firefox actualizados.
- **Acceso a la Red:** Conexión a la carpeta compartida del laboratorio donde se depositan los
  archivos Excel (`Datos.xlsx` y `Checklist_Maestro.xlsx`).

Nota: NO necesita instalar Python, Docker, ni contactar a soporte de TI.

## 2. Guía de Arranque (Paso a Paso)

1. **Recibir el sistema:** copie la carpeta entregada llamada `ValidadorMuestras` en el
   Escritorio o en Documentos de la computadora del laboratorio.
2. **Configurar la ruta (una sola vez):**
   - Dentro de la carpeta `ValidadorMuestras`, busque un archivo llamado `.env`.
   - Haga clic derecho sobre él y seleccione **Abrir con → Bloc de notas**.
   - Verá un texto como este: `DATA_DIR=Z:\...`. Cambie la ruta después del signo `=` por la
     ruta exacta de la carpeta compartida donde están sus Excel (ver sección 3).
   - Guarde los cambios (**Archivo → Guardar**) y cierre el Bloc de notas.
3. **Iniciar el programa:**
   - Haga doble clic en el archivo `ValidadorMuestras.exe` (ícono de aplicación).
   - Se abrirá una ventana negra (consola del sistema). No cierre esta ventana, es el motor
     del validador funcionando en segundo plano.
4. **Ver el Validador:**
   - Abra su navegador web (Chrome, Edge, etc.).
   - En la barra de direcciones escriba exactamente esto y presione Enter:
     `http://localhost:8000`
   - ¡Listo! Verá la pantalla del Validador con los datos de sus muestras.
5. **Apagar el sistema:** al final del turno, simplemente cierre la ventana negra (consola).
   El sistema se apagará de forma segura.

## 3. Configuración de Variables de Entorno (`.env`)

El archivo `.env` es el puente entre el programa y sus archivos Excel. Solo contiene una clave
que debe modificar:

- **`DATA_DIR`**: es la ubicación exacta de la carpeta compartida del laboratorio.
  - ¿Qué significa? Le dice al programa dónde buscar `Datos.xlsx` y `Checklist_Maestro.xlsx`.
  - ¿Dónde la obtengo? Vaya a la carpeta de red donde guardan los Excel, haga clic en la
    barra de direcciones superior del Explorador de Archivos de Windows, copie el texto y
    péguelo.
  - Ejemplo válido: `DATA_DIR=Z:\Laboratorio\AreaFinal`
  - Ejemplo válido (ruta de red): `DATA_DIR=\\ServidorCentral\Laboratorio\Muestras`

## 4. Solución de Problemas Comunes (Troubleshooting)

Si el sistema no arranca o muestra un error, revise estas situaciones probables:

**Problema 1: Hago doble clic en el .exe y la ventana negra se abre y se cierra al instante.**
- Causa probable: hay un error de escritura en el archivo `.env`, o el puerto 8000 está siendo
  usado por otro programa.
- Solución: revise que el archivo `.env` se llame exactamente `.env` (no `.env.txt`) y que no
  haya espacios antes ni después del signo `=` en `DATA_DIR`.

**Problema 2: En el navegador aparece "No se puede acceder a este sitio" o "Rechazó la
conexión".**
- Causa probable: el servidor no está encendido, o introdujo mal la dirección en el navegador.
- Solución: verifique que la ventana negra (consola) de `ValidadorMuestras.exe` sigue abierta
  y minimizada. Asegúrese de haber escrito `http://localhost:8000` en el navegador (sin
  "www" y sin "https").

**Problema 3: El programa carga en el navegador, pero muestra un error de lectura de archivos
o dice que no encuentra los datos.**
- Causa probable: la ruta compartida es incorrecta, la computadora no tiene permisos de red, o
  los archivos Excel no tienen el nombre correcto.
- Solución:
  - Compruebe que tiene acceso a la unidad compartida desde esa computadora.
  - Verifique en su Explorador de Archivos que dentro de la ruta configurada en el `.env`
    existan dos archivos llamados exactamente `Datos.xlsx` y `Checklist_Maestro.xlsx`. Si los
    archivos se llaman `Datos_final.xlsx` o `Checklist(1).xlsx`, el sistema no los reconocerá.
    Deberá renombrarlos.

## 5. Nota sobre acceso desde otras computadoras

El Validador solo escucha en la propia PC donde se ejecuta (`localhost`) — no es alcanzable
desde otras computadoras de la red del laboratorio, ni siquiera con la misma dirección. Esto
es intencional: el sistema no tiene login, así que limitarlo a la máquina donde corre evita
que cualquier otra PC de la red le pegue directo al puerto 8000. Si más adelante el laboratorio
necesita que varias personas vean el mismo Validador desde distintas computadoras a la vez, es
una necesidad distinta (un servidor central, no un ejecutable por PC) y hay que evaluarla aparte.
