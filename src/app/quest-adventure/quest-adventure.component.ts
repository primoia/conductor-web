import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
    FormsModule,
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
        [playerName]="playerName"
        [focusTarget]="focusTarget"
        (onCanvasClick)="handleCanvasClick($event)"
        (onCanvasResize)="handleCanvasResize($event)">
      </app-quest-canvas>

      <!-- Quest Tracker (Objetivos) -->
      <app-quest-tracker
        [questTitle]="currentQuestTitle"
        [objectives]="questObjectives$ | async"
        [playerLevel]="playerLevel$ | async"
        [playerXP]="playerXP$ | async"
        [xpToNextLevel]="xpToNextLevel$ | async"
        (onReset)="handleReset()">
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
      <div class="intro-overlay" *ngIf="showIntro">
        <div class="intro-content" (click)="$event.stopPropagation()">
          <h1 class="intro-title">A Jornada do Iniciado</h1>
          <p class="intro-subtitle">Conhecendo a Equipe</p>
          <div class="intro-text">
            <p>Você é um Iniciado chegando ao Salão da Guilda dos Condutores.</p>
            <p>Sua missão: aprender a orquestrar especialistas para transformar ideias em realidade.</p>
          </div>
          <div class="intro-name-input">
            <label for="playerName">Qual é o seu nome, Iniciado?</label>
            <input
              type="text"
              id="playerName"
              [(ngModel)]="playerName"
              placeholder="Digite seu nome"
              maxlength="20"
              (keyup.enter)="startQuest()"
              autofocus>
          </div>
          <button class="intro-button" (click)="startQuest()" [disabled]="!playerName.trim()">
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
  playerName = '';

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
      // Verifica se deve forçar a intro (após reset)
      const forceIntro = sessionStorage.getItem('force_intro');
      if (forceIntro) {
        sessionStorage.removeItem('force_intro');
        this.showIntro = true;
      } else {
        // Carrega estado salvo ou inicia novo
        const hasSave = await this.questState.loadOrInitialize();

        if (hasSave) {
          this.showIntro = false;
        }
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

    // Desbloqueia o Guia e a Biblioteca inicialmente
    this.npcManager.unlockNPC('elder_guide');
    this.npcManager.unlockNPC('librarian');
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

  handleCanvasResize(size: {width: number, height: number}) {
    // Atualiza os limites de movimento do player
    this.movement.updateMapBounds(size.width, size.height);

    // Reposiciona NPCs nos cantos da tela
    this.npcManager.repositionNPCs(size.width, size.height);
  }

  handleCanvasClick(position: Position) {
    // Se tem diálogo ativo, ignora clicks no canvas
    if (this.dialogue.hasActiveDialogue()) {
      return;
    }

    // Verifica se clicou em um NPC (bloqueado ou não)
    const clickedNPC = this.npcManager.getNPCAtPosition(position);

    if (clickedNPC) {
      // Move o player até perto do NPC primeiro
      this.moveToNPC(clickedNPC.id);
    } else {
      // Move o player para a posição clicada
      this.movement.moveToPosition(position);
    }
  }

  private moveToNPC(npcId: string) {
    const npc = this.npcManager.getNPC(npcId);
    if (!npc) return;

    // Calcula posição próxima ao NPC (60 pixels de distância)
    const playerPos = this.movement.getCurrentPosition();
    const npcPos = npc.position;

    // Vetor do player para o NPC
    const dx = npcPos.x - playerPos.x;
    const dy = npcPos.y - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Se já está perto o suficiente (dentro do raio de interação)
    const interactionRadius = 80;
    if (distance <= interactionRadius) {
      // Já está perto, tenta interagir
      this.handleNpcInteract(npcId);
      return;
    }

    // Calcula posição de destino (próxima ao NPC mas não em cima)
    const targetDistance = 60; // Fica a 60px do NPC
    const ratio = (distance - targetDistance) / distance;
    const targetPos = {
      x: playerPos.x + dx * ratio,
      y: playerPos.y + dy * ratio
    };

    // Move até lá
    this.movement.moveToPosition(targetPos);

    // Aguarda chegar perto do NPC para iniciar diálogo (bloqueado ou não)
    this.waitForPlayerReachNPC(npcId, npcPos, interactionRadius);
  }

  private waitForPlayerReachNPC(npcId: string, npcPos: Position, radius: number) {
    const checkInterval = setInterval(() => {
      const playerPos = this.movement.getCurrentPosition();
      const dx = npcPos.x - playerPos.x;
      const dy = npcPos.y - playerPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Se chegou perto o suficiente
      if (distance <= radius) {
        clearInterval(checkInterval);

        // Para o movimento
        this.movement.stop();

        // Aguarda um frame para garantir que parou
        setTimeout(() => {
          this.handleNpcInteract(npcId);
        }, 100);
      }

      // Se não está mais se movendo (cancelou movimento), cancela verificação
      if (!this.movement.isCurrentlyMoving()) {
        clearInterval(checkInterval);
      }
    }, 100); // Verifica a cada 100ms
  }

  handleNpcInteract(npcId: string) {
    const npc = this.npcManager.getNPC(npcId);
    if (!npc) return;

    console.log(`[NPC Interact] NPC: ${npcId}, Locked: ${!npc.unlocked}, Target: ${this.questState.getTargetNpcToFind()}`);

    // Se NPC está bloqueado
    if (!npc.unlocked) {
      // Verifica se é o NPC que deve ser encontrado
      const targetNpc = this.questState.getTargetNpcToFind();

      if (targetNpc === npcId) {
        // Achou o NPC correto! Desbloqueia e inicia diálogo
        console.log(`[NPC Found] Desbloqueando ${npcId}`);
        this.npcManager.unlockNPC(npcId);
        this.questState.clearTargetNpcToFind();

        // Aguarda um momento para mostrar o nome aparecer e pega NPC atualizado
        setTimeout(() => {
          const unlockedNpc = this.npcManager.getNPC(npcId);
          if (unlockedNpc) {
            console.log(`[NPC Dialogue] Iniciando diálogo com ${npcId}, unlocked: ${unlockedNpc.unlocked}`);
            this.dialogue.startDialogue(unlockedNpc);
            this.questState.onNPCInteraction(npcId);
          }
        }, 500);
      } else {
        // NPC errado - mostra mensagem de que não é o NPC procurado
        console.log(`[NPC Wrong] Esperava ${targetNpc}, encontrou ${npcId}`);
        this.showWrongNPCMessage(npc, targetNpc);
      }
      return;
    }

    // NPC desbloqueado - inicia diálogo normal
    console.log(`[NPC Unlocked] Diálogo normal com ${npcId}`);
    this.dialogue.startDialogue(npc);
    this.questState.onNPCInteraction(npcId);
  }

  private showWrongNPCMessage(npc: NPC, targetNpcId: string | null) {
    // Cria um NPC temporário anônimo
    const anonymousNPC: NPC = {
      ...npc,
      name: '???',
      unlocked: true
    };

    let message = 'Não sou quem você procura. Tente em outro lugar.';

    if (targetNpcId) {
      // Mensagens baseadas no NPC alvo
      const targetMessages: { [key: string]: string } = {
        'requirements_scribe': 'Não sou O Planejador. Procure em outro canto do salão.',
        'artisan': 'Não sou A Executora. Continue procurando pelos cantos.',
        'critic': 'Não sou A Refinadora. Ela deve estar em algum outro lugar.'
      };
      message = targetMessages[targetNpcId] || message;
    }

    // Cria diálogo temporário
    this.dialogue['activeDialogue'] = {
      npc: anonymousNPC,
      message: message,
      options: [],
      isTyping: false
    };

    this.dialogue['activeDialogueSubject'].next(this.dialogue['activeDialogue']);
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

      case 'set_target_npc':
        // Define o NPC alvo a ser encontrado
        this.questState.setTargetNpcToFind(action.target);
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

  handleReset() {
    // Limpa localStorage completamente
    localStorage.clear();

    // Limpa o nome do player
    this.playerName = '';

    // Força mostrar intro novamente
    sessionStorage.setItem('force_intro', 'true');

    // Recarrega a página
    window.location.reload();
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