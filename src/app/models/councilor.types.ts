/**
 * Sistema de Conselheiros - Tipos e Interfaces
 *
 * Conselheiros são agentes promovidos que executam tarefas automáticas periódicas
 * para monitorar a qualidade do projeto (similar aos advisors do SimCity)
 */

/**
 * Tipo de agendamento para tarefas de conselheiros
 */
export type ScheduleType = 'interval' | 'cron';

/**
 * Configuração de agendamento da tarefa do conselheiro
 */
export interface CouncilorSchedule {
  /** Tipo de agendamento: interval (ex: "30m") ou cron (ex: "0 9 * * 1") */
  type: ScheduleType;

  /** Valor do agendamento: "30m", "1h", "2h" para interval | expressão cron para cron */
  value: string;

  /** Se a tarefa está ativa ou pausada */
  enabled: boolean;
}

/**
 * Formato de saída esperado da tarefa
 */
export type TaskOutputFormat = 'summary' | 'detailed' | 'checklist';

/**
 * Definição da tarefa que o conselheiro executará
 */
export interface CouncilorTask {
  /** Nome descritivo da tarefa */
  name: string;

  /** Template do prompt que será executado */
  prompt: string;

  /** Arquivos opcionais para incluir no contexto da execução */
  context_files?: string[];

  /** Formato esperado de saída */
  output_format?: TaskOutputFormat;
}

/**
 * Canais de notificação disponíveis
 */
export type NotificationChannel = 'panel' | 'toast' | 'email';

/**
 * Configuração de notificações do conselheiro
 */
export interface CouncilorNotifications {
  /** Notificar quando tarefa completar com sucesso */
  on_success: boolean;

  /** Notificar quando tarefa completar com alertas/warnings */
  on_warning: boolean;

  /** Notificar quando tarefa falhar ou encontrar erros */
  on_error: boolean;

  /** Canais onde as notificações serão enviadas */
  channels: NotificationChannel[];
}

/**
 * Configuração completa do conselheiro
 */
export interface CouncilorConfig {
  /** Título/cargo do conselheiro (ex: "Conselheiro de Qualidade") */
  title: string;

  /** Agendamento da tarefa */
  schedule: CouncilorSchedule;

  /** Definição da tarefa a ser executada */
  task: CouncilorTask;

  /** Configuração de notificações */
  notifications: CouncilorNotifications;
}

/**
 * Interface estendida do Agent para incluir funcionalidades de conselheiro
 * Estende o Agent do backend com campos adicionais
 */
export interface AgentWithCouncilor {
  /** ID MongoDB do agente */
  _id?: string;

  /** ID do agente (ex: "code_generator_agent") */
  agent_id: string;

  /** Nome do agente */
  name: string;

  /** Título/descrição do agente */
  title?: string;

  /** Emoji representativo */
  emoji: string;

  /** Descrição do agente */
  description?: string;

  /** Prompt padrão do agente */
  prompt?: string;

  /** Modelo de IA usado */
  model?: string;

  /** Se o agente foi promovido a conselheiro */
  is_councilor: boolean;

  /** Configuração do conselheiro (presente apenas se is_councilor = true) */
  councilor_config?: CouncilorConfig;

  /** Personalização do agente (nome customizado, role, emoji) */
  customization?: {
    enabled: boolean;
    display_name?: string;  // "Silva"
    avatar_url?: string;    // URL de avatar customizado
    color?: string;         // Cor personalizada
  };

  /** Estatísticas de execução */
  stats?: {
    total_executions: number;
    last_execution: Date;
    success_rate: number;
  };
}

/**
 * Resultado da execução de uma tarefa de conselheiro
 */
export interface CouncilorExecutionResult {
  /** ID da execução */
  execution_id: string;

  /** ID do conselheiro */
  councilor_id: string;

  /** Timestamp de início */
  started_at: Date;

  /** Timestamp de conclusão */
  completed_at?: Date;

  /** Status da execução */
  status: 'running' | 'completed' | 'error';

  /** Severidade do resultado (determinada pela análise do output) */
  severity: 'success' | 'warning' | 'error';

  /** Saída/resultado da execução */
  output?: string;

  /** Mensagem de erro (se houver) */
  error?: string;

