@echo off
setlocal

echo ==========================================
echo  1. Compilando Frontend (React/Vite)
echo ==========================================
cd frontend
call npm install
call npm run build
cd ..

echo ==========================================
echo  2. Preparando Entorno Backend
echo ==========================================
cd backend
rem Limpiar restos de una build anterior.
if exist web_build rmdir /s /q web_build
if exist build rmdir /s /q build
if exist ..\release rmdir /s /q ..\release
python -m venv venv_build
call venv_build\Scripts\activate
rem requirements.txt (no requirements-dev.txt): pytest/httpx no van dentro del ejecutable.
pip install -r requirements.txt
pip install pyinstaller

echo ==========================================
echo  3. Copiando archivos estaticos
echo ==========================================
xcopy /E /I /Y ..\frontend\dist .\web_build

echo ==========================================
echo  4. Ubicando libssl/libcrypto del interprete base
echo ==========================================
rem El escaneo automatico de dependencias de PyInstaller no siempre detecta estas DLLs
rem (depende de como este empaquetado el Python base) -- se agregan a mano para que
rem "import ssl" (usado por anyio/starlette) no falle en el .exe con DLL load failed.
for /f "delims=" %%i in ('python -c "import sys, os; print(os.path.join(sys.base_prefix, 'DLLs'))"') do set PYDLLDIR=%%i

echo ==========================================
echo  5. Empaquetando Ejecutable (PyInstaller)
echo ==========================================
rem --distpath fuera de backend/: "backend/dist" es el nombre que main.py revisa en modo
rem dev (SERVE_SPA) para saber si hay un frontend empaquetado -- si la salida de PyInstaller
rem quedara ahi, un "pytest"/"uvicorn --reload" posterior en esta misma carpeta la
rem confundiria con un build real y rompia.
pyinstaller --name "ValidadorMuestras" ^
  --onedir --noconfirm --clean ^
  --distpath ..\release ^
  --add-data "web_build;dist" ^
  --add-binary "%PYDLLDIR%\libssl-3.dll;." ^
  --add-binary "%PYDLLDIR%\libcrypto-3.dll;." ^
  --hidden-import "pandas" ^
  --hidden-import "rapidfuzz" ^
  --hidden-import "uvicorn" ^
  app\main.py

echo ==========================================
echo  6. Copiando plantilla de .env junto al .exe
echo ==========================================
copy /Y ..\deploy\env.template ..\release\ValidadorMuestras\.env

echo ==========================================
echo Construccion finalizada!
echo Entrega lista en: release\ValidadorMuestras
echo ==========================================
pause
