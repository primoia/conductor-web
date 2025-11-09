import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { PlayerState, Quest, QuestObjective, SaveGameState } from '../models/quest.models';

@Injectable({
  providedIn: 'root'
})
export class QuestStateService {
  private readonly SAVE_KEY = 'conductor_quest_save';
  private readonly VERSION = '1.0.0';

  // Estado do Player
  private playerState: PlayerState = {
    position: { x: 512, y: 400 },
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    title: 'Iniciado',
    inventory: [],
    unlockedNPCs: ['elder_guide'],
    completedObjectives: [],
    dialogueFlags: {}
  };

  // Quest Principal
  private mainQuest: Quest = {
    id: 'guild_banner',
    title: 'O Estandarte da Guilda',
    description: 'Orquestre a equipe para criar um estandarte de boas-vindas para a guilda.',
    objectives: [
      {
        id: 'talk_to_guide',
        text: 'Fale com o Guia',
        type: 'talk',
        target: 'elder_guide',
        completed: false
      },
      {
        id: 'talk_to_scribe',
        text: 'Peça ao Escriba para criar o plano',
        type: 'talk',
        target: 'requirements_scribe',
        completed: false
      },
      {
        id: 'get_plan',
        text: 'Obtenha o plano do estandarte',
        type: 'create',
        completed: false
      },
      {
        id: 'talk_to_artisan',
        text: 'Leve o plano à Artesã',
        type: 'talk',
        target: 'artisan',
        completed: false
      },
      {
        id: 'banner_created',
        text: 'Veja a criação do estandarte',
        type: 'create',
        completed: false
      },
      {
        id: 'talk_to_critic',
        text: 'Mostre o estandarte à Crítica',
        type: 'talk',
        target: 'critic',
        completed: false
      },
      {
        id: 'refine_banner',
        text: 'Refine o estandarte com base no feedback',
        type: 'refine',
        completed: false,
        optional: true
      },
      {
        id: 'return_to_guide',
        text: 'Retorne ao Guia',
        type: 'talk',
        target: 'elder_guide',
        completed: false
      }
    ],
    currentObjective: 0,
    completed: false,
    rewards: {
      xp: 1000,
      title: 'Condutor',
      unlocks: ['open_world_mode']
    }
  };

  // Observables
  private playerStateSubject = new BehaviorSubject<PlayerState>(this.playerState);
  private objectivesSubject = new BehaviorSubject<QuestObjective[]>(this.mainQuest.objectives);
  private playerLevelSubject = new BehaviorSubject<number>(this.playerState.level);
  private playerXPSubject = new BehaviorSubject<number>(this.playerState.xp);
  private xpToNextLevelSubject = new BehaviorSubject<number>(this.playerState.xpToNextLevel);

  // Public Observables
  playerState$ = this.playerStateSubject.asObservable();
  objectives$ = this.objectivesSubject.asObservable();
  playerLevel$ = this.playerLevelSubject.asObservable();
  playerXP$ = this.playerXPSubject.asObservable();
  xpToNextLevel$ = this.xpToNextLevelSubject.asObservable();

  // XP Requirements por nível
  private readonly XP_PER_LEVEL = [
    0,    // Level 1
    100,  // Level 2
    300,  // Level 3
    600,  // Level 4
    1000, // Level 5
  ];

  constructor() {
    // Carrega estado salvo na inicialização
    this.loadState();
  }

  /**
   * Carrega estado salvo ou inicializa novo
   */
  async loadOrInitialize(): Promise<boolean> {
    const hasSave = this.loadState();
    if (!hasSave) {
      this.initializeNewGame();
    }
    return hasSave;
  }

  /**
   * Inicia novo jogo
   */
  startNewQuest() {
    this.initializeNewGame();
    this.saveState();
  }

  private initializeNewGame() {
    this.playerState = {
      position: { x: 512, y: 400 },
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      title: 'Iniciado',
      inventory: [],
      unlockedNPCs: ['elder_guide'],
      completedObjectives: [],
      dialogueFlags: {}
    };

    this.mainQuest.currentObjective = 0;
    this.mainQuest.objectives.forEach(obj => obj.completed = false);

    this.updateObservables();
  }

