import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NPC, Position } from '../models/quest.models';
import npcsData from '../data/npcs.json';

@Injectable({
  providedIn: 'root'
})
export class NpcManagerService implements OnDestroy {
  // NPCs disponíveis no jogo
  private npcs: NPC[] = [
    {
      id: 'elder_guide',
      name: 'Guia Ancião',
      emoji: '🧙‍♂️',
      title: 'O Mentor',
      position: { x: 512, y: 400 },
      unlocked: true,
      sprite: 'guide',
      agentId: 'SystemGuide_Meta_Agent',
      greeting: 'Bem-vindo ao Salão da Guilda, Iniciado.',
      personality: {
        trait: 'wise',
        greetingStyle: 'formal',
        workingPhrases: [
          'Deixe-me pensar...',
          'Ah, sim, vejo o caminho...',
          'A sabedoria antiga nos guia...'
        ],
        successPhrase: 'Excelente trabalho, jovem Condutor!'
      },
      currentIndicator: 'talk',
      dialogueTreeId: 'guide_intro'
    },
    {
      id: 'requirements_scribe',
      name: 'Escriba',
      emoji: '🤖',
      title: 'Condutor de Planejamento',
      position: { x: 150, y: 150 },
      unlocked: false,
      sprite: 'scribe',
      agentId: 'RequirementsAnalyst_Agent',
      greeting: 'MODO HIBERNAÇÃO... zzz... DETECÇÃO DE SINAL...',
      personality: {
        trait: 'methodical',
        greetingStyle: 'professional',
        workingPhrases: [
          'PROCESSANDO REQUISITOS...',
          'ESTRUTURANDO SCREENPLAY...',
          'DOCUMENTANDO PARÂMETROS...'
        ],
        successPhrase: 'SCREENPLAY GERADO COM SUCESSO!'
      },
      currentIndicator: 'none',
      dialogueTreeId: 'scribe_boot'
    },
    {
      id: 'artisan',
      name: 'Artesã',
      emoji: '⚙️',
      title: 'Condutor de Execução',
      position: { x: 750, y: 600 },
      unlocked: false,
      sprite: 'artisan',
      agentId: 'BackendDeveloper_Agent',
      greeting: 'MODO SEGURANÇA ATIVO... Energia baixa...',
      personality: {
        trait: 'energetic',
        greetingStyle: 'enthusiastic',
        workingPhrases: [
          'COMPILANDO CÓDIGO...',
          'EXECUTANDO FUNÇÃO...',
          'BUILD EM PROGRESSO...'
        ],
        successPhrase: 'EXECUÇÃO COMPLETA! CÓDIGO RODANDO!'
      },
      currentIndicator: 'none',
      dialogueTreeId: 'artisan_activation'
    },
    {
      id: 'critic',
      name: 'Crítica',
      emoji: '🔍',
      title: 'Condutor de Otimização',
      position: { x: 750, y: 150 },
      unlocked: false,
      sprite: 'critic',
      agentId: 'CodeReviewer_Agent',
      greeting: 'ANÁLISE VISUAL: Novo visitante detectado...',
      personality: {
        trait: 'refined',
        greetingStyle: 'elegant',
        workingPhrases: [
          'ANALISANDO PADRÕES...',
          'OTIMIZANDO PERFORMANCE...',
          'REFINANDO ALGORITMO...'
        ],
        successPhrase: 'ANÁLISE COMPLETA! CÓDIGO OTIMIZADO!'
      },
      currentIndicator: 'none',
      dialogueTreeId: 'critic_calibration'
    },
    {
      id: 'librarian',
      name: 'Bibliotecária',
      emoji: '💾',
      title: 'Unidade de Armazenamento',
      position: { x: 150, y: 600 },
      unlocked: true,
      sprite: 'librarian',
      agentId: 'Knowledge_Agent',
      greeting: 'PROCESSANDO... Detecto assinatura digital do Guia.',
      personality: {
        trait: 'knowledgeable',
        greetingStyle: 'scholarly',
        workingPhrases: [
          'ACESSANDO BANCO DE DADOS...',
          'RECUPERANDO ARQUIVO...',
          'DECODIFICANDO INFORMAÇÃO...'
        ],
        successPhrase: 'TRANSFERÊNCIA COMPLETA!'
      },
      currentIndicator: 'none',
      dialogueTreeId: 'librarian_intro'
    }
  ];

  // Subjects
  private npcsSubject = new BehaviorSubject<NPC[]>(this.npcs);

