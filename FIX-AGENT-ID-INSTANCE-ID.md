# Fix: agent_id não estava sendo salvo no history

## Problema Identificado

O `instance_id` não estava sendo salvo corretamente na collection `history` do MongoDB porque o `agent_id` não estava sendo passado do frontend para o backend.

### Fluxo do Problema

1. **Markdown com âncora:**
   ```markdown
   <!-- agent-instance: 745cffc7-0f3a-4c3e-b4b5-878ca82e5390, agent-id: target-agent -->
   📄
   ```

2. **Frontend parseava a âncora** mas NÃO salvava o `agent_id` na instância:
   ```typescript
   // ❌ ANTES (ERRADO)
   const newInstance: AgentInstance = {
     id: instanceId,
     // agent_id: agentId,  // <-- FALTANDO!
     emoji: emoji,
     definition: definition || { ... },
     status: 'pending',
     position: this.calculateEmojiPosition(match.index || 0)
   };
   ```

3. **Ao clicar no agente**, o `agent_id` era `undefined`:
   ```typescript
   this.conductorChat.loadContextForAgent(
     instance.id,           // ✅ instance_id OK
     instance.definition.title,
     instance.emoji,
     instance.agent_id      // ❌ undefined!
   );
   ```

4. **No chat**, `selectedAgentDbId` ficava `null`:
   ```typescript
   this.selectedAgentDbId = agentDbId || null;  // null porque agentDbId era undefined
   ```

5. **Na execução**, o agente não era executado corretamente:
   ```typescript
   if (this.activeAgentId && this.selectedAgentDbId) {  // ❌ Falha aqui!
     this.agentService.executeAgent(this.selectedAgentDbId, content.trim(), this.activeAgentId);
   }
   ```

## Solução Implementada

### 1. Adicionar `agent_id` ao criar instância do markdown

**Arquivo:** `projects/conductor-web/src/app/living-screenplay-simple/screenplay-interactive.ts`

**Linha:** ~903

```typescript
// ✅ DEPOIS (CORRETO)
const newInstance: AgentInstance = {
  id: instanceId,
  agent_id: agentId,  // 🔥 FIX: Adicionar agent_id extraído da âncora
  emoji: emoji,
  definition: definition || { ... },
  status: 'pending',
  position: this.calculateEmojiPosition(match.index || 0)
};
```

### 2. Adicionar logs para debug

Foram adicionados logs em vários pontos do fluxo:

#### screenplay-interactive.ts
- Ao criar instância do markdown (linha ~903)
- Ao clicar no agente (linha ~1206)

#### conductor-chat.component.ts
- Ao carregar contexto do agente (linha ~477)
- Ao executar agente (linha ~280)

#### agent.service.ts
- Ao executar agente (linha ~119)

## Como Testar

1. **Carregar um markdown com âncora:**
   ```markdown
   <!-- agent-instance: 745cffc7-0f3a-4c3e-b4b5-878ca82e5390, agent-id: ReadmeResume_Agent -->
   📄
   ```

2. **Verificar logs no console:**
   ```
   ✨ Criando instância 745cffc7-0f3a-4c3e-b4b5-878ca82e5390 do agente ReadmeResume_Agent (📄)
      - instance_id: 745cffc7-0f3a-4c3e-b4b5-878ca82e5390
      - agent_id (do markdown): ReadmeResume_Agent
      - emoji: 📄
   ✅ Instância criada com agent_id: ReadmeResume_Agent
   ```

3. **Clicar no agente:**
   ```
   📍 [SCREENPLAY] Agente clicado:
      - instance_id: 745cffc7-0f3a-4c3e-b4b5-878ca82e5390
      - agent_id (MongoDB): ReadmeResume_Agent
      - Nome: README Resume Agent
      - Emoji: 📄
   ```

4. **Executar no chat:**
   ```
   🎯 [CHAT] Executando agente diretamente:
      - agent_id (MongoDB): ReadmeResume_Agent
      - instance_id: 745cffc7-0f3a-4c3e-b4b5-878ca82e5390
      - input_text: teste
   ```

5. **Verificar no MongoDB:**
   ```javascript
   db.history.find({ instance_id: "745cffc7-0f3a-4c3e-b4b5-878ca82e5390" })
   ```
   
   Deve retornar documentos com `instance_id` preenchido.

## Arquivos Modificados

1. `projects/conductor-web/src/app/living-screenplay-simple/screenplay-interactive.ts`
   - Linha ~903: Adicionar `agent_id` ao criar instância
   - Linha ~1206: Adicionar logs de debug

2. `projects/conductor-web/src/app/shared/conductor-chat/conductor-chat.component.ts`
   - Linha ~477: Adicionar logs de debug
   - Linha ~280: Adicionar logs de debug

3. `projects/conductor-web/src/app/services/agent.service.ts`
   - Linha ~119: Adicionar logs de debug

## Observações

- O backend já estava preparado para receber e salvar o `instance_id` corretamente
- O problema era apenas no frontend que não estava passando o `agent_id`
- Com essa correção, o `instance_id` será salvo corretamente no history do MongoDB
- Os logs adicionados facilitam o debug de problemas futuros
