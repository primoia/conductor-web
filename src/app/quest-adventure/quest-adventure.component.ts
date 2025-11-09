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
        [hoveredNpcId]="hoveredNpcId"
        (onCanvasClick)="handleCanvasClick($event)"
        (onPlayerClick)="handlePlayerClick()"
        (onNpcInteract)="handleNpcClick($event)"
        (onNpcHover)="handleNpcHover($event)"
        (onCanvasResize)="handleCanvasResize($event)">
      </app-quest-canvas>

      <!-- Quest Tracker (Objetivos) - Expansível -->
      <app-quest-tracker
        *ngIf="showQuestTracker"
        [questTitle]="currentQuestTitle"
        [objectives]="questObjectives$ | async"
        [playerLevel]="playerLevel$ | async"
        [playerXP]="playerXP$ | async"
        [xpToNextLevel]="xpToNextLevel$ | async"
        [playerPosition]="playerPosition$ | async"
        (onReset)="handleReset()"
        (onClose)="handleQuestTrackerClose()">
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

      <!-- NPC Hover Modal (ao passar mouse) -->
      <div class="npc-hover-modal"
           *ngIf="showNpcHoverModal && npcHoverModalData && npcHoverPosition"
           [class.mobile]="isMobile"
           [style.left.px]="isMobile ? null : npcHoverPosition.x"
           [style.top.px]="isMobile ? null : npcHoverPosition.y">
        <div class="npc-hover-content">
          <div class="npc-hover-header">
            <span class="npc-hover-emoji">{{ npcHoverModalData.emoji }}</span>
            <div class="npc-hover-info">
              <div class="npc-hover-name">{{ npcHoverModalData.name }}</div>
              <div class="npc-hover-title">{{ npcHoverModalData.title }}</div>
            </div>
          </div>

          <div class="npc-hover-divider"></div>

          <div class="npc-hover-description">{{ npcHoverModalData.description }}</div>

          <div class="npc-hover-divider" *ngIf="npcHoverModalData.unlocked"></div>

          <div class="npc-hover-greeting" *ngIf="npcHoverModalData.unlocked">
            <span class="greeting-quote">"</span>{{ npcHoverModalData.greeting }}<span class="greeting-quote">"</span>
          </div>

          <div class="npc-hover-agent" *ngIf="npcHoverModalData.unlocked && npcHoverModalData.agentId">
            <span class="agent-icon">🤖</span>
            <span class="agent-label">Agente:</span>
            <span class="agent-id">{{ npcHoverModalData.agentId }}</span>
          </div>

          <div class="npc-hover-hint" [class.in-range]="npcHoverModalData.isInRange">
            <span class="hint-icon">{{ npcHoverModalData.isInRange ? '💬' : '👣' }}</span>
            {{ npcHoverModalData.isInRange ? 'Clique para conversar' : 'Clique para se aproximar' }}
          </div>
        </div>
      </div>

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
  showQuestTracker = false; // Tracker expandível ao clicar no player
  showNpcHoverModal = false; // Modal ao passar mouse sobre NPC
  npcHoverModalData: any = null; // Dados do NPC para hover
  hoveredNpcId: string | null = null; // ID do NPC sob o mouse
  npcHoverPosition: { x: number, y: number } | null = null; // Posição do NPC em hover

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

    // Move o player para a posição clicada (não verifica mais NPC aqui)
    this.movement.moveToPosition(position);
  }

  handleNpcClick(npcId: string) {
    // Novo método para lidar com cliques em NPCs
    const npc = this.npcManager.getNPC(npcId);
    if (!npc) return;

    const playerPos = this.movement.getCurrentPosition();
    const npcPos = npc.position;

    // Calcula distância
    const dx = npcPos.x - playerPos.x;
    const dy = npcPos.y - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const interactionRadius = 80; // Raio de interação

    if (distance <= interactionRadius) {
      // Player está perto o suficiente - inicia interação
      this.handleNpcInteract(npcId);
    } else {
      // Player está longe - move até o NPC
      this.moveToNPC(npcId);
    }
  }

  handlePlayerClick() {
    // Toggle do quest tracker ao clicar no player
    this.showQuestTracker = !this.showQuestTracker;
  }

  handleQuestTrackerClose() {
    // Fecha o quest tracker
    this.showQuestTracker = false;
  }

  handleNpcHover(npcId: string | null) {
    if (!npcId) {
      // Mouse saiu do NPC
      this.showNpcHoverModal = false;
      this.npcHoverModalData = null;
      this.hoveredNpcId = null;
      this.npcHoverPosition = null;
      return;
    }

    // Atualiza NPC em hover
    this.hoveredNpcId = npcId;

    // Mouse sobre NPC - mostra modal de hover
    const npc = this.npcManager.getNPC(npcId);
    if (!npc) return;

    // Calcula posição da modal ao lado do NPC
    // Em desktop, posiciona à direita do NPC
    // Verifica se há espaço suficiente à direita, senão coloca à esquerda
    const modalWidth = 400; // largura máxima da modal
    const modalHeight = 350; // altura estimada da modal
    const offsetX = 60; // distância do NPC
    const padding = 20; // margem da tela

    let modalX = npc.position.x + offsetX;
    let modalY = npc.position.y - 20;

    // Ajusta se a modal sair da tela à direita
    if (modalX + modalWidth > window.innerWidth - padding) {
      modalX = npc.position.x - offsetX - modalWidth;
    }

    // Ajusta se a modal sair da tela à esquerda
    if (modalX < padding) {
      modalX = padding;
    }

    // Ajusta se a modal sair da tela no topo
    if (modalY < padding) {
      modalY = padding;
    }

    // Ajusta se a modal sair da tela embaixo
    if (modalY + modalHeight > window.innerHeight - padding) {
      modalY = window.innerHeight - modalHeight - padding;
    }

    // Salva posição ajustada do NPC para posicionar a modal
    this.npcHoverPosition = { x: modalX, y: modalY };

    // Calcula distância do player ao NPC
    const playerPos = this.movement.getCurrentPosition();
    const npcPos = npc.position;
    const dx = npcPos.x - playerPos.x;
    const dy = npcPos.y - playerPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const interactionRadius = 80;
    const isInRange = distance <= interactionRadius;

    // Descrições detalhadas por NPC
    const npcDescriptions: { [key: string]: string } = {
      'elder_guide': 'Um sábio mentor que guia novos iniciados pelos caminhos da Guilda. Sua experiência é vasta e suas palavras são sempre precisas.',
      'requirements_scribe': 'Meticuloso e organizado, este especialista transforma ideias vagas em planos estruturados e detalhados.',
      'artisan': 'Com mãos habilidosas e paixão pelo trabalho, esta executora transforma planos em realidade tangível.',
      'critic': 'Com olhar refinado e atenção aos detalhes, ela aprimora cada criação até atingir a excelência.',
      'librarian': 'Guardiã do conhecimento ancestral da Guilda, ela preserva e compartilha a sabedoria acumulada ao longo dos séculos.'
    };

    this.npcHoverModalData = {
      name: npc.unlocked ? npc.name : '???',
      title: npc.unlocked ? npc.title : 'Desconhecido',
      emoji: npc.emoji,
      unlocked: npc.unlocked,
      greeting: npc.unlocked ? npc.greeting : 'Aproxime-se para descobrir...',
      description: npc.unlocked ? npcDescriptions[npc.id] : 'Uma figura misteriosa. Você precisa se aproximar para descobrir mais.',
      agentId: npc.unlocked ? npc.agentId : undefined,
      isInRange: isInRange
    };
    this.showNpcHoverModal = true;
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

    // CONGELA o NPC para evitar que ele se mova enquanto o player vai até ele
    this.npcManager.freezeNPC(npcId, 10000); // Congela por 10 segundos

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
      // Pega NPC atualizado
      const npc = this.npcManager.getNPC(npcId);
      if (!npc) {
        clearInterval(checkInterval);
        return;
      }

      const playerPos = this.movement.getCurrentPosition();
      const currentNpcPos = npc.position;
      const dx = currentNpcPos.x - playerPos.x;
      const dy = currentNpcPos.y - playerPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Se chegou perto o suficiente (dentro da zona de controle)
      if (distance <= radius) {
        clearInterval(checkInterval);

        // Para o movimento
        this.movement.stop();

        // Descongela o NPC
        this.npcManager.unfreezeNPC(npcId);

        // Aguarda um frame para garantir que parou e então abre o chat
        setTimeout(() => {
          console.log(`[Zone Detection] Player entrou na zona de controle do NPC ${npcId}`);
          this.handleNpcInteract(npcId);
        }, 100);
        return;
      }

      // Se não está mais se movendo (cancelou movimento)
      if (!this.movement.isCurrentlyMoving()) {
        clearInterval(checkInterval);
        // Descongela o NPC após um pequeno delay
        setTimeout(() => {
          this.npcManager.unfreezeNPC(npcId);
        }, 1000);
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