  // Public Observables
  npcs$ = this.npcsSubject.asObservable();

  // Configurações
  private readonly INTERACTION_RANGE = 60; // pixels

  // Wandering animation frame
  private wanderAnimationFrame: number | null = null;

  constructor() {
    this.initializeNPCs();
    this.startWanderingLoop();
  }

  /**
   * Inicializa NPCs com estado padrão
   */
  private initializeNPCs() {
    // Apenas o Guia e a Biblioteca começam desbloqueados
    this.npcs.forEach(npc => {
      if (npc.id !== 'elder_guide' && npc.id !== 'librarian') {
        npc.unlocked = false;
        npc.currentIndicator = 'none';
      }

      // Inicializa propriedades de wandering
      this.initializeWandering(npc);
    });

    this.updateNPCs();
  }

  /**
   * Inicializa propriedades de wandering para um NPC
   */
  private initializeWandering(npc: NPC) {
    // Salva a posição inicial como "home"
    npc.homePosition = { ...npc.position };

    // Define raio de movimento baseado na personalidade
    // NPCs mais energéticos se movem mais (3x maior que antes)
    const radiusMap: { [key: string]: number } = {
      'wise': 120,        // Guia se move pouco (40 * 3)
      'methodical': 105,  // Escriba se move de forma calculada (35 * 3)
      'energetic': 180,   // Artesã se move bastante (60 * 3)
      'refined': 90,      // Crítica se move elegantemente (30 * 3)
      'knowledgeable': 75 // Bibliotecária fica mais quieta (25 * 3)
    };
    npc.wanderRadius = radiusMap[npc.personality.trait] || 120;

    // Velocidade de movimento (pixels por frame)
    const speedMap: { [key: string]: number } = {
      'wise': 0.5,
      'methodical': 0.4,
      'energetic': 0.8,
      'refined': 0.3,
      'knowledgeable': 0.3
    };
    npc.wanderSpeed = speedMap[npc.personality.trait] || 0.5;

    // Delay entre movimentos (cada NPC tem um offset aleatório)
    // Base: 3-8 segundos
    const baseDelay = 3000 + Math.random() * 5000;
    // Adiciona offset aleatório para dessincronizar
    const randomOffset = Math.random() * 3000;
    npc.wanderDelay = baseDelay;

    // Define o primeiro movimento com offset aleatório
    npc.nextWanderTime = Date.now() + randomOffset;
    npc.isWandering = false;
  }

  /**
   * Reposiciona NPCs baseado no tamanho do canvas (nos cantos)
   */
  repositionNPCs(canvasWidth: number, canvasHeight: number) {
    // Detecta se é mobile baseado no tamanho do canvas
    const isMobile = canvasWidth < 768;

    // Define margem baseado no dispositivo
    // Desktop: margem maior para evitar NPCs colados nas extremidades
    // Mobile: margem menor e ajustada para evitar sobreposição
    const margin = isMobile ? 80 : 200;

    // Guia Ancião - Centro do mapa
    const guide = this.getNPC('elder_guide');
    if (guide) {
      guide.position = { x: canvasWidth / 2, y: canvasHeight / 2 };
      guide.homePosition = { ...guide.position };
    }

    // Escriba - Canto superior esquerdo
    const scribe = this.getNPC('requirements_scribe');
    if (scribe) {
      // Em mobile, posiciona mais à direita para evitar ficar colado
      const xPosition = isMobile ? margin + 30 : margin;
      scribe.position = { x: xPosition, y: margin };
      scribe.homePosition = { ...scribe.position };
    }

    // Artesã - Canto inferior direito
    const artisan = this.getNPC('artisan');
    if (artisan) {
      // Em mobile, adiciona offset para espaçamento
      const xOffset = isMobile ? margin + 30 : margin;
      artisan.position = { x: canvasWidth - xOffset, y: canvasHeight - margin };
      artisan.homePosition = { ...artisan.position };
    }

    // Crítica - Canto superior direito
    const critic = this.getNPC('critic');
    if (critic) {
      // Em mobile, adiciona offset para espaçamento
      const xOffset = isMobile ? margin + 30 : margin;
      critic.position = { x: canvasWidth - xOffset, y: margin };
      critic.homePosition = { ...critic.position };
    }

    // Bibliotecária - Canto inferior esquerdo
    const librarian = this.getNPC('librarian');
    if (librarian) {
      // Em mobile, posiciona mais à direita para evitar ficar colado
      const xPosition = isMobile ? margin + 30 : margin;
      librarian.position = { x: xPosition, y: canvasHeight - margin };
      librarian.homePosition = { ...librarian.position };
    }

    this.updateNPCs();
  }