  /**
   * Salva o estado atual
   */
  saveState() {
    const saveData: SaveGameState = {
      version: this.VERSION,
      timestamp: Date.now(),
      playerState: this.playerState,
      questProgress: {
        currentQuestId: this.mainQuest.id,
        currentObjectiveIndex: this.mainQuest.currentObjective,
        completedQuests: this.mainQuest.completed ? [this.mainQuest.id] : []
      },
      npcStates: this.getNPCStates(),
      flags: this.playerState.dialogueFlags
    };

    try {
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(saveData));
      console.log('Quest state saved successfully');
    } catch (error) {
      console.error('Failed to save quest state:', error);
    }
  }

  /**
   * Carrega o estado salvo
   */
  private loadState(): boolean {
    try {
      const savedData = localStorage.getItem(this.SAVE_KEY);
      if (!savedData) return false;

      const saveState: SaveGameState = JSON.parse(savedData);

      // Verifica versão
      if (saveState.version !== this.VERSION) {
        console.warn('Save version mismatch, starting new game');
        return false;
      }

      // Restaura estado
      this.playerState = saveState.playerState;
      this.mainQuest.currentObjective = saveState.questProgress.currentObjectiveIndex;

      // Restaura objetivos completados
      saveState.playerState.completedObjectives.forEach(objId => {
        const objective = this.mainQuest.objectives.find(o => o.id === objId);
        if (objective) {
          objective.completed = true;
        }
      });

      this.updateObservables();
      console.log('Quest state loaded successfully');
      return true;

    } catch (error) {
      console.error('Failed to load quest state:', error);
      return false;
    }
  }

  /**
   * Completa um objetivo
   */
  completeObjective(objectiveId: string) {
    const objective = this.mainQuest.objectives.find(o => o.id === objectiveId);
    if (!objective || objective.completed) return;

    objective.completed = true;
    this.playerState.completedObjectives.push(objectiveId);

    // Avança para próximo objetivo
    const nextIncompleteIndex = this.mainQuest.objectives.findIndex(o => !o.completed && !o.optional);
    if (nextIncompleteIndex !== -1) {
      this.mainQuest.currentObjective = nextIncompleteIndex;
    }

    // Verifica se completou a quest
    const requiredObjectives = this.mainQuest.objectives.filter(o => !o.optional);
    const completedRequired = requiredObjectives.every(o => o.completed);

    if (completedRequired) {
      this.completeQuest();
    }

    this.updateObservables();
    this.saveState();

    // Feedback visual/sonoro seria adicionado aqui
    console.log(`Objective completed: ${objective.text}`);
  }

  /**
   * Completa a quest principal
   */
  private completeQuest() {
    this.mainQuest.completed = true;

    // Aplica recompensas
    this.grantXP(this.mainQuest.rewards.xp);

    if (this.mainQuest.rewards.title) {
      this.playerState.title = this.mainQuest.rewards.title;
    }

    // Desbloqueia modo mundo aberto
    this.playerState.dialogueFlags['open_world_unlocked'] = true;

    console.log('🎉 Quest completed! You are now a Conductor!');
  }

  /**
   * Concede XP ao jogador
   */
  grantXP(amount: number) {
    this.playerState.xp += amount;

    // Verifica level up
    while (this.playerState.level < this.XP_PER_LEVEL.length - 1 &&
           this.playerState.xp >= this.XP_PER_LEVEL[this.playerState.level]) {
      this.levelUp();
    }

    // Atualiza XP para próximo nível
    if (this.playerState.level < this.XP_PER_LEVEL.length - 1) {
      this.playerState.xpToNextLevel = this.XP_PER_LEVEL[this.playerState.level] - this.playerState.xp;
    } else {
      this.playerState.xpToNextLevel = 0; // Max level
    }

    this.updateObservables();
    this.saveState();
  }

  /**
   * Sobe de nível
   */
  private levelUp() {
    this.playerState.level++;
    console.log(`🎉 Level Up! You are now level ${this.playerState.level}`);

    // Aqui poderia desbloquear novas features baseado no nível
    if (this.playerState.level === 2) {
      // Exemplo: desbloqueia novo NPC
    }
  }

  /**
   * Adiciona item ao inventário
   */
  addToInventory(itemId: string) {
    const itemNames: Record<string, any> = {
      'requirements_document': {
        id: 'requirements_document',
        name: 'Plano do Estandarte',
        description: 'Um plano detalhado para criar o estandarte da guilda',
        icon: '📋'
      },
      'guild_banner_v1': {
        id: 'guild_banner_v1',
        name: 'Estandarte da Guilda v1.0',
        description: 'O estandarte criado pela Artesã',
        icon: '🏳️'
      },
      'guild_banner_v2': {
        id: 'guild_banner_v2',
        name: 'Estandarte da Guilda v2.0',
        description: 'O estandarte refinado com base no feedback',
        icon: '🏳️'
      }
    };

    const item = itemNames[itemId];
    if (item && !this.playerState.inventory.find(i => i.id === itemId)) {
      this.playerState.inventory.push(item);
      this.updateObservables();
      this.saveState();
      console.log(`Item added to inventory: ${item.name}`);
    }
  }

  /**
   * Manipula interação com NPC
   */
  onNPCInteraction(npcId: string) {
    // Marca flag de interação
    this.playerState.dialogueFlags[`talked_to_${npcId}`] = true;

    // Verifica se completa algum objetivo
    const talkObjective = this.mainQuest.objectives.find(
      o => o.type === 'talk' && o.target === npcId && !o.completed
    );

    if (talkObjective) {
      this.completeObjective(talkObjective.id);
    }

    this.saveState();
  }

  /**
   * Obtém estado dos NPCs
   */
  private getNPCStates(): Record<string, any> {
    const states: Record<string, any> = {};

    ['elder_guide', 'requirements_scribe', 'artisan', 'critic'].forEach(npcId => {
      states[npcId] = {
        unlocked: this.playerState.unlockedNPCs.includes(npcId),
        interactionCount: this.playerState.dialogueFlags[`interaction_count_${npcId}`] || 0,
        lastDialogueNode: this.playerState.dialogueFlags[`last_dialogue_${npcId}`]
      };
    });

    return states;
  }

  /**
   * Atualiza todos os observables
   */
  private updateObservables() {
    this.playerStateSubject.next(this.playerState);
    this.objectivesSubject.next(this.mainQuest.objectives);
    this.playerLevelSubject.next(this.playerState.level);
    this.playerXPSubject.next(this.playerState.xp);
    this.xpToNextLevelSubject.next(this.playerState.xpToNextLevel);
  }

  /**
   * Getters úteis
   */
  getCurrentObjective(): QuestObjective | undefined {
    return this.mainQuest.objectives[this.mainQuest.currentObjective];
  }

  isNPCUnlocked(npcId: string): boolean {
    return this.playerState.unlockedNPCs.includes(npcId);
  }

  hasFlag(flag: string): boolean {
    return this.playerState.dialogueFlags[flag] === true;
  }

  setFlag(flag: string, value: boolean = true) {
    this.playerState.dialogueFlags[flag] = value;
    this.saveState();
  }
}