#!/bin/bash

echo "🧹 Limpando cache e arquivos antigos..."
rm -rf .angular
rm -rf dist
rm -rf node_modules/.cache
rm -rf node_modules/.vite

echo "🔨 Rebuilding com logs de debug..."
npm run build

echo "✅ Build completo! Agora você pode:"
echo "  1. Parar os containers atuais"
echo "  2. Subir novamente com: bash run-start-all-dev.sh"
echo "  3. Abrir o console do navegador (F12) e interagir com o Guia Ancião"
echo "  4. Todos os logs de debug aparecerão no console"
echo ""
echo "📊 Logs de debug implementados:"
echo "  🎭 [DEBUG] - Processo de escolha de diálogo"
echo "  🔄 [DEBUG] - Avanço entre nós de diálogo"
echo "  🎬 [DEBUG] - Processamento de ações"
echo "  🎁 [DEBUG] - Dar item ao jogador"
echo "  📦 [DEBUG] - Receber item de NPC"
echo "  🎒 [DEBUG] - Adicionar item ao inventário"
