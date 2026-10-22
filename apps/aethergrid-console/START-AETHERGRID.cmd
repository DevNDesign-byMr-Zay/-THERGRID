@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-AETHERGRID.ps1"
if errorlevel 1 (
  echo.
  echo AETHERGRID could not start. Review the message above before closing this window.
  pause
)
