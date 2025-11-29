# Councilor System

Sistema de Conselheiros do Conductor.

---

## Objetivo

Os Conselheiros sao agentes do catalogo que recebem uma marcacao especial (`is_councilor: true`) para executar tarefas automaticas periodicas. Similar aos advisors do SimCity, eles vigiam aspectos especificos do codigo e reportam problemas ou oportunidades de melhoria.

---

## Conceito-Chave: Promocao vs Instanciacao

O sistema de Conselheiros **NAO cria instancias** de agentes. Ele **marca** um agente existente do catalogo como conselheiro.

**Duas Collections Diferentes**

| Collection | Descricao | Usado por Conselheiros? |
|------------|-----------|-------------------------|
| `agents` | Catalogo de agentes disponiveis | **SIM** - Conselheiro e uma flag aqui |
| `agent_instances` | Instancias de agentes em conversas | **NAO** - Nao usado |

**Fluxo de Promocao**

```
Catalogo de Agentes (collection: agents)
         |
         | Usuario seleciona agente
         v
   Modal de Promocao
         |
         | POST /api/councilors/{agent_id}/promote-councilor
         v
   Mesmo documento atualizado:
   - is_councilor: true
   - councilor_config: {...}
```

**O que NAO acontece:**
- Nao cria documento em `agent_instances`
- Nao duplica o agente
- Nao cria nova entidade

**O que acontece:**
- Adiciona campos `is_councilor` e `councilor_config` ao documento existente na collection `agents`

---

## O que os Conselheiros fazem

1. **Monitoram o projeto** em intervalos configurados (minutos, horas, dias)
2. **Executam analises automaticas** baseadas em prompts pre-definidos
3. **Classificam resultados** por severidade (sucesso, alerta, erro)
4. **Notificam a equipe** via painel de eventos, toast ou email
5. **Geram relatorios** com historico de execucoes e metricas

---

## Dados do Conselheiro

Para cada conselheiro, o sistema adiciona ao documento do agente:

**Configuracao (councilor_config)**
- Titulo/Cargo do conselheiro
- Tarefa automatica (nome, prompt, arquivos de contexto)
- Periodicidade (interval ou cron)
- Preferencias de notificacao

**Personalizacao (customization)**
- Nome de exibicao (ex: "Silva", "Maria")
- Avatar customizado
- Cor personalizada

**Estatisticas (stats)**
- Total de execucoes
- Taxa de sucesso
- Ultima execucao

---

## Arquitetura do Sistema

O sistema opera em duas camadas:

**Frontend (conductor-web)**

| Componente | Arquivo | Funcao |
|------------|---------|--------|
| Botao | `screenplay-interactive.html:109` | Abre dashboard |
| Dashboard | `councilors-dashboard/` | Lista conselheiros ativos |
| Modal Promocao | `promote-councilor-modal/` | Configura novo conselheiro |
| Scheduler Service | `services/councilor-scheduler.service.ts` | Gerencia tarefas no frontend |
| Tipos | `models/councilor.types.ts` | Interfaces e templates |

**Backend (conductor-gateway)**

| Componente | Arquivo | Funcao |
|------------|---------|--------|
| API Router | `api/routers/councilor.py` | Endpoints REST |
| Service | `services/councilor_service.py` | Logica de negocio |
| Scheduler | `services/councilor_scheduler.py` | APScheduler para execucoes |

---

## Fluxo de Trabalho

**Entrada**: Agente do catalogo + configuracao de conselheiro

**Processamento**:

```
1. Usuario clica no botao Conselheiros (icone predios)
   |
2. CouncilorsDashboardComponent abre
   |
3. Se nao ha conselheiros → exibe "Promover Primeiro Conselheiro"
   |
4. Usuario clica → openAgentSelectorForPromotion()
   |
   +-- isSelectingAgentForPromotion = true
   +-- showAgentSelector = true
   |
5. AgentSelectorModal carrega agentes do catalogo
   |
   GET /api/agents → Lista collection "agents"
   |
6. Usuario seleciona agente → selectAgent(agent)
   |
   emite AgentSelectionData { agent, instanceId, cwd }
   |
7. onAgentSelected() verifica isSelectingAgentForPromotion
   |
   SE true → openPromoteCouncilorModal(agent)
   SE false → cria AgentInstance (fluxo normal de conversa)
   |
8. Usuario preenche formulario de configuracao
   |
9. onSubmit() → promote.emit(request)
   |
10. handlePromoteCouncilor(request)
    |
    POST /api/councilors/{agent.id}/promote-councilor
    |
11. Backend: CouncilorService.promote_to_councilor()
    |
    - Valida que agente existe
    - Valida que NAO e conselheiro ainda
    - Atualiza documento: is_councilor=true, councilor_config={...}
    |
12. Backend: CouncilorBackendScheduler.schedule_councilor()
    |
    - Agenda tarefa no APScheduler
    |
13. Frontend: councilorScheduler.initialize()
    |
    - Recarrega lista de conselheiros
```