  /**
   * Carrega NPCs (pode ser de arquivo JSON futuramente)
   */
  async loadNPCs(): Promise<void> {
    // Por enquanto usa os NPCs hardcoded
    // Futuramente pode carregar de arquivo JSON
    return Promise.resolve();
  }

  /**
   * Obtém um NPC pelo ID
   */
  getNPC(id: string): NPC | undefined {
    return this.npcs.find(npc => npc.id === id);
  }

  /**
   * Desbloqueia um NPC
   */
  unlockNPC(npcId: string) {
    const npc = this.getNPC(npcId);
    if (npc && !npc.unlocked) {
      npc.unlocked = true;
      npc.currentIndicator = 'talk'; // Mostra indicador de conversa

      console.log(`NPC unlocked: ${npc.name}`);
      this.updateNPCs();

      // Remove indicador após alguns segundos
      setTimeout(() => {
        if (npc.currentIndicator === 'talk') {
          npc.currentIndicator = 'none';
          this.updateNPCs();
        }
      }, 10000);
    }
  }

  /**
   * Verifica se uma posição está próxima de um NPC
   * Agora permite cliques em NPCs bloqueados para o sistema de descoberta
   */
  getNPCAtPosition(position: Position): NPC | undefined {
    return this.npcs.find(npc => {
      const distance = Math.sqrt(
        Math.pow(position.x - npc.position.x, 2) +
        Math.pow(position.y - npc.position.y, 2)
      );

      return distance <= this.INTERACTION_RANGE;
    });
  }

  /**
   * Define o indicador de um NPC
   */
  setNPCIndicator(npcId: string, indicator: 'none' | 'talk' | 'quest' | 'working') {
    const npc = this.getNPC(npcId);
    if (npc) {
      npc.currentIndicator = indicator;
      this.updateNPCs();
    }
  }

  /**
   * Obtém todos os NPCs desbloqueados
   */
  getUnlockedNPCs(): NPC[] {
    return this.npcs.filter(npc => npc.unlocked);
  }

