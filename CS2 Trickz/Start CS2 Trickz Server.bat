@echo off
setlocal ENABLEDELAYEDEXPANSION

REM -----------------------------------------------
REM CS2 Trickz - One-click local dev server (Windows)
REM Fixes:
REM  - Bind explicitly to IPv4 127.0.0.1 (avoids ::/IPv6-only binding)
REM  - Correct quoting so the server window stays open
REM  - Uses pushd to handle spaces in paths
REM -----------------------------------------------

set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%app"
set "PORT=5500"
set "URL=http://127.0.0.1:%PORT%"

if not exist "%APP_DIR%" (
  echo [ERROR] Could not find app directory: "%APP_DIR%"
  echo Make sure this file lives in the "CS2 Trickz" folder next to the "app" folder.
  pause
  exit /b 1
)

echo [INFO] Starting CS2 Trickz server in:
echo        %APP_DIR%
echo [INFO] Target URL: %URL%

REM Pick python launcher
set "RUN="
where py >nul 2>nul
if %errorlevel%==0 (
  set "RUN=py -m http.server %PORT% --bind 127.0.0.1"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    set "RUN=python -m http.server %PORT% --bind 127.0.0.1"
  ) else (
    echo [ERROR] Python was not found on your PATH.
    echo - Install Python from https://www.python.org/downloads/
    echo - Or in VS Code use the "Live Server" extension and open:
    echo     %APP_DIR%\index.html
    pause
    exit /b 1
  )
)

echo [INFO] Launching server window...
REM IMPORTANT: Use pushd and escaped & so Start receives a correct command line
start "CS2 Trickz Server" cmd /k pushd "%APP_DIR%" ^& %RUN%

REM Give the server a short moment to start, then open default browser
timeout /t 2 >nul 2>nul
start "" "%URL%"
echo [INFO] Opened %URL% in your default browser.
echo Close the "CS2 Trickz Server" window to stop the server.
exit /b 0