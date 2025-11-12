# 🐛 Guia de Debug - Sistema de Diálogo e Inventário

## 📋 Problema Reportado

1. **Segunda mensagem aparece automaticamente** antes do clique do usuário
2. **Item não aparece no inventário** quando a mensagem "TRANSFERÊNCIA INICIADA" é exibida

## 🧹 Como Limpar Cache e Rebuildar

### Opção 1: Script Automático
```bash
cd /mnt/ramdisk/primoia-main/conductor-community/conductor/conductor-web
./rebuild-with-debug.sh
```

### Opção 2: Manual
```bash
# Limpar cache
rm -rf .angular dist node_modules/.cache node_modules/.vite

# Limpar localStorage do navegador (F12 > Console)
localStorage.clear()
sessionStorage.clear()
location.reload()

# Rebuildar
npm run build

# Reiniciar containers
cd ../../..
bash run-start-all-dev.sh
```

## 📊 Logs de Debug Implementados

Todos os logs começam com emojis para fácil identificação:

### 🎭 Process Choice (dialogue.service.ts)
Quando você clica em uma opção de diálogo:
```
🎭 [DEBUG] ========== PROCESS CHOICE ==========
🎭 [DEBUG] Opção selecionada: "Aceitar o Código Primordial"
🎭 [DEBUG] Option ID: opt2
🎭 [DEBUG] Next node: give_code
🎭 [DEBUG] XP: 20
```

### 🔄 Advance To Node (dialogue.service.ts)
Quando o diálogo avança para um novo nó:
```
🔄 [DEBUG] ========== ADVANCE TO NODE ==========
🔄 [DEBUG] Node ID: give_code
🔄 [DEBUG] Timestamp: 2025-01-XX...
🔄 [DEBUG] Estrutura do nó 'give_code': {...}
🔄 [DEBUG] Tem opções? 1
🔄 [DEBUG] Tem next? false
🔄 [DEBUG] Tem action? true
```

**⚠️ PONTO CRÍTICO DE DEBUG:**
```
⏭️ [DEBUG] ⚠️ NÓ SEM OPÇÕES MAS COM NEXT! Avançará automaticamente para: xxx
⏭️ [DEBUG] Aguardando 2 segundos antes de avançar...
```
Se você ver esta mensagem, significa que o nó atual NÃO tem opções mas TEM um campo `next`, então ele avança automaticamente após 2 segundos!

### 🎁 Give Item Action (dialogue.service.ts)
Quando o NPC dá um item:
```
🎁 [DEBUG] ========== GIVE ITEM ACTION ==========
🎁 [DEBUG] Item ID: primordial_code
🎁 [DEBUG] inventoryIntegration disponível? true
🎁 [DEBUG] Chamando inventoryIntegration.receiveItemFromNPC
🎁 [DEBUG] ⚠️ PROCESSANDO GIVE_ITEM ANTES DO DIÁLOGO
```

### 📦 Receive Item From NPC (inventory-quest-integration.service.ts)
Quando o serviço de integração processa o item:
```
📦 [DEBUG] ========== RECEIVE ITEM FROM NPC ==========
📦 [DEBUG] Item ID: primordial_code
📦 [DEBUG] NPC ID: elder_guide
📦 [DEBUG] Chamando inventoryService.addItem("primordial_code")
```

### 🎒 Add Item To Inventory (inventory.service.ts)
Quando o item é adicionado ao inventário:
```
🎒 [DEBUG] ========== ADD ITEM TO INVENTORY ==========
🎒 [DEBUG] Input: ID="primordial_code"
🎒 [DEBUG] Slots usados: 0/20
🎒 [DEBUG] Items atuais no inventário: []
🎒 [DEBUG] Criando item do template: primordial_code
🎒 [DEBUG] Item criado: {...}
🎒 [DEBUG] Marcando item como novo (isNew=true)
🎒 [DEBUG] Adicionando item ao array de itens
✅ [DEBUG] Item adicionado! Novo total de slots usados: 1
🎒 [DEBUG] Items finais no inventário: ["primordial_code(NEW)"]
```

## 🔍 Como Fazer Debug Passo a Passo

### 1. Abra o Console do Navegador
- Pressione **F12**
- Vá para a aba **Console**
- Deixe aberto durante toda a interação

### 2. Inicie o Diálogo com o Guia Ancião
- Clique no Guia Ancião no jogo
- Observe os logs iniciais