  /** Duração em millisegundos */
  duration_ms?: number;
}

/**
 * Relatório histórico de execuções de um conselheiro
 */
export interface CouncilorReport {
  /** ID do conselheiro */
  councilor_id: string;

  /** Nome do conselheiro */
  councilor_name: string;

  /** Últimas execuções (máximo 10) */
  recent_executions: CouncilorExecutionResult[];

  /** Total de execuções realizadas */
  total_executions: number;

  /** Taxa de sucesso (0-100) */
  success_rate: number;

  /** Próxima execução agendada */
  next_execution?: Date;
}

/**
 * Payload para promover um agente a conselheiro
 */
export interface PromoteToCouncilorRequest {
  /** Configuração do conselheiro */
  councilor_config: CouncilorConfig;

  /** Personalização opcional */
  customization?: {
    display_name?: string;
    avatar_url?: string;
    color?: string;
  };
}

// ========== Instance-Based Councilor Types (NEW) ==========

/**
 * Councilor Instance stored in agent_instances collection.
 * Unlike legacy councilors (stored in agents), instances have:
 * - Dedicated screenplay_id for execution context
 * - Dedicated conversation_id for history
 * - Full audit trail
 */
export interface CouncilorInstance {
  /** Unique instance ID (e.g., "councilor_quality_agent_1732900000") */
  instance_id: string;

  /** Agent template ID */
  agent_id: string;

  /** Screenplay ID for execution context - REQUIRED */
  screenplay_id: string;

  /** Conversation ID for history - REQUIRED */
  conversation_id: string;

  /** Flag to identify this as a councilor instance */
  is_councilor_instance: true;

  /** Councilor configuration */
  councilor_config: CouncilorConfig;

  /** Visual customization */
  customization?: {
    enabled?: boolean;
    display_name?: string;
    avatar_url?: string;
    color?: string;
  };

  /** Execution statistics */
  stats?: {
    total_executions: number;
    last_execution?: Date | string;
    success_rate: number;
  };

  /** Current status */
  status?: 'idle' | 'running' | 'paused';

  /** Timestamps */
  created_at?: string;
  updated_at?: string;

  // Agent template data (from join with agents collection)
  agent_name?: string;
  agent_emoji?: string;
  agent_description?: string;
}

/**
 * Response from POST /api/councilors/promote
 */
export interface PromoteToCouncilorInstanceResponse {
  success: boolean;
  message: string;
  instance_id?: string;
  screenplay_id?: string;
  conversation_id?: string;
}

/**
 * Response from GET /api/councilors/instances
 */
export interface CouncilorInstanceListResponse {
  instances: CouncilorInstance[];
  count: number;
}

/**
 * Request payload for POST /api/councilors/promote
 */
export interface PromoteToCouncilorInstanceRequest {
  agent_id: string;
  councilor_config: CouncilorConfig;
  customization?: {
    display_name?: string;
    avatar_url?: string;
    color?: string;
  };
  /** Working directory for agent execution (project path) */
  cwd?: string;
}


/**
 * Presets de agentes investigadores disponíveis
 */
export interface InvestigatorPreset {
  /** ID único do preset */
  id: string;

  /** Nome do investigador */
  name: string;

  /** Emoji */
  emoji: string;

  /** Descrição do que o investigador faz */
  description: string;

  /** Template base do prompt */
  prompt_template: string;
}

/**
 * Presets padrão de investigadores
 */
