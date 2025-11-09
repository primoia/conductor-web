// Posição no canvas
export interface Position {
  x: number;
  y: number;
}

// NPC (Non-Player Character)
export interface NPC {
  id: string;
  name: string;
  emoji: string;
  title: string;
  position: Position;
  unlocked: boolean;
  sprite?: string;
  agentId?: string; // ID do agente real do Conductor
  greeting: string;
  personality: NPCPersonality;
  currentIndicator?: 'none' | 'talk' | 'quest' | 'working';
  dialogueTreeId: string;
  showIndicator?: boolean;
  status?: 'available' | 'unavailable' | 'busy';
}

export interface NPCPersonality {
  trait: 'wise' | 'methodical' | 'energetic' | 'refined';
  greetingStyle: string;
  workingPhrases: string[];
  successPhrase: string;
}

// Sistema de Diálogos
export interface DialogueTree {
  id: string;
  nodes: DialogueNode[];
}

export interface DialogueNode {
  id: string;
  speaker: 'npc' | 'player';
  text: string;
  emotion?: 'neutral' | 'happy' | 'thinking' | 'proud';
  options?: DialogueOption[];
  next?: string;
  action?: DialogueAction;
}

export interface DialogueOption {
  id: string;
  text: string;
  next: string; // ID do próximo nó
  condition?: string; // Condição para aparecer
  xp?: number; // XP ganho ao escolher
  flag?: string; // Flag setada ao escolher
  action?: DialogueAction;
}

export interface DialogueAction {
  type: 'unlock_npc' | 'give_item' | 'complete_objective' | 'start_creation' | 'set_flag' | 'set_target_npc';
  target?: string;
  item?: string;
  objective?: string;
  flag?: string;
  value?: any;
}

// Active Dialogue State
export interface ActiveDialogue {
  npc: NPC;
  message: string;
  options: DialogueOption[];
  isTyping: boolean;
}

// Quest System
export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  currentObjective: number;
  completed: boolean;
  rewards: QuestReward;
}

export interface QuestObjective {
  id: string;
  text: string;
  type: 'talk' | 'create' | 'refine' | 'complete';
  target?: string;
  completed: boolean;
  optional?: boolean;
  current?: boolean;
}

export interface QuestReward {
  xp: number;
  items?: string[];
  unlocks?: string[];
  title?: string;
}

// Player State
export interface PlayerState {
  position: Position;
  level: number;
  xp: number;
  xpToNextLevel: number;
  title: string; // "Iniciado" → "Condutor"
  inventory: InventoryItem[];
  unlockedNPCs: string[];
  completedObjectives: string[];
  dialogueFlags: Record<string, boolean>;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

// Banner Creation (Special Feature)
export interface BannerDesign {
  background: 'gradient-blue' | 'gradient-purple' | 'solid-dark';
  centerpiece: 'star' | 'compass' | 'gear';
  text: string;
  version: number;
}

// Save Game State
export interface SaveGameState {
  version: string;
  timestamp: number;
  playerState: PlayerState;
  questProgress: {
    currentQuestId: string;
    currentObjectiveIndex: number;
    completedQuests: string[];
  };
  npcStates: Record<string, {
    unlocked: boolean;
    interactionCount: number;
    lastDialogueNode?: string;
  }>;
  flags: Record<string, boolean>;
}