### 3. Clique em "O que é o Código Primordial?"
Você deverá ver:
```
🎭 [DEBUG] ========== PROCESS CHOICE ==========
🎭 [DEBUG] Opção selecionada: "O que é o Código Primordial?"
...
🔄 [DEBUG] ========== ADVANCE TO NODE ==========
🔄 [DEBUG] Node ID: explain_code
```

### 4. Aguarde a Explicação
Verifique se:
- O texto da explicação aparece
- As opções ficam disponíveis (deve ter 1 opção: "Aceitar o Código Primordial")
- NÃO deve avançar automaticamente

### 5. Clique em "Aceitar o Código Primordial"
Você deverá ver:
```
🎭 [DEBUG] ========== PROCESS CHOICE ==========
🎭 [DEBUG] Opção selecionada: "Aceitar o Código Primordial"
...
🔄 [DEBUG] ========== ADVANCE TO NODE ==========
🔄 [DEBUG] Node ID: give_code
🎁 [DEBUG] ⚠️ PROCESSANDO GIVE_ITEM ANTES DO DIÁLOGO  <-- CRÍTICO!
📦 [DEBUG] ========== RECEIVE ITEM FROM NPC ==========
🎒 [DEBUG] ========== ADD ITEM TO INVENTORY ==========
✅ [DEBUG] Item primordial_code adicionado com sucesso!
💬 [DEBUG] Atualizando diálogo com texto: "TRANSFERÊNCIA INICIADA..."
```

### 6. Abra o Inventário (TAB ou I)
O item deve estar lá com o efeito visual dourado pulsante.

## 🎯 O Que Procurar Nos Logs

### ✅ Sequência Correta (Esperada):
1. `PROCESS CHOICE` → "Aceitar o Código Primordial"
2. `ADVANCE TO NODE` → give_code
3. `PROCESSANDO GIVE_ITEM ANTES DO DIÁLOGO` ← **DEVE APARECER AQUI**
4. `RECEIVE ITEM FROM NPC`
5. `ADD ITEM TO INVENTORY`
6. `Item adicionado com sucesso`
7. `Atualizando diálogo com texto: "TRANSFERÊNCIA..."`

### ❌ Problemas a Identificar:

**Problema 1: Avanço Automático Indesejado**
```
⏭️ [DEBUG] ⚠️ NÓ SEM OPÇÕES MAS COM NEXT!
```
Se isso aparecer após "explain_code", significa que o nó tem um campo `next` que não deveria ter.

**Problema 2: Item Não Adicionado**
```
❌ [DEBUG] Falha ao dar item primordial_code ao jogador
```
Ou ausência dos logs de `ADD ITEM TO INVENTORY`.

**Problema 3: Cache Antigo**
Se o texto da explicação for diferente de:
> "O Código Primordial é um arquivo criptografado ancestral..."

Significa que está rodando código antigo (cache).

## 📸 Captura de Logs

Para enviar os logs:
1. Clique com botão direito no console
2. "Save as..." ou copie tudo
3. Cole em um arquivo ou mensagem

## 🔧 Estrutura dos Nós de Diálogo

```typescript
'start': {
  options: [
    { text: 'O que é o Código Primordial?', next: 'explain_code' },
    { text: 'Aceitar o Código Primordial', next: 'give_code' }
  ]
}

'explain_code': {
  text: 'O Código Primordial é...',
  options: [
    { text: 'Aceitar o Código Primordial', next: 'give_code' }
  ]
  // SEM campo 'next'! Não deve avançar automaticamente!
}

'give_code': {
  text: 'TRANSFERÊNCIA INICIADA...',
  action: { type: 'give_item', item: 'primordial_code' }, // ← Processado ANTES do texto
  options: [
    { text: 'Onde encontro a Bibliotecária?', next: 'end' }
  ]
}
```

## 🚨 Sinais de Alerta

1. **"Aguardando 2 segundos antes de avançar"** após explain_code = ERRO
2. **Texto diferente** do esperado = Cache antigo
3. **Item não aparece** mas logs mostram sucesso = Problema de renderização
4. **Logs ausentes** = Build não atualizou

## 💡 Dicas Finais

- Sempre limpe o cache antes de testar
- Use `Ctrl+Shift+R` para hard refresh no navegador
- Verifique se o timestamp dos logs está aumentando
- Compare o timestamp do `give_item` com o do `Atualizando diálogo`
  - O `give_item` deve ser ANTES!
