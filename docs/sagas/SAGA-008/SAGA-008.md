# SAGA-008: Permitir Edição da Persona do Agente

## 📋 Context & Background

Atualmente, a persona do agente é exibida apenas como leitura no modal de contexto (📋) do chat. Os usuários não têm a capacidade de editar ou personalizar a persona de um agente ativo, limitando a flexibilidade e personalização do sistema.

**Situação atual:**
- A persona é carregada via `getAgentContext()` e exibida no modal
- Existe apenas visualização, sem capacidade de edição
- O botão de engrenagem (⚙️) já existe mas não oferece opção de editar persona
- A API `updateInstance()` está disponível para atualizar campos da instância

**Problema:**
- Usuários não podem personalizar agentes em tempo real
- Falta de flexibilidade para ajustar comportamento do agente
- Interface limitada para configuração de contexto

## 🎯 Objectives

**Objetivo Principal:**
Permitir que usuários editem a persona de agentes ativos através de uma interface intuitiva, sem afetar o backend (conductor-gateway).

**Objetivos Específicos:**
1. Adicionar opção "Editar Persona" no menu de opções do agente (⚙️)
2. Criar modal de edição com editor de texto/markdown
3. Implementar funcionalidade de salvamento local (frontend-only)
4. Manter sincronização com o contexto atual do agente
5. Preservar formatação markdown da persona

## 🔍 Scope

**In Scope:**
- ✅ Adicionar item "Editar Persona" no menu de opções existente
- ✅ Criar modal de edição com editor de texto/markdown
- ✅ Implementar salvamento local da persona editada
- ✅ Atualizar exibição da persona no modal de contexto
- ✅ Manter formatação markdown e quebras de linha
- ✅ Validação básica de entrada (não vazia)
- ✅ Feedback visual de salvamento bem-sucedido
- ✅ Preservar persona original como backup

**Out of Scope:**
- ❌ Modificações no backend (conductor-gateway)
- ❌ Persistência permanente no banco de dados
- ❌ Sincronização entre múltiplas instâncias
- ❌ Histórico de versões da persona
- ❌ Colaboração em tempo real
- ❌ Validação complexa de sintaxe markdown

## 💡 Proposed Solution

**Abordagem:**
Implementar edição de persona como funcionalidade frontend-only, utilizando armazenamento local e atualização em tempo real da interface.

**Componentes Principais:**
1. **Menu de Opções Expandido**: Adicionar "✏️ Editar Persona" ao menu existente
2. **Modal de Edição**: Interface dedicada para edição de texto/markdown
3. **Editor de Texto**: Textarea com suporte a markdown básico
4. **Gerenciamento de Estado**: Armazenamento local e atualização em tempo real

**Fluxo de Funcionamento:**
1. Usuário clica na engrenagem (⚙️) → Menu de opções
2. Seleciona "Editar Persona" → Abre modal de edição
3. Edita texto no editor → Preview em tempo real
4. Clica "Salvar" → Atualiza contexto local e fecha modal
5. Persona editada é exibida no modal de contexto (📋)

## 📦 Deliverables

**Artefatos Principais:**
1. **Modal de Edição de Persona** (`persona-edit-modal`)
   - Editor de texto com suporte a markdown
   - Botões de ação (Salvar, Cancelar)
   - Preview da formatação

2. **Serviço de Gerenciamento** (`persona-edit.service`)
   - Armazenamento local da persona editada
   - Métodos de salvamento e carregamento
   - Validação básica

3. **Atualizações no Componente Chat**
   - Item de menu "Editar Persona"
   - Integração com modal de edição
   - Atualização da exibição da persona

4. **Estilos CSS**
   - Design consistente com tema existente
   - Responsividade para diferentes tamanhos
   - Animações suaves

**Arquivos Modificados:**
- `src/app/shared/conductor-chat/conductor-chat.component.ts`
- `src/app/shared/conductor-chat/conductor-chat.component.html` (template)
- `src/app/services/persona-edit.service.ts` (novo)
- `src/app/shared/persona-edit-modal/persona-edit-modal.component.ts` (novo)

## ⚠️ Risks & Constraints

**Riscos Identificados:**
1. **Perda de Dados**: Persona editada pode ser perdida ao recarregar página
   - *Mitigação*: Implementar armazenamento local persistente

2. **Conflito de Estado**: Persona editada pode conflitar com dados do backend
   - *Mitigação*: Manter estado local separado, priorizar edições locais

3. **Performance**: Editor pode ser lento para personas muito grandes
   - *Mitigação*: Implementar debounce e limitação de tamanho

4. **UX Confusa**: Usuários podem não entender que é edição local
   - *Mitigação*: Indicadores visuais claros e tooltips explicativos

**Constraints Técnicos:**
- Não modificar APIs do backend
- Manter compatibilidade com estrutura existente
- Preservar formatação markdown
- Limitar tamanho da persona (máximo 10KB)

## 🗓️ Phasing Considerations

**Fase 1: Estrutura Base**
- Criar serviço de gerenciamento de persona
- Adicionar item de menu "Editar Persona"
- Implementar modal básico de edição

**Fase 2: Funcionalidade Completa**
- Editor de texto com suporte a markdown
- Validação e feedback visual
- Integração com exibição da persona

**Fase 3: Polimento**
- Estilos e animações
- Testes de usabilidade
- Documentação

## ✅ Success Criteria

**Critérios de Sucesso:**
1. ✅ Usuário pode acessar edição de persona via menu de opções
2. ✅ Modal de edição abre com persona atual carregada
3. ✅ Editor permite modificação de texto com formatação
4. ✅ Salvamento atualiza exibição em tempo real
5. ✅ Persona editada persiste durante a sessão
6. ✅ Interface é intuitiva e responsiva
7. ✅ Não há impacto no backend existente

**Métricas de Qualidade:**
- Tempo de abertura do modal < 200ms
- Salvamento < 100ms
- Suporte a personas até 10KB
- 100% de compatibilidade com markdown básico

## 🔗 Dependencies

**Dependências Internas:**
- `ConductorChatComponent` (componente base)
- `AgentService` (carregamento de contexto)
- Sistema de modais existente

**Dependências Externas:**
- Nenhuma (funcionalidade frontend-only)

**Dependências de Design:**
- Tema de cores existente
- Padrões de modal do sistema
- Tipografia e espaçamento consistentes

## 📚 References

**Documentação Relacionada:**
- `src/app/shared/conductor-chat/conductor-chat.component.ts` - Componente base
- `src/app/services/agent.service.ts` - Serviço de agentes
- `docs/sagas/CHANGELOG.md` - Histórico de mudanças

**APIs Utilizadas:**
- `getAgentContext(instanceId)` - Carregamento da persona
- `updateInstance(instanceId, updates)` - Atualização local (não utilizada)

**Padrões de UI:**
- Modal de contexto existente (📋)
- Menu de opções do agente (⚙️)
- Estilos de botões e inputs do sistema