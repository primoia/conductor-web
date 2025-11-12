/**
 * Sistema de Inventário para Quest Adventure
 * Modelos e interfaces para gerenciar itens digitais no jogo
 */

/**
 * Item do inventário com propriedades estendidas
 */
export interface InventoryItem {
  id: string;                      // ID único do item
  name: string;                     // Nome exibido
  description: string;              // Descrição detalhada
  icon: string;                     // Emoji ou ícone
  type: ItemType;                   // Tipo do item
  rarity: ItemRarity;              // Raridade (afeta cor e efeitos)
  destroyable: boolean;            // Se pode ser destruído/deletado
  tradeable: boolean;              // Se pode ser dado para NPCs
  stackable: boolean;              // Se pode empilhar
  quantity?: number;               // Quantidade (se stackable)
  metadata?: ItemMetadata;         // Dados adicionais do item
  visualEffect?: ItemVisualEffect; // Efeitos visuais especiais
}

/**
 * Tipos de itens no jogo
 */
export enum ItemType {
  KEY = 'key',           // Chaves de ativação para NPCs
  DOCUMENT = 'document', // Documentos/códigos
  TOOL = 'tool',        // Ferramentas de desenvolvimento
  ARTIFACT = 'artifact', // Artefatos especiais
  QUEST = 'quest',      // Itens de quest
  CONSUMABLE = 'consumable' // Itens consumíveis
}

/**
 * Raridade dos itens (afeta visual)
 */
export enum ItemRarity {
  COMMON = 'common',       // Cinza
  UNCOMMON = 'uncommon',   // Verde
  RARE = 'rare',          // Azul
  EPIC = 'epic',          // Roxo
  LEGENDARY = 'legendary', // Dourado
  MYTHIC = 'mythic'       // Arco-íris/Holográfico
}

/**
 * Metadados específicos do item
 */
export interface ItemMetadata {
  questId?: string;          // ID da quest relacionada
  npcTarget?: string;        // NPC que pode receber este item
  unlocks?: string[];        // O que este item desbloqueia
  code?: string;            // Código/script contido (para documentos)
  createdBy?: string;       // Quem criou o item
  createdAt?: number;       // Timestamp de criação
  uses?: number;            // Número de usos (para consumíveis)
  maxUses?: number;         // Máximo de usos
  requiredItems?: string[]; // Itens necessários para usar este
  isNew?: boolean;          // Se o item foi recém-adicionado ao inventário
}

/**
 * Efeitos visuais do item
 */
export interface ItemVisualEffect {
  glow?: string;           // Cor do brilho (#hex)
  pulse?: boolean;         // Se o item pulsa
  rotation?: boolean;      // Se o item rotaciona
  particles?: ParticleType; // Tipo de partículas
  animation?: string;      // Nome da animação CSS
}

export enum ParticleType {
  SPARKLES = 'sparkles',
  DIGITAL = 'digital',
  MATRIX = 'matrix',
  FIRE = 'fire',
  ELECTRIC = 'electric'
}

/**
 * Transação de item (dar/receber)
 */
export interface ItemTransaction {
  id: string;
  timestamp: number;
  type: 'give' | 'receive' | 'use' | 'destroy';
  itemId: string;
  from?: string; // NPC ou player ID
  to?: string;   // NPC ou player ID
  reason?: string; // Motivo da transação
}

/**
 * Estado do inventário
 */
export interface InventoryState {
  items: InventoryItem[];
  maxSlots: number;
  usedSlots: number;
  transactions: ItemTransaction[];
  lockedSlots: number[]; // Slots que não podem ser usados
}

/**
 * Requisição de item de um NPC
 */
export interface ItemRequest {
  npcId: string;
  requiredItemId: string;
  dialogueOnSuccess: string; // ID do diálogo ao receber item correto
  dialogueOnFailure: string; // ID do diálogo ao receber item errado
  rewardItemId?: string;     // Item dado em troca
  consumeItem: boolean;      // Se o item é consumido na entrega
}

/**
 * Definições dos itens iniciais do jogo
 */
