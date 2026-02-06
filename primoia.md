# Conductor Web

Interface web do Conductor que transforma documentos Markdown em paineis interativos ("Documentos Vivos"), onde emojis atuam como ancoras para instancias de agentes de IA.

## Responsabilidades
- Renderizar screenplays Markdown com agentes interativos embarcados
- Gerenciar conversas paralelas com diferentes agentes
- Exibir execucao de agentes em tempo real via SSE e WebSocket
- Persistir estado de agentes diretamente no Markdown via comentarios HTML

## Stack
- Angular 20 + TypeScript
- TipTap (editor rico)
- marked (renderizacao Markdown)
- SSE + WebSocket (tempo real)