**Saida**: Agente marcado como conselheiro + tarefa agendada

---

## Mapeamento de IDs

**IMPORTANTE**: O campo `id` do frontend mapeia para `agent_id` do banco.

```typescript
// agent.service.ts:100
id: agent.agent_id || agent.name  // Mapeia agent_id → id
```

| Contexto | Campo Usado | Valor Real |
|----------|-------------|------------|
| AgentSelectorModal | `agent.id` | agent_id do MongoDB |
| handlePromoteCouncilor | `agent.id` | agent_id do MongoDB |
| MongoDB | `agent_id` | Identificador unico |
| Dashboard | `councilor.agent_id` | agent_id do MongoDB |

---

## Endpoints da API

| Metodo | Endpoint | Funcao |
|--------|----------|--------|
| GET | `/api/councilors` | Lista agentes (filtro `is_councilor=true`) |
| POST | `/api/councilors/{agent_id}/promote-councilor` | Marca agente como conselheiro |
| DELETE | `/api/councilors/{agent_id}/demote-councilor` | Remove marcacao de conselheiro |
| PATCH | `/api/councilors/{agent_id}/councilor-config` | Atualiza configuracao |
| PATCH | `/api/councilors/{agent_id}/councilor-schedule` | Pausa/retoma agendamento |
| GET | `/api/councilors/{agent_id}/councilor-reports` | Relatorio de execucoes |
| GET | `/api/councilors/scheduler/jobs` | Debug de jobs agendados |

---

## Regras de Negocio

**Promocao**
- Apenas agentes existentes no catalogo podem ser promovidos
- Um agente so pode ser conselheiro uma vez (is_councilor ja true = erro 409)
- Configuracao de tarefa e obrigatoria
- Agendamento deve ter formato valido (ex: "30m", "1h", "0 9 * * 1")

**Execucao**
- Lock previne execucoes simultaneas do mesmo conselheiro
- Resultados sao analisados por palavras-chave de severidade
- Execucoes sao salvas na collection `tasks` (flag `is_councilor_execution: true`)
- Estatisticas sao atualizadas no documento do agente apos cada execucao

**Democao**
- Remove campos `councilor_config` do documento
- Define `is_councilor: false`
- Remove job do APScheduler

---

## Estrutura de Dados (MongoDB)

**Collection: agents (agente promovido a conselheiro)**

```javascript
{
  _id: ObjectId("..."),
  agent_id: "code_quality_agent",        // Identificador unico
  name: "Code Quality Agent",
  emoji: "🔍",
  description: "Analisa qualidade do codigo",
  prompt: "Voce e um analista de qualidade...",
  model: "gpt-4",

  // === CAMPOS ADICIONADOS NA PROMOCAO ===
  is_councilor: true,
  councilor_config: {
    title: "Conselheiro de Qualidade",
    schedule: {
      type: "interval",           // "interval" ou "cron"
      value: "30m",               // "30m", "1h", "0 9 * * 1"
      enabled: true
    },
    task: {
      name: "Verificar Arquivos Monoliticos",
      prompt: "Analise todos os arquivos .ts...",
      context_files: ["docs/guidelines.md"],
      output_format: "checklist"  // "summary", "detailed", "checklist"
    },
    notifications: {
      on_success: false,
      on_warning: true,
      on_error: true,
      channels: ["panel", "toast"]  // "panel", "toast", "email"
    }
  },
  customization: {
    enabled: true,
    display_name: "Silva"
  },
  stats: {
    total_executions: 42,
    last_execution: ISODate("2025-11-29T10:30:00Z"),
    success_rate: 85.7
  },

  updated_at: ISODate("2025-11-29T10:00:00Z")
}
```

**Collection: tasks (execucoes dos conselheiros)**

