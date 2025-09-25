#!/bin/bash

echo "Parando servidor de desenvolvimento..."

# Mata processos do Angular/Node na porta 4200
lsof -ti:4200 | xargs kill -9 2>/dev/null || true

# Mata outros processos relacionados ao desenvolvimento
pkill -f "ng serve" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true

echo "Servidor parado."

# Aguarda um pouco para garantir que os processos foram finalizados
sleep 2

echo "Iniciando servidor..."

# Inicia o servidor
npm start