export const INVESTIGATOR_PRESETS: InvestigatorPreset[] = [
  {
    id: 'code-quality-analyst',
    name: 'Analista de Qualidade de Código',
    emoji: '🔍',
    description: 'Analisa complexidade, code smells e padrões de código',
    prompt_template: `Você é um Analista de Qualidade de Código especializado.

Contexto do evento: {{event_context}}

Analise o código relacionado e identifique:
- Complexidade ciclomática elevada
- Code smells (duplicação, long methods, etc)
- Violações de princípios SOLID
- Oportunidades de refatoração

{{additional_context}}

Retorne um relatório estruturado com prioridades (alta/média/baixa).`
  },
  {
    id: 'performance-investigator',
    name: 'Investigador de Performance',
    emoji: '⚡',
    description: 'Analisa latência, bottlenecks e otimizações',
    prompt_template: `Você é um Investigador de Performance especializado.

Contexto do evento: {{event_context}}

Investigue problemas de performance:
- Análise de latência e tempo de resposta
- Identificação de bottlenecks
- Queries N+1 e problemas de database
- Uso excessivo de memória ou CPU

{{additional_context}}

Retorne sugestões de otimização priorizadas.`
  },
  {
    id: 'security-auditor',
    name: 'Auditor de Segurança',
    emoji: '🔒',
    description: 'Analisa vulnerabilidades e riscos de segurança',
    prompt_template: `Você é um Auditor de Segurança especializado.

Contexto do evento: {{event_context}}

Realize uma auditoria de segurança:
- Vulnerabilidades conhecidas (CVEs)
- Práticas inseguras no código
- Exposição de dados sensíveis
- Configurações de segurança inadequadas

{{additional_context}}

Retorne relatório com severidade (crítica/alta/média/baixa).`
  },
  {
    id: 'architecture-reviewer',
    name: 'Revisor de Arquitetura',
    emoji: '🏗️',
    description: 'Analisa acoplamento, coesão e design patterns',
    prompt_template: `Você é um Revisor de Arquitetura especializado.

Contexto do evento: {{event_context}}

Analise a arquitetura do código:
- Acoplamento entre módulos
- Coesão dentro de componentes
- Uso adequado de design patterns
- Separação de responsabilidades

{{additional_context}}

Retorne sugestões de melhoria arquitetural.`
  }
];

/**
 * Exemplos de tarefas pré-configuradas para conselheiros
 */
export const COUNCILOR_TASK_TEMPLATES = {
  CHECK_MONOLITHIC_FILES: {
    name: 'Verificar Arquivos Monolíticos',
    prompt: `Analise todos os arquivos .ts do projeto.
Identifique arquivos com mais de 500 linhas.

Para cada arquivo grande, retorne:
- Nome do arquivo e número de linhas
- Responsabilidades identificadas
- Sugestão de modularização
- Prioridade (alta/média/baixa)

Formato: Lista ordenada por prioridade.`,
    output_format: 'checklist' as TaskOutputFormat
  },

  CHECK_TEST_COVERAGE: {
    name: 'Verificar Cobertura de Testes',
    prompt: `Execute análise de cobertura de testes.

Identifique:
- Arquivos sem testes (0% cobertura)
- Arquivos com cobertura < 50%
- Funções críticas sem teste
- Arquivos mais usados sem cobertura adequada

Priorize por impacto (arquivos mais usados primeiro).
Retorne lista com ações sugeridas.`,
    output_format: 'checklist' as TaskOutputFormat
  },

  CHECK_DEPENDENCIES: {
    name: 'Verificar Dependências Vulneráveis',
    prompt: `Execute npm audit ou análise de dependências.

Liste vulnerabilidades encontradas:
- Severidade (crítica/alta/média/baixa)
- Pacote afetado
- Versão atual vs recomendada
- CVE se disponível

Priorize vulnerabilidades críticas e de alta severidade.`,
    output_format: 'detailed' as TaskOutputFormat
  },

  CHECK_INLINE_CSS: {
    name: 'Verificar CSS Inline',
    prompt: `Busque por CSS inline em arquivos .html e .ts:
- style="" em templates HTML
- Propriedades style no TypeScript
- Estilos hardcoded em componentes

Para cada ocorrência:
- Arquivo e linha
- Código encontrado
- Sugestão de classe CSS alternativa

Retorne lista priorizada por impacto visual.`,
    output_format: 'checklist' as TaskOutputFormat
  },

  CHECK_PERFORMANCE: {
    name: 'Verificar Performance de APIs',
    prompt: `Analise métricas de performance das APIs:
- Endpoints com P95 > 1000ms
- Endpoints com taxa de erro > 1%
- Queries lentas no banco de dados
- Uso excessivo de recursos

Para cada problema:
- Endpoint afetado
- Métrica atual
- Possível causa
- Sugestão de otimização

Retorne lista ordenada por impacto.`,
    output_format: 'detailed' as TaskOutputFormat
  }
};