```javascript
{
  _id: ObjectId("..."),
  task_id: "exec_code_quality_agent_1732875000000",
  agent_id: "code_quality_agent",
  instance_id: "councilor_code_quality_agent_1732875000000",

  // === FLAG QUE IDENTIFICA EXECUCAO DE CONSELHEIRO ===
  is_councilor_execution: true,

  councilor_config: {
    task_name: "Verificar Arquivos Monoliticos",
    display_name: "Silva"
  },
  prompt: "Analise todos os arquivos .ts...",
  status: "completed",           // "running", "completed", "error"
  severity: "warning",           // "success", "warning", "error"
  result: "Encontrados 3 arquivos com mais de 500 linhas...",
  error: null,
  created_at: ISODate("2025-11-29T10:30:00Z"),
  completed_at: ISODate("2025-11-29T10:30:45Z"),
  duration: 45.2
}
```

---

## Templates de Tarefas Pre-configurados

Definidos em `models/councilor.types.ts`:

| Template | Descricao |
|----------|-----------|
| CHECK_MONOLITHIC_FILES | Identifica arquivos com mais de 500 linhas |
| CHECK_TEST_COVERAGE | Analisa cobertura de testes do projeto |
| CHECK_DEPENDENCIES | Verifica vulnerabilidades em dependencias |
| CHECK_INLINE_CSS | Busca CSS inline em templates |
| CHECK_PERFORMANCE | Analisa metricas de performance de APIs |

Os templates podem ser customizados ou novos prompts criados do zero.

---

## Eventos WebSocket

O scheduler backend emite eventos em tempo real:

| Evento | Payload | Quando |
|--------|---------|--------|
| `councilor_started` | councilor_id, task_name, started_at | Inicio da execucao |
| `councilor_completed` | councilor_id, severity, duration_ms | Fim com sucesso |
| `councilor_error` | councilor_id, error, started_at | Fim com erro |

---

## Schedulers: Frontend vs Backend

O sistema possui **dois schedulers**:

| Scheduler | Local | Tecnologia | Persistencia |
|-----------|-------|------------|--------------|
| CouncilorSchedulerService | Frontend | setInterval | Nao (perde ao fechar) |
| CouncilorBackendScheduler | Backend | APScheduler | Sim (MongoDB) |

**Fonte de verdade**: Backend

O frontend scheduler e usado para atualizacoes de UI em tempo real. O backend scheduler e responsavel pela execucao real das tarefas, mesmo se o frontend estiver fechado.

---

## Limitacoes

O sistema de Conselheiros nao e capaz de:

- Executar tarefas que exijam interacao humana
- Modificar codigo automaticamente (apenas analisa)
- Garantir execucao exata no horario (depende do scheduler)
- Funcionar offline (requer backend rodando)
- Executar mais de uma tarefa por conselheiro simultaneamente
- Criar instancias de agentes (apenas marca agentes existentes)

---

## Integracao com Ecossistema

**Conductor**
Orquestrador central. Conselheiros usam a API do Conductor para executar analises via `conductor_client.execute_agent()`.

**Agent Catalog**
Collection `agents` no MongoDB. Fonte dos agentes disponiveis para promocao.

**Event Ticker**
Painel de noticias que exibe resultados das execucoes via `GamificationEventsService`.

**WebSocket (gamification_manager)**
Broadcast de eventos em tempo real para atualizar UI sem polling.

---

## Como Usar

**Promover um Conselheiro**

1. Clique no icone 🏛️ na toolbar
2. No dashboard, clique em "Promover Novo Conselheiro"
3. Selecione um agente do catalogo
4. Preencha nome, titulo e tarefa
5. Configure periodicidade e notificacoes
6. Clique em "Promover"

**Pausar um Conselheiro**

1. Abra o Dashboard de Conselheiros
2. Encontre o conselheiro desejado
3. Clique no botao ⏸️

**Ver Relatorio**

1. Abra o Dashboard de Conselheiros
2. Clique no icone 📋 do conselheiro
3. Visualize historico de execucoes

**Remover do Conselho**

1. Abra o Dashboard de Conselheiros
2. Clique em "Remover do Conselho"
3. Confirme a acao

---

## Resumo Tecnico

| Pergunta | Resposta |
|----------|----------|
| Cria instancia ao promover? | **NAO** |
| De onde vem o agente? | Collection `agents` (catalogo) |
| Onde salva a promocao? | Mesmo documento em `agents` |
| Onde salva execucoes? | Collection `tasks` |
| Como identifica execucao de conselheiro? | Flag `is_councilor_execution: true` |

---

*Documento de referencia para contexto do Sistema de Conselheiros*
