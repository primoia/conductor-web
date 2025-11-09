import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuestCanvasComponent } from './components/quest-canvas/quest-canvas.component';
import { QuestChatModalComponent } from './components/quest-chat-modal/quest-chat-modal.component';
import { QuestTrackerComponent } from './components/quest-tracker/quest-tracker.component';
import { QuestStateService } from './services/quest-state.service';
import { NpcManagerService } from './services/npc-manager.service';
import { PlayerMovementService } from './services/player-movement.service';
import { DialogueService } from './services/dialogue.service';
import { NPC, Position, QuestObjective, DialogueOption } from './models/quest.models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-quest-adventure',
  standalone: true,
  imports: [
    CommonModule,
    QuestCanvasComponent,
    QuestChatModalComponent,
    QuestTrackerComponent
  ],
  template: `
    <div class="quest-container" [class.mobile]="isMobile">
      <!-- Canvas Principal (Mapa do Salão) -->
      <app-quest-canvas
        [npcs]="npcs$ | async"
        [playerPosition]="playerPosition$ | async"
        [isPlayerMoving]="isMoving$ | async"
        [focusTarget]="focusTarget"
        (onCanvasClick)="handleCanvasClick($event)"
        (onNpcInteract)="handleNpcInteract($event)">
      </app-quest-canvas>

      <!-- Quest Tracker (Objetivos) -->
      <app-quest-tracker
        [questTitle]="currentQuestTitle"
        [objectives]="questObjectives$ | async"
        [playerLevel]="playerLevel$ | async"
        [playerXP]="playerXP$ | async"
        [xpToNextLevel]="xpToNextLevel$ | async">
      </app-quest-tracker>

      <!-- Chat Modal (Diálogos com NPCs) -->
      <app-quest-chat-modal
        *ngIf="activeDialogue$ | async as dialogue"
        [npc]="dialogue.npc"
        [message]="dialogue.message"
        [options]="dialogue.options"
        [isTyping]="dialogue.isTyping"
        (onOptionSelect)="handleDialogueChoice($event)"
        (onClose)="closeDialogue()">
      </app-quest-chat-modal>

      <!-- Overlay de Introdução (primeira vez) -->
      <div class="intro-overlay" *ngIf="showIntro" (click)="skipIntro()">
        <div class="intro-content">
          <h1 class="intro-title">A Jornada do Iniciado</h1>
          <p class="intro-subtitle">Conhecendo a Equipe</p>
          <div class="intro-text">
            <p>Você é um Iniciado chegando ao Salão da Guilda dos Condutores.</p>
            <p>Sua missão: aprender a orquestrar especialistas para transformar ideias em realidade.</p>
          </div>
          <button class="intro-button" (click)="startQuest()">
            Começar Jornada
          </button>
        </div>
      </div>

      <!-- Loading Screen -->
      <div class="loading-overlay" *ngIf="isLoading">
        <div class="loading-spinner"></div>
        <p class="loading-text">Preparando o Salão da Guilda...</p>
      </div>
    </div>
  `,
  styleUrls: ['./quest-adventure.component.scss']
})
export class QuestAdventureComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Estado Observable
  npcs$;
  playerPosition$;
  isMoving$;
  questObjectives$;
  playerLevel$;
  playerXP$;
  xpToNextLevel$;
  activeDialogue$;

  // Estado Local
  currentQuestTitle = "O Estandarte da Guilda";
  showIntro = true;
  isLoading = false;
  isMobile = false;
  focusTarget: string | null = null;

  constructor(
    private questState: QuestStateService,
    private npcManager: NpcManagerService,
    private movement: PlayerMovementService,
    private dialogue: DialogueService
  ) {
    // Inicializa observables após as dependências estarem disponíveis
    this.npcs$ = this.npcManager.npcs$;
    this.playerPosition$ = this.movement.position$;
    this.isMoving$ = this.movement.isMoving$;
    this.questObjectives$ = this.questState.objectives$;
    this.playerLevel$ = this.questState.playerLevel$;
    this.playerXP$ = this.questState.playerXP$;
    this.xpToNextLevel$ = this.questState.xpToNextLevel$;
    this.activeDialogue$ = this.dialogue.activeDialogue$;

    this.checkMobileDevice();
  }

  ngOnInit() {
    this.initializeQuest();
    this.setupEventListeners();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async initializeQuest() {
    this.isLoading = true;

    try {
      // Carrega estado salvo ou inicia novo
      const hasSave = await this.questState.loadOrInitialize();

      if (hasSave) {
        this.showIntro = false;
      }

      // Inicializa NPCs
      await this.npcManager.loadNPCs();

      // Setup inicial do mapa
      this.setupInitialState();

    } catch (error) {
      console.error('Erro ao inicializar quest:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private setupInitialState() {
    // Posiciona player no centro
    this.movement.setPosition({ x: 512, y: 400 });

    // Desbloqueia apenas o Guia inicialmente
    this.npcManager.unlockNPC('elder_guide');
  }

  private setupEventListeners() {
    // Escuta mudanças de objetivos
    this.questState.objectives$
      .pipe(takeUntil(this.destroy$))
      .subscribe(objectives => {
        this.updateFocusTarget(objectives);
      });

    // Auto-save a cada 30 segundos
    setInterval(() => {
      this.questState.saveState();
    }, 30000);
  }

  startQuest() {
    this.showIntro = false;
    this.questState.startNewQuest();

    // Inicia primeira interação após delay
    setTimeout(() => {
      this.showGuideApproach();
    }, 1000);
  }

  skipIntro() {
    if (!this.showIntro) return;
    this.startQuest();
  }

  private showGuideApproach() {
    // Faz o Guia se aproximar do player
    const guide = this.npcManager.getNPC('elder_guide');
    if (guide) {
      this.focusTarget = 'elder_guide';

      // Mostra indicador de interação
      setTimeout(() => {
        this.npcManager.setNPCIndicator('elder_guide', 'talk');
      }, 500);
    }
  }

  handleCanvasClick(position: Position) {
    // Se tem diálogo ativo, ignora clicks no canvas
    if (this.dialogue.hasActiveDialogue()) {
      return;
    }

    // Verifica se clicou em um NPC
    const clickedNPC = this.npcManager.getNPCAtPosition(position);

    if (clickedNPC && clickedNPC.unlocked) {
      this.handleNpcInteract(clickedNPC.id);
    } else {
      // Move o player para a posição
      this.movement.moveToPosition(position);
    }
  }

  handleNpcInteract(npcId: string) {
    const npc = this.npcManager.getNPC(npcId);
    if (!npc || !npc.unlocked) return;

    // Para movimento se estiver andando
    this.movement.stop();

    // Inicia diálogo
    this.dialogue.startDialogue(npc);

    // Atualiza progresso da quest
    this.questState.onNPCInteraction(npcId);
  }

  handleDialogueChoice(option: DialogueOption) {
    // Processa escolha do diálogo
    this.dialogue.processChoice(option);

    // Atualiza estado da quest baseado na escolha
    if (option.action) {
      this.processDialogueAction(option.action);
    }

    // Dá XP se houver
    if (option.xp) {
      this.questState.grantXP(option.xp);
    }
  }

  private processDialogueAction(action: any) {
    switch (action.type) {
      case 'unlock_npc':
        this.npcManager.unlockNPC(action.target);
        this.focusTarget = action.target;
        break;

      case 'give_item':
        this.questState.addToInventory(action.item);
        break;

      case 'complete_objective':
        this.questState.completeObjective(action.objective);
        break;

      case 'start_creation':
        this.startBannerCreation();
        break;
    }
  }

  private startBannerCreation() {
    // Inicia animação especial de criação do estandarte
    this.focusTarget = 'artisan_creation';

    // Será implementado no QuestCanvasComponent
    setTimeout(() => {
      this.questState.completeObjective('banner_created');
      this.questState.addToInventory('guild_banner_v1');
    }, 5000);
  }

  closeDialogue() {
    this.dialogue.closeDialogue();
  }

  private updateFocusTarget(objectives: QuestObjective[]) {
    // Atualiza o foco visual baseado no objetivo atual
    const currentObjective = objectives.find(o => !o.completed);

    if (currentObjective) {
      switch (currentObjective.id) {
        case 'talk_to_guide':
          this.focusTarget = 'elder_guide';
          break;
        case 'talk_to_scribe':
          this.focusTarget = 'requirements_scribe';
          break;
        case 'talk_to_artisan':
          this.focusTarget = 'artisan';
          break;
        case 'talk_to_critic':
          this.focusTarget = 'critic';
          break;
        default:
          this.focusTarget = null;
      }
    }
  }

  private checkMobileDevice() {
    this.isMobile = window.innerWidth < 768;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkMobileDevice();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: any) {
    // Salva estado antes de sair
    this.questState.saveState();
  }
}