  /**
   * Move um NPC para uma nova posição (para animações)
   */
  moveNPC(npcId: string, newPosition: Position, duration: number = 1000) {
    const npc = this.getNPC(npcId);
    if (!npc) return;

    const startPosition = { ...npc.position };
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Interpolação linear
      npc.position.x = startPosition.x + (newPosition.x - startPosition.x) * progress;
      npc.position.y = startPosition.y + (newPosition.y - startPosition.y) * progress;

      this.updateNPCs();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Faz um NPC "trabalhar" (animação)
   */
  setNPCWorking(npcId: string, duration: number = 3000) {
    const npc = this.getNPC(npcId);
    if (!npc) return;

    npc.currentIndicator = 'working';
    this.updateNPCs();

    // Simula frases durante o trabalho
    let phraseIndex = 0;
    const interval = setInterval(() => {
      if (phraseIndex < npc.personality.workingPhrases.length) {
        console.log(`${npc.name}: ${npc.personality.workingPhrases[phraseIndex]}`);
        phraseIndex++;
      }
    }, duration / npc.personality.workingPhrases.length);

    // Para de trabalhar após a duração
    setTimeout(() => {
      clearInterval(interval);
      npc.currentIndicator = 'none';
      console.log(`${npc.name}: ${npc.personality.successPhrase}`);
      this.updateNPCs();
    }, duration);
  }

  /**
   * Reseta todos os NPCs ao estado inicial
   */
  resetNPCs() {
    this.initializeNPCs();
  }

  /**
   * Atualiza o observable
   */
  private updateNPCs() {
    this.npcsSubject.next([...this.npcs]);
  }

  /**
   * Obtém a distância entre dois pontos
   */
  private getDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2)
    );
  }

  /**
   * Verifica se o player está próximo de algum NPC
   */
  getNearbyNPC(playerPosition: Position): NPC | undefined {
    return this.npcs.find(npc => {
      if (!npc.unlocked) return false;
      return this.getDistance(playerPosition, npc.position) <= this.INTERACTION_RANGE;
    });
  }

  /**
   * Obtém todos os NPCs em um raio específico
   */
  getNPCsInRadius(center: Position, radius: number): NPC[] {
    return this.npcs.filter(npc => {
      if (!npc.unlocked) return false;
      return this.getDistance(center, npc.position) <= radius;
    });
  }

  /**
   * Inicia o loop de wandering dos NPCs
   */
  private startWanderingLoop() {
    const updateWandering = () => {
      const now = Date.now();
      let hasChanges = false;

      this.npcs.forEach(npc => {
        // Pula NPCs congelados
        if (npc.isFrozen) {
          return;
        }

        // TODOS os NPCs se movem (mesmo bloqueados)

        // Se está em movimento
        if (npc.isWandering && npc.currentTarget && npc.wanderSpeed) {
          const dx = npc.currentTarget.x - npc.position.x;
          const dy = npc.currentTarget.y - npc.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Se chegou ao destino
          if (distance < 2) {
            npc.isWandering = false;
            npc.currentTarget = undefined;
            // Define próximo movimento
            npc.nextWanderTime = now + (npc.wanderDelay || 5000);
            hasChanges = true;
          } else {
            // Move em direção ao alvo
            const dirX = dx / distance;
            const dirY = dy / distance;
            npc.position.x += dirX * npc.wanderSpeed;
            npc.position.y += dirY * npc.wanderSpeed;
            hasChanges = true;
          }
        }
        // Se é hora de iniciar novo movimento
        else if (!npc.isWandering && npc.nextWanderTime && now >= npc.nextWanderTime) {
          this.startWandering(npc);
          hasChanges = true;
        }
      });

      // Só atualiza se houve mudanças
      if (hasChanges) {
        this.updateNPCs();
      }

      this.wanderAnimationFrame = requestAnimationFrame(updateWandering);
    };

    updateWandering();
  }

  /**
   * Inicia movimento de wandering para um NPC
   */
  private startWandering(npc: NPC) {
    if (!npc.homePosition || !npc.wanderRadius) return;

    // Decide se volta pra casa ou vai para uma posição aleatória
    const shouldReturnHome = Math.random() < 0.4; // 40% de chance de voltar pra casa

    if (shouldReturnHome) {
      // Volta para a posição inicial
      npc.currentTarget = { ...npc.homePosition };
    } else {
      // Gera posição aleatória dentro do raio
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * npc.wanderRadius;

      npc.currentTarget = {
        x: npc.homePosition.x + Math.cos(angle) * distance,
        y: npc.homePosition.y + Math.sin(angle) * distance
      };
    }

    npc.isWandering = true;
  }

  /**
   * Para o loop de wandering (para cleanup)
   */
  stopWandering() {
    if (this.wanderAnimationFrame) {
      cancelAnimationFrame(this.wanderAnimationFrame);
      this.wanderAnimationFrame = null;
    }
  }

  /**
   * Congela temporariamente o movimento de um NPC
   * Útil quando o player está indo em direção ao NPC
   */
  freezeNPC(npcId: string, duration: number = 5000) {
    const npc = this.getNPC(npcId);
    if (!npc) return;

    // Para movimento atual
    npc.isWandering = false;
    npc.currentTarget = undefined;

    // Limpa timer anterior se existir
    if (npc.freezeTimer) {
      clearTimeout(npc.freezeTimer);
    }

    // Define flag de congelamento
    npc.isFrozen = true;

    // Descongela após a duração
    npc.freezeTimer = setTimeout(() => {
      if (npc && npc.isFrozen) {
        npc.isFrozen = false;
        npc.freezeTimer = undefined;
        // Define próximo movimento após descongelar
        npc.nextWanderTime = Date.now() + (npc.wanderDelay || 5000);
      }
    }, duration);
  }

  /**
   * Descongela um NPC manualmente
   */
  unfreezeNPC(npcId: string) {
    const npc = this.getNPC(npcId);
    if (!npc) return;

    // Limpa timer se existir
    if (npc.freezeTimer) {
      clearTimeout(npc.freezeTimer);
      npc.freezeTimer = undefined;
    }

    npc.isFrozen = false;
    npc.nextWanderTime = Date.now() + (npc.wanderDelay || 5000);
  }

  /**
   * Cleanup ao destruir o serviço
   */
  ngOnDestroy() {
    this.stopWandering();

    // Limpa todos os freeze timers
    this.npcs.forEach(npc => {
      if (npc.freezeTimer) {
        clearTimeout(npc.freezeTimer);
        npc.freezeTimer = undefined;
      }
    });
  }
}