export const INITIAL_ITEMS: Partial<InventoryItem>[] = [
  {
    id: 'primordial_code',
    name: 'Código Primordial',
    description: 'Um arquivo criptografado contendo as chaves de ativação dos Condutores Sintéticos. Este código ancestral não pode ser destruído.',
    icon: '💾',
    type: ItemType.KEY,
    rarity: ItemRarity.MYTHIC,
    destroyable: false,
    tradeable: true,
    stackable: false,
    metadata: {
      npcTarget: 'librarian',
      unlocks: ['activation_key_alpha'],
      questId: 'main_quest_activation'
    },
    visualEffect: {
      glow: '#FFD700',
      pulse: true,
      particles: ParticleType.DIGITAL
    }
  },
  {
    id: 'activation_key_alpha',
    name: 'Chave de Ativação Alpha',
    description: 'Chave de boot para reativar o Escriba. Contém sequências de inicialização do sistema de planejamento.',
    icon: '🔑',
    type: ItemType.KEY,
    rarity: ItemRarity.EPIC,
    destroyable: false,
    tradeable: true,
    stackable: false,
    metadata: {
      npcTarget: 'requirements_scribe',
      unlocks: ['execution_core_beta']
    },
    visualEffect: {
      glow: '#00FF00',
      pulse: false,
      rotation: true
    }
  },
  {
    id: 'execution_core_beta',
    name: 'Núcleo de Execução Beta',
    description: 'Núcleo de processamento necessário para tirar a Artesã do modo de segurança.',
    icon: '⚙️',
    type: ItemType.ARTIFACT,
    rarity: ItemRarity.EPIC,
    destroyable: false,
    tradeable: true,
    stackable: false,
    metadata: {
      npcTarget: 'artisan',
      unlocks: ['optimization_module_gamma']
    },
    visualEffect: {
      glow: '#FF0000',
      rotation: true,
      particles: ParticleType.ELECTRIC
    }
  },
  {
    id: 'optimization_module_gamma',
    name: 'Módulo de Otimização Gamma',
    description: 'Módulo avançado para recalibrar o processador analítico da Crítica.',
    icon: '🔧',
    type: ItemType.TOOL,
    rarity: ItemRarity.RARE,
    destroyable: false,
    tradeable: true,
    stackable: false,
    metadata: {
      npcTarget: 'critic',
      unlocks: ['synchronization_protocol_omega']
    },
    visualEffect: {
      glow: '#9400D3',
      pulse: true
    }
  },
  {
    id: 'synchronization_protocol_omega',
    name: 'Protocolo de Sincronização Omega',
    description: 'O protocolo final para estabelecer conexão neural entre todos os Condutores.',
    icon: '🎼',
    type: ItemType.ARTIFACT,
    rarity: ItemRarity.LEGENDARY,
    destroyable: false,
    tradeable: true,
    stackable: false,
    metadata: {
      npcTarget: 'elder_guide',
      unlocks: ['collective_consciousness'],
      questId: 'main_quest_synchronization'
    },
    visualEffect: {
      glow: '#FFD700',
      pulse: true,
      particles: ParticleType.SPARKLES,
      animation: 'float'
    }
  }
];

/**
 * Mapeamento de raridade para cores
 */
export const RARITY_COLORS: Record<ItemRarity, string> = {
  [ItemRarity.COMMON]: '#808080',
  [ItemRarity.UNCOMMON]: '#00FF00',
  [ItemRarity.RARE]: '#0080FF',
  [ItemRarity.EPIC]: '#9400D3',
  [ItemRarity.LEGENDARY]: '#FFD700',
  [ItemRarity.MYTHIC]: 'linear-gradient(45deg, #FF0000, #FF7F00, #FFFF00, #00FF00, #0000FF, #4B0082, #9400D3)'
};

/**
 * Configurações do inventário
 */
export const INVENTORY_CONFIG = {
  initialMaxSlots: 20,
  slotsPerRow: 5,
  maxStackSize: 99,
  animationDuration: 300, // ms
  dragDropEnabled: true,
  autoSort: true
};