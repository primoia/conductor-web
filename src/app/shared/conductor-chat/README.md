# Conductor Chat - Angular Component

Chat integrado em Angular, convertido do React, com suporte a streaming SSE e reconhecimento de voz.

## 🎯 Funcionalidades

- ✅ **Modo Ask/Agent**: Alterna entre consultas (read-only) e modificações no screenplay
- ✅ **Streaming SSE**: Comunicação em tempo real com eventos server-sent
- ✅ **Reconhecimento de Voz**: Suporte a entrada por voz (Web Speech API)
- ✅ **Interface Responsiva**: Design moderno e adaptável
- ✅ **Mensagens Formatadas**: Suporte a HTML nas respostas
- ✅ **Indicador de Status**: Mostra conexão e estado de carregamento

## 📁 Estrutura

```
conductor-chat/
├── components/
│   ├── chat-messages/          # Exibição de mensagens
│   ├── chat-input/             # Input com seletor de modo
│   └── status-indicator/       # Indicador de status
├── services/
│   ├── conductor-api.service.ts    # Comunicação SSE
│   └── speech-recognition.service.ts # Reconhecimento de voz
├── models/
│   └── chat.models.ts          # Interfaces e tipos
├── conductor-chat.component.ts  # Componente principal
└── index.ts                    # Exportações públicas
```

## 🚀 Uso

### Importação

```typescript
import { ConductorChatComponent } from './shared/conductor-chat';

@Component({
  imports: [ConductorChatComponent],
  template: `<app-conductor-chat></app-conductor-chat>`
})
```

### Integração com Splitter Redimensionável

```typescript
// No componente pai
screenplayWidth = 70;
chatWidth = 30;

// Template
<div class="layout">
  <div [style.width.%]="screenplayWidth">
    <!-- Seu conteúdo -->
  </div>

  <div class="splitter" (mousedown)="onSplitterMouseDown($event)"></div>

  <div [style.width.%]="chatWidth">
    <app-conductor-chat></app-conductor-chat>
  </div>
</div>
```

## 🎨 Customização

### Configuração da API

Edite `DEFAULT_CONFIG` em `conductor-chat.component.ts`:

```typescript
const DEFAULT_CONFIG: ConductorConfig = {
  api: {
    baseUrl: 'http://localhost:5006',
    streamEndpoint: '/api/v1/stream-execute',
    apiKey: 'sua-api-key'
  },
  mode: 'ask',
  welcomeMessage: 'Sua mensagem de boas-vindas',
  autoScroll: true
};
```

### Estilos

Os estilos estão inline nos componentes. Para customizar:

1. Componente principal: `conductor-chat.component.ts`
2. Mensagens: `chat-messages.component.ts`
3. Input: `chat-input.component.ts`

## 🔧 Modos de Operação

### Modo Ask (💬)
- Apenas consultas
- Não modifica o screenplay
- Respostas informativas

### Modo Agent (🤖)
- Pode executar ações
- Modifica o screenplay
- Contexto adicional enviado: `[AGENT MODE - Can modify screenplay]`

## 📡 API Events

O serviço responde aos seguintes eventos SSE:

- `job_started`: Job iniciado
- `status_update`: Atualização de status
- `on_llm_start`: LLM iniciando
- `on_llm_new_token`: Token de streaming
- `on_tool_start`: Ferramenta iniciada
- `on_tool_end`: Ferramenta concluída
- `result`: Resultado final
- `error`: Erro na execução

## 🎤 Reconhecimento de Voz

Suporta navegadores com Web Speech API:
- ✅ Chrome/Edge
- ✅ Safari
- ⚠️ Firefox (limitado)

Idioma padrão: `pt-BR`

## 🔄 Ciclo de Vida

1. **Inicialização**: Mensagem de boas-vindas
2. **Check de Conexão**: Verifica API a cada 30s
3. **Envio de Mensagem**: Streaming SSE
4. **Atualização**: Mensagens progressivas e streaming
5. **Finalização**: Mensagem final ou erro

## 🐛 Debug

Logs no console:
```javascript
console.log('[ConductorApiService] ...')
console.log('Stream event:', ...)
console.log('SSE Event received:', ...)
```

## 📝 Notas

- Componentes standalone (não requer módulo)
- RxJS para gerenciamento de estado
- DomSanitizer para HTML seguro
- Detecção automática de URL da API
