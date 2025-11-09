import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NPC, Position } from '../models/quest.models';
import npcsData from '../data/npcs.json';

@Injectable({
  providedIn: 'root'
})
export class NpcManagerService {
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
      emoji: '📋',
      title: 'O Planejador',
      position: { x: 300, y: 300 },
      unlocked: false,
      sprite: 'scribe',
      agentId: 'RequirementsAnalyst_Agent',
      greeting: 'Ah, o novo Iniciado! Prazer em conhecê-lo.',
      personality: {
        trait: 'methodical',
        greetingStyle: 'professional',
        workingPhrases: [
          'Analisando os requisitos...',
          'Estruturando o plano...',
          'Documentando cada detalhe...'
        ],
        successPhrase: 'O plano está perfeitamente estruturado!'
      },
      currentIndicator: 'none',
      dialogueTreeId: 'scribe_plan'
    },
    {
      id: 'artisan',
      name: 'Artesã',
      emoji: '⚒️',
      title: 'A Executora',
      position: { x: 700, y: 300 },
      unlocked: false,
      sprite: 'artisan',
      agentId: 'BackendDeveloper_Agent',
      greeting: 'Finalmente! Ação! Estava ficando entediada!',
      personality: {
        trait: 'energetic',
        greetingStyle: 'enthusiastic',
        workingPhrases: [
          'Mãos à obra!',
          'Isso vai ficar incrível!',
          'Forjando com paixão!'
        ],
        successPhrase: 'BOOM! Feito! Olha essa beleza!'
      },
      currentIndicator: 'none',
      dialogueTreeId: 'artisan_create'
    },
    {
      id: 'critic',
      name: 'Crítica',
      emoji: '🎨',
      title: 'A Refinadora',
      position: { x: 512, y: 200 },
      unlocked: false,
      sprite: 'critic',
      agentId: 'CodeReviewer_Agent',
      greeting: 'Eu já estava esperando você, Iniciado.',
      personality: {
        trait: 'refined',
        greetingStyle: 'elegant',
        workingPhrases: [
          'Hmm, deixe-me observar...',
          'Analisando cada detalhe...',
          'Considerando as possibilidades...'
        ],
        successPhrase: 'Agora sim! Isto é digno da nossa Guilda!'
      },
      currentIndicator: 'none',
      dialogueTreeId: 'critic_review'
    }
  ];

  // Subjects
  private npcsSubject = new BehaviorSubject<NPC[]>(this.npcs);

  // Public Observables
  npcs$ = this.npcsSubject.asObservable();

  // Configurações
  private readonly INTERACTION_RANGE = 60; // pixels

  constructor() {
    this.initializeNPCs();
  }

  /**
   * Inicializa NPCs com estado padrão
   */
  private initializeNPCs() {
    // Apenas o Guia começa desbloqueado
    this.npcs.forEach(npc => {
      if (npc.id !== 'elder_guide') {
        npc.unlocked = false;
        npc.currentIndicator = 'none';
      }
    });

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
   */
  getNPCAtPosition(position: Position): NPC | undefined {
    return this.npcs.find(npc => {
      if (!npc.unlocked) return false;

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
}