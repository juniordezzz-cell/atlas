@echo off
rem Laboratorio de Agentes: liga o programa e abre a tela no navegador.
rem Feche esta janela para desligar. Se ja estiver aberto, so abre o navegador.
title Laboratorio de Agentes
cd /d "%~dp0.."
node laboratorio/servidor.mjs
if errorlevel 1 pause
