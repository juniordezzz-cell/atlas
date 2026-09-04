@echo off
rem ============================================================
rem  ATLAS - atalho para abrir o app do jeito certo (http, nao file://)
rem
rem  O que ele faz:
rem   1. Entra na pasta onde este .bat esta (a raiz do ATLAS).
rem   2. Sobe um servidor local na porta 8777 - se ja nao houver um.
rem   3. Abre o navegador em http://localhost:8777/ (a tela de Boot).
rem
rem  Deixe a janela do servidor ABERTA enquanto usa o ATLAS.
rem  Para desligar, FECHE aquela janela.
rem ============================================================
title ATLAS
cd /d "%~dp0"

set "PORTA=8777"
set "URL=http://localhost:%PORTA%/"

rem --- Escolhe o Python: o lancador "py -3" ou o "python" do PATH ---
set "PYCMD=python"
where py >nul 2>&1 && set "PYCMD=py -3"

rem --- Ja existe um servidor escutando nessa porta? ---
netstat -ano | findstr ":%PORTA% " | findstr /i "LISTENING" >nul 2>&1
if errorlevel 1 (
  echo Subindo o servidor local na porta %PORTA%...
  rem Janela dedicada ao servidor. Fechar essa janela desliga o ATLAS.
  start "ATLAS - servidor local (NAO FECHE esta janela)" cmd /k "%PYCMD% -m http.server %PORTA%"
  rem Da um instante para o servidor ficar de pe antes de abrir o navegador.
  timeout /t 2 >nul
) else (
  echo O servidor ja esta rodando na porta %PORTA%.
)

echo Abrindo o ATLAS em %URL%
start "" "%URL%"
exit /b
