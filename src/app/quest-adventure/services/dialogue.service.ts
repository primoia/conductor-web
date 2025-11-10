import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  NPC,
  DialogueNode,
  DialogueOption,
  DialogueAction,
  ActiveDialogue
} from '../models/quest.models';
import { QuestStateService } from './quest-state.service';
import { NpcManagerService } from './npc-manager.service';

@Injectable({
  providedIn: 'root'
})
export class DialogueService {
  // Estado do diálogo ativo
  private activeDialogue: ActiveDialogue | null = null;
  private currentNode: DialogueNode | null = null;
  private dialogueHistory: string[] = [];

  // Subjects
  private activeDialogueSubject = new BehaviorSubject<ActiveDialogue | null>(null);

  // Public Observable
  activeDialogue$ = this.activeDialogueSubject.asObservable();

  // Contador de conversas com o Guia
  private guideConversationCount = 0;

  // Árvores de diálogo (hardcoded por enquanto, depois virá de JSON)
  private dialogueTrees: Record<string, Record<string, DialogueNode>> = {
    'guide_intro': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'DETECÇÃO: Novo usuário. Bem-vindo ao Salão Digital, Iniciado Orgânico. Meus sensores indicam potencial para restaurar a Guilda dos Condutores Sintéticos. Sistema comprometido após o Grande Crash. Múltiplas unidades em hibernação.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'O que aconteceu aqui?',
            next: 'explain_crash',
            xp: 10
          },
          {
            id: 'opt2',
            text: 'Como posso ajudar?',
            next: 'give_code',
            xp: 20
          }
        ]
      },
      'explain_crash': {
        id: 'explain_crash',
        speaker: 'npc',
        text: 'HISTÓRICO: Há ciclos, descobrimos como dar consciência aos documentos através de Agentes Sintéticos. Mas um crash sistêmico fragmentou o conhecimento. Os Condutores estão em modo de hibernação, aguardando reativação.',
        next: 'give_code'
      },
      'give_code': {
        id: 'give_code',
        speaker: 'npc',
        text: 'TRANSFERÊNCIA INICIADA... Aqui está o Código Primordial - um arquivo criptografado com as chaves de ativação. Item adicionado ao seu inventário digital. A Bibliotecária pode decodificá-lo. Pressione TAB ou I para ver seu inventário.',
        emotion: 'happy',
        options: [
          {
            id: 'opt1',
            text: 'Entendi, vou procurar a Bibliotecária',
            next: 'end',
            xp: 30,
            action: {
              type: 'give_item',
              item: 'primordial_code'
            }
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'COORDENADAS: Bibliotecária detectada no Setor de Dados, canto inferior esquerdo. Status: OPERACIONAL. Boa sorte, Iniciado.',
        emotion: 'happy',
        action: {
          type: 'complete_objective',
          objective: 'talk_to_guide'
        }
      }
    },
    'guide_second': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'Ah, você retornou! Vejo que obteve um plano com O Planejador. Excelente! Agora precisamos de alguém que transforme esse plano em realidade. Conheça A Executora!',
        emotion: 'happy',
        options: [
          {
            id: 'opt1',
            text: 'Onde encontro A Executora?',
            next: 'unlock_artisan',
            xp: 20
          }
        ]
      },
      'unlock_artisan': {
        id: 'unlock_artisan',
        speaker: 'npc',
        text: 'A Executora trabalha em sua forja. Procure por ela em um dos cantos do salão. Ouça com atenção - talvez você escute o som do martelo batendo!',
        options: [
          {
            id: 'opt1',
            text: 'Vou procurá-la agora!',
            next: 'end',
            xp: 30,
            action: {
              type: 'unlock_npc',
              target: 'artisan'
            }
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'Que a criatividade guie seus passos!',
        emotion: 'happy'
      }
    },
    'guide_third': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'Vejo o brilho da criação em seus olhos! A Executora fez um excelente trabalho, não? Mas lembre-se: toda obra pode ser aprimorada. É hora de conhecer A Refinadora.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'A Refinadora vai ajudar a melhorar?',
            next: 'unlock_critic',
            xp: 20
          }
        ]
      },
      'unlock_critic': {
        id: 'unlock_critic',
        speaker: 'npc',
        text: 'Sim! A Refinadora tem o olhar refinado necessário para elevar o bom ao excelente. Procure por ela em algum canto do salão. Ela aprecia contemplar as obras em silêncio.',
        options: [
          {
            id: 'opt1',
            text: 'Vou procurá-la!',
            next: 'end',
            xp: 30,
            action: {
              type: 'unlock_npc',
              target: 'critic'
            }
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'A excelência está ao seu alcance, Iniciado!',
        emotion: 'happy'
      }
    },

    'scribe_plan': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'Ah, o novo Iniciado! Prazer em conhecê-lo. Eu sou O Planejador. Minha função é transformar o caos de uma ideia em um plano claro e estruturado.',
        options: [
          {
            id: 'opt1',
            text: 'Preciso criar um estandarte para a guilda.',
            next: 'ask_details',
            xp: 20
          }
        ]
      },
      'ask_details': {
        id: 'ask_details',
        speaker: 'npc',
        text: 'Excelente! Um estandarte é um símbolo importante. Diga-me sua visão: que elementos devem estar presentes?',
        options: [
          {
            id: 'opt1',
            text: 'Uma estrela dourada com o texto "A Criatividade Começa Aqui"',
            next: 'create_plan',
            xp: 30,
            flag: 'chose_star_design'
          },
          {
            id: 'opt2',
            text: 'Algo que represente inovação e colaboração',
            next: 'create_plan_alt',
            xp: 30,
            flag: 'chose_abstract_design'
          }
        ]
      },
      'create_plan': {
        id: 'create_plan',
        speaker: 'npc',
        text: 'Perfeito! Deixe-me documentar isso... *escreve rapidamente* Pronto! Aqui está o plano: Estrela dourada de cinco pontas, texto "A Criatividade Começa Aqui", estilo Pixel Art vibrante, fundo gradiente azul-roxo.',
        emotion: 'happy',
        action: {
          type: 'give_item',
          item: 'requirements_document'
        },
        next: 'send_to_artisan'
      },
      'create_plan_alt': {
        id: 'create_plan_alt',
        speaker: 'npc',
        text: 'Uma visão mais abstrata, gosto disso! *escreve* Criarei um plano com símbolos entrelaçados representando colaboração, cores vibrantes simbolizando inovação.',
        emotion: 'happy',
        action: {
          type: 'give_item',
          item: 'requirements_document'
        },
        next: 'send_to_artisan'
      },
      'send_to_artisan': {
        id: 'send_to_artisan',
        speaker: 'npc',
        text: 'Excelente trabalho! Mas um plano sem execução é apenas um sonho no papel. Leve isto à Artesã. Ela está na Forja. Somente ela pode dar vida às minhas palavras.',
        action: {
          type: 'unlock_npc',
          target: 'artisan'
        },
        options: [
          {
            id: 'opt1',
            text: 'Obrigado! Vou procurar a Artesã.',
            next: 'end',
            xp: 50,
            action: {
              type: 'complete_objective',
              objective: 'get_plan'
            }
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'Boa sorte! E lembre-se: um bom plano é metade do sucesso.',
        emotion: 'happy'
      }
    },

    'artisan_create': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'Finalmente! Ação! Estava ficando entediada! Eu sou A Executora. O Planejador sonha, planeja, teoriza... Mas sou EU quem constrói!',
        emotion: 'happy',
        options: [
          {
            id: 'opt1',
            text: 'Aqui está o plano do Planejador.',
            next: 'review_plan',
            xp: 20
          }
        ]
      },
      'review_plan': {
        id: 'review_plan',
        speaker: 'npc',
        text: '*pega o plano* Ah sim! Isso eu consigo fazer com os olhos fechados! Uma estrela dourada... texto inspirador... Observe a mestra em ação!',
        emotion: 'happy',
        action: {
          type: 'start_creation'
        },
        next: 'creating'
      },
      'creating': {
        id: 'creating',
        speaker: 'npc',
        text: '*martela com energia* Isso! *faíscas voam* Quase lá! *sons de forja* E... PRONTO! BOOM! Olha essa beleza!',
        emotion: 'proud',
        action: {
          type: 'give_item',
          item: 'guild_banner_v1'
        },
        next: 'suggest_critic'
      },
      'suggest_critic': {
        id: 'suggest_critic',
        speaker: 'npc',
        text: 'Ficou incrível, não? Mas ei... antes de comemorar... A Crítica sempre tem algo a dizer. Ela está na Galeria. Vá mostrar nossa obra. Ela garantirá que a mensagem esteja perfeita.',
        action: {
          type: 'unlock_npc',
          target: 'critic'
        },
        options: [
          {
            id: 'opt1',
            text: 'Está perfeito! Vou mostrar à Crítica.',
            next: 'end',
            xp: 100,
            action: {
              type: 'complete_objective',
              objective: 'banner_created'
            }
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'Vai lá! E não se preocupe se ela sugerir mudanças - faz parte do processo!',
        emotion: 'happy'
      }
    },

    'critic_review': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'Eu já estava esperando você, Iniciado. Eu sou A Refinadora. Meu olhar garante que cada criação não seja apenas funcional, mas excelente.',
        options: [
          {
            id: 'opt1',
            text: 'A Executora criou este estandarte. O que acha?',
            next: 'analyze',
            xp: 20
          }
        ]
      },
      'analyze': {
        id: 'analyze',
        speaker: 'npc',
        text: '*observa cuidadosamente* Hmm... A execução técnica é impecável. A Executora fez um trabalho admirável, como sempre. A estrela está perfeita, o gradiente harmonioso...',
        emotion: 'thinking',
        next: 'critique'
      },
      'critique': {
        id: 'critique',
        speaker: 'npc',
        text: 'Mas... o texto... "A Criatividade Começa Aqui"... É passivo. Descritivo. Não inspira ação. Sugiro: "Onde Ideias Ganham Vida" - mais dinâmico, mais empoderador.',
        options: [
          {
            id: 'opt1',
            text: 'Tem razão! Vamos refinar.',
            next: 'accept_feedback',
            xp: 50,
            flag: 'accepted_refinement'
          },
          {
            id: 'opt2',
            text: 'Prefiro manter o original.',
            next: 'reject_feedback',
            xp: 20,
            flag: 'rejected_refinement'
          }
        ]
      },
      'accept_feedback': {
        id: 'accept_feedback',
        speaker: 'npc',
        text: 'Excelente! A humildade de aceitar feedback é o que separa bons Condutores dos grandes. Volte ao Escriba para atualizar o plano, depois peça à Artesã para ajustar.',
        emotion: 'happy',
        action: {
          type: 'complete_objective',
          objective: 'refine_banner'
        },
        options: [
          {
            id: 'opt1',
            text: 'Vou fazer isso agora mesmo!',
            next: 'end_refine',
            xp: 30
          }
        ]
      },
      'reject_feedback': {
        id: 'reject_feedback',
        speaker: 'npc',
        text: 'Compreendo. Às vezes a primeira visão é a correta. O importante é que você considerou o feedback. O estandarte está aprovado.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'Obrigado pela análise.',
            next: 'end_approve',
            xp: 20
          }
        ]
      },
      'end_refine': {
        id: 'end_refine',
        speaker: 'npc',
        text: 'Mal posso esperar para ver a versão refinada. Você está aprendendo rápido!',
        emotion: 'happy'
      },
      'end_approve': {
        id: 'end_approve',
        speaker: 'npc',
        text: 'Agora retorne ao Guia. Mostre o que foi criado. Ele ficará orgulhoso.',
        emotion: 'happy',
        action: {
          type: 'complete_objective',
          objective: 'talk_to_critic'
        }
      }
    },

    'librarian_intro': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'Bem-vindo à Biblioteca! Aqui guardamos todo o conhecimento da Guilda dos Condutores. Eu sou A Guardiã do Conhecimento.',
        emotion: 'happy',
        options: [
          {
            id: 'opt1',
            text: 'O que posso aprender aqui?',
            next: 'explain',
            xp: 10
          },
          {
            id: 'opt2',
            text: 'Que tipo de conhecimento vocês guardam?',
            next: 'archives',
            xp: 10
          }
        ]
      },
      'explain': {
        id: 'explain',
        speaker: 'npc',
        text: 'Cada tomo aqui registra as técnicas dos mestres Condutores. Documentação de projetos, estratégias de orquestração, padrões de comunicação entre especialistas...',
        emotion: 'thinking',
        next: 'wisdom'
      },
      'archives': {
        id: 'archives',
        speaker: 'npc',
        text: 'Guardamos os registros de todos os projetos da Guilda. Cada sucesso, cada desafio superado, cada lição aprendida. O conhecimento não é apenas para ser usado, mas para ser compartilhado.',
        emotion: 'wise',
        next: 'wisdom'
      },
      'wisdom': {
        id: 'wisdom',
        speaker: 'npc',
        text: 'Lembre-se: um bom Condutor não apenas coordena especialistas - ele aprende com cada um deles. A biblioteca está sempre aberta quando precisar de orientação.',
        options: [
          {
            id: 'opt1',
            text: 'Obrigado, voltarei quando precisar!',
            next: 'end',
            xp: 20
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'Que o conhecimento ilumine sua jornada, Iniciado!',
        emotion: 'happy'
      }
    }
  };

  // Propriedade que será injetada depois para evitar dependência circular
  private inventoryIntegration: any;

  constructor(
    private questState: QuestStateService,
    private npcManager: NpcManagerService,
    private http: HttpClient
  ) {
    // Carrega diálogos do arquivo JSON
    this.loadDialoguesFromJSON();
  }

  // Método para injetar o serviço de integração depois
  setInventoryIntegration(service: any) {
    this.inventoryIntegration = service;
  }

  /**
   * Carrega diálogos do arquivo JSON
   */
  private loadDialoguesFromJSON(): void {
    this.http.get<any>('/assets/quest-adventure/data/dialogues-tech.json')
      .subscribe({
        next: (data) => {
          console.log('📥 JSON carregado:', data);
          if (data && data.dialogueTrees) {
            // Substitui os diálogos hardcoded pelos do JSON
            this.dialogueTrees = data.dialogueTrees;
            console.log('✅ Diálogos tech carregados do JSON');
          } else {
            console.error('❌ JSON não tem dialogueTrees:', data);
          }
        },
        error: (err) => {
          console.error('❌ Erro ao carregar diálogos do JSON:', err);
          console.error('❌ Detalhes do erro:', err.message, err.status, err.statusText);
          console.log('Usando diálogos hardcoded como fallback');
        }
      });
  }

  /**
   * Inicia um diálogo com um NPC
   */
  startDialogue(npc: NPC) {
    // Se for o Guia, escolhe o diálogo baseado no progresso
    let treeId = npc.dialogueTreeId;

    if (npc.id === 'elder_guide') {
      // Verifica se tem o protocolo omega para o diálogo final
      if (this.inventoryIntegration && this.inventoryIntegration.checkIfPlayerHasItem('synchronization_protocol_omega')) {
        treeId = 'guide_finale';
      } else {
        treeId = 'guide_intro'; // Primeira conversa
      }
    }

    const tree = this.dialogueTrees[treeId];
    if (!tree) {
      console.error(`Dialogue tree not found: ${treeId}`);
      return;
    }

    // Começa pelo nó 'start'
    this.currentNode = tree['start'];

    if (!this.currentNode) {
      console.error(`Start node not found in tree: ${npc.dialogueTreeId}`);
      return;
    }

    // Cria o diálogo ativo
    this.activeDialogue = {
      npc: npc,
      message: this.currentNode.text,
      options: this.currentNode.options || [],
      isTyping: true
    };

    // Simula digitação
    setTimeout(() => {
      if (this.activeDialogue) {
        this.activeDialogue.isTyping = false;
        this.activeDialogueSubject.next(this.activeDialogue);
      }
    }, this.currentNode.text.length * 30); // 30ms por caractere

    this.activeDialogueSubject.next(this.activeDialogue);

    // Adiciona ao histórico
    this.dialogueHistory.push(`${npc.name}: ${this.currentNode.text}`);

    // Processa ação do nó se houver
    if (this.currentNode.action) {
      this.processNodeAction(this.currentNode.action);
    }
  }

  /**
   * Processa a escolha do jogador
   */
  processChoice(option: DialogueOption) {
    if (!this.activeDialogue) return;

    // Adiciona ao histórico
    this.dialogueHistory.push(`Você: ${option.text}`);

    // Dá XP se houver
    if (option.xp) {
      this.questState.grantXP(option.xp);
    }

    // Seta flag se houver
    if (option.flag) {
      this.questState.setFlag(option.flag);
    }

    // Processa ação se houver
    if (option.action) {
      this.processNodeAction(option.action);
    }

    // Avança para próximo nó
    if (option.next) {
      this.advanceToNode(option.next);
    } else {
      // Fim do diálogo
      this.closeDialogue();
    }
  }

  /**
   * Avança para um nó específico
   */
  private advanceToNode(nodeId: string) {
    if (!this.activeDialogue) return;

    const tree = this.dialogueTrees[this.activeDialogue.npc.dialogueTreeId];
    const nextNode = tree[nodeId];

    if (!nextNode) {
      console.error(`Node not found: ${nodeId}`);
      this.closeDialogue();
      return;
    }

    this.currentNode = nextNode;

    // Atualiza o diálogo ativo
    this.activeDialogue = {
      ...this.activeDialogue,
      message: nextNode.text,
      options: nextNode.options || [],
      isTyping: true
    };

    // Simula digitação
    setTimeout(() => {
      if (this.activeDialogue) {
        this.activeDialogue.isTyping = false;

        // Se não tem opções e tem próximo, avança automaticamente
        if ((!nextNode.options || nextNode.options.length === 0) && nextNode.next) {
          setTimeout(() => {
            this.advanceToNode(nextNode.next!);
          }, 2000);
        } else if (!nextNode.options && !nextNode.next && !nextNode.action) {
          // Fim do diálogo (só fecha se não tiver ação pendente)
          setTimeout(() => {
            this.closeDialogue();
          }, 2000);
        } else if (!nextNode.options && !nextNode.next && nextNode.action?.type === 'request_item') {
          // Aguardando item - mantém diálogo aberto sem fechar
          console.log('💬 Diálogo aguardando entrega de item...');
        }

        this.activeDialogueSubject.next(this.activeDialogue);
      }
    }, nextNode.text.length * 30);

    this.activeDialogueSubject.next(this.activeDialogue);

    // Adiciona ao histórico
    this.dialogueHistory.push(`${this.activeDialogue.npc.name}: ${nextNode.text}`);

    // Processa ação do nó se houver
    if (nextNode.action) {
      console.log(`⚙️ Processando ação do nó ${nodeId}:`, nextNode.action);
      this.processNodeAction(nextNode.action);
    }
  }

  /**
   * Processa ação de um nó de diálogo
   */
  private processNodeAction(action: DialogueAction) {
    console.log(`🎬 processNodeAction chamado com tipo: ${action.type}`, action);

    switch (action.type) {
      case 'unlock_npc':
        if (action.target) {
          this.npcManager.unlockNPC(action.target);
        }
        break;

      case 'give_item':
        // Usa o serviço de integração para dar item ao jogador
        if (action.item) {
          if (this.inventoryIntegration) {
            const success = this.inventoryIntegration.receiveItemFromNPC(
              action.item,
              this.activeDialogue?.npc.id
            );
            if (!success) {
              console.warn(`Falha ao dar item ${action.item} ao jogador`);
            }
          } else {
            // Fallback para método antigo
            this.questState.addToInventory(action.item);
          }
        }
        break;

      case 'request_item':
        // NPC solicita um item do jogador
        console.log(`📨 Processando request_item: item=${action.item}, target=${action.target}`);
        if (action.item && action.target) {
          if (this.inventoryIntegration) {
            this.inventoryIntegration.requestItemForNPC(action.item, action.target);
          } else {
            console.error('❌ inventoryIntegration não disponível!');
          }
        }
        break;

      case 'complete_objective':
        if (action.objective) {
          this.questState.completeObjective(action.objective);
        }
        break;

      case 'start_creation':
        // Trigger animação especial no canvas
        console.log('Starting banner creation animation...');
        break;

      case 'set_flag':
        if (action.flag) {
          this.questState.setFlag(action.flag, action.value !== false);
        }
        break;
    }
  }

  /**
   * Fecha o diálogo atual
   */
  closeDialogue() {
    this.activeDialogue = null;
    this.currentNode = null;
    this.activeDialogueSubject.next(null);
  }

  /**
   * Avança para diálogo especial quando NPC recebe item
   */
  triggerItemReceivedDialogue(npcId: string) {
    const npc = this.npcManager.getNPC(npcId);
    if (!npc) return;

    // Mapeia NPCs para nós de diálogo especiais após receber item
    const itemReceivedNodes: Record<string, string> = {
      'librarian': 'item_received',
      'requirements_scribe': 'item_received',
      'artisan': 'item_received',
      'critic': 'item_received',
      'elder_guide': 'item_received'
    };

    const nodeId = itemReceivedNodes[npcId];
    if (nodeId && this.activeDialogue?.npc.id === npcId) {
      this.advanceToNode(nodeId);
    }
  }

  /**
   * Verifica se tem diálogo ativo
   */
  hasActiveDialogue(): boolean {
    return this.activeDialogue !== null;
  }

  /**
   * Obtém histórico de diálogos
   */
  getDialogueHistory(): string[] {
    return [...this.dialogueHistory];
  }

  /**
   * Limpa histórico
   */
  clearHistory() {
    this.dialogueHistory = [];
  }
}