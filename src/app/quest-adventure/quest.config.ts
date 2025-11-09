// Configuração central do Conductor Quest

export const QUEST_CONFIG = {
  // Desenvolvimento
  DEBUG_MODE: false, // Ativar em desenvolvimento
  SKIP_INTRO: false, // Pular introdução
  SHOW_FPS: false, // Mostrar FPS counter
  SHOW_COLLISION_BOXES: false, // Mostrar caixas de colisão

  // Features
  USE_REAL_AGENTS: false, // Usar agentes reais do Conductor
  ENABLE_SOUND: true, // Habilitar sons
  ENABLE_PARTICLES: true, // Habilitar partículas
  ENABLE_AUTO_SAVE: true, // Salvar automaticamente
  ENABLE_ANIMATIONS: true, // Animações visuais

  // Gameplay
  PLAYER_MOVE_SPEED: 200, // pixels por segundo
  DIALOGUE_TYPE_SPEED: 50, // ms por caractere
  AUTO_SAVE_INTERVAL: 30000, // 30 segundos
  INTERACTION_RANGE: 50, // pixels de distância para interagir

  // XP e Níveis
  XP_PER_LEVEL: [
    0,     // Level 1
    100,   // Level 2
    300,   // Level 3
    600,   // Level 4
    1000,  // Level 5
    1500,  // Level 6
    2500,  // Level 7
    4000,  // Level 8
  ],

  // Canvas
  CANVAS_WIDTH: 1024,
  CANVAS_HEIGHT: 768,
  MOBILE_CANVAS_SCALE: 1.0,
  TABLET_CANVAS_SCALE: 1.0,

  // NPCs
  NPC_INTERACTION_RANGE: 50, // pixels
  NPC_INDICATOR_SIZE: 20, // tamanho do indicador "!"
  NPC_INDICATOR_HEIGHT: 40, // altura acima do NPC

  // Assets paths
  ASSETS_BASE: '/assets/quest/',
  SPRITES_PATH: '/assets/quest/sprites/',
  SOUNDS_PATH: '/assets/quest/sounds/',
  MUSIC_PATH: '/assets/quest/music/',
  DATA_PATH: './data/',

  // Cores do tema
  COLORS: {
    PRIMARY: '#FFD700',     // Dourado (sucesso, importante)
    SECONDARY: '#4A90E2',   // Azul (informação)
    TERTIARY: '#7B68EE',    // Roxo (mágico)
    SUCCESS: '#4CAF50',     // Verde (completo)
    WARNING: '#FF9800',     // Laranja (atenção)
    ERROR: '#F44336',       // Vermelho (erro)
    NEUTRAL: '#F5F5F5',     // Backgrounds
    DARK: '#2C3E50',        // Textos escuros
    LIGHT: '#FFFFFF'        // Textos claros
  },

  // LocalStorage keys
  STORAGE_KEYS: {
    SAVE_STATE: 'quest_save_v1',
    SETTINGS: 'quest_settings',
    ACHIEVEMENTS: 'quest_achievements',
    STATISTICS: 'quest_stats'
  },

  // Animações
  ANIMATIONS: {
    FADE_DURATION: 300,
    SLIDE_DURATION: 300,
    MESSAGE_DELAY: 300,
    TYPING_SPEED: 50,
    PARTICLE_COUNT: 20,
    PARTICLE_LIFETIME: 2000
  },

  // Mensagens do sistema
  MESSAGES: {
    WELCOME: 'Bem-vindo ao Conductor Quest!',
    LOADING: 'Preparando o Salão da Guilda...',
    SAVING: 'Salvando progresso...',
    SAVED: 'Progresso salvo!',
    ERROR: 'Ops! Algo deu errado.',
    LEVEL_UP: 'Parabéns! Você subiu de nível!',
    QUEST_COMPLETE: 'Missão Completa!',
    ACHIEVEMENT_UNLOCKED: 'Conquista Desbloqueada!'
  },

  // URLs da API (quando usar agentes reais)
  API: {
    BASE_URL: '/api',
    AGENTS_ENDPOINT: '/agents',
    CHAT_ENDPOINT: '/chat',
    SAVE_ENDPOINT: '/save'
  }
};

// Função helper para obter configuração
export function getQuestConfig(key: string): any {
  const keys = key.split('.');
  let value: any = QUEST_CONFIG;

  for (const k of keys) {
    value = value[k];
    if (value === undefined) {
      console.warn(`Config key not found: ${key}`);
      return null;
    }
  }

  return value;
}

// Função para verificar se está em modo debug
export function isDebugMode(): boolean {
  return QUEST_CONFIG.DEBUG_MODE || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
}

// Função para verificar se é mobile
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || 'ontouchstart' in window;
}

// Função para verificar se é tablet
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= 768 && width < 1024;
}

// Configuração de dificuldade (para futuras expansões)
export enum Difficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard'
}

export const DIFFICULTY_SETTINGS = {
  [Difficulty.EASY]: {
    xpMultiplier: 1.5,
    hintsEnabled: true,
    skipEnabled: true
  },
  [Difficulty.NORMAL]: {
    xpMultiplier: 1.0,
    hintsEnabled: true,
    skipEnabled: false
  },
  [Difficulty.HARD]: {
    xpMultiplier: 0.8,
    hintsEnabled: false,
    skipEnabled: false
  }
};