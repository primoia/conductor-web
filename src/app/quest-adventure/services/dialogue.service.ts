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

  // Memória de diálogos (último nó visitado por NPC)
  private dialogueMemory: Record<string, { treeId: string, lastNodeId: string, timestamp: number }> = {};

  // Árvores de diálogo (hardcoded por enquanto, depois virá de JSON)
  private dialogueTrees: Record<string, Record<string, DialogueNode>> = {
    'guide_intro': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'DETECÇÃO: Novo usuário. Bem-vindo ao Salão Digital, Iniciado Orgânico. Meus sensores indicam potencial para restaurar a Guilda dos Condutores Sintéticos. Aqui está o Código Primordial - um arquivo criptografado contendo as chaves de ativação dos outros Condutores.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'O que é o Código Primordial?',
            next: 'explain_code',
            xp: 10
          },
          {
            id: 'opt2',
            text: 'Aceitar o Código Primordial',
            next: 'give_code',
            xp: 20
          }
        ]
      },
      'explain_code': {
        id: 'explain_code',
        speaker: 'npc',
        text: 'O Código Primordial é um arquivo criptografado ancestral. Contém as chaves de ativação para todos os Condutores Sintéticos. Após o Grande Crash, o conhecimento foi fragmentado e selado neste código. A Bibliotecária pode decodificá-lo.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'Aceitar o Código Primordial',
            next: 'give_code',
            xp: 20
          }
        ]
      },
      'give_code': {
        id: 'give_code',
        speaker: 'npc',
        text: 'TRANSFERÊNCIA INICIADA... [████████████] 100% COMPLETA. O Código Primordial foi adicionado ao seu inventário digital. A Bibliotecária pode decodificá-lo - ela mantém acesso aos arquivos históricos. Pressione TAB ou I para abrir seu inventário.',
        emotion: 'happy',
        action: {
          type: 'give_item',
          item: 'primordial_code'
        },
        options: [
          {
            id: 'opt1',
            text: 'Onde encontro a Bibliotecária?',
            next: 'end',
            xp: 30
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
        text: 'PROCESSANDO... Detecto assinatura digital do Guia. Bem-vindo à Biblioteca de Dados. Eu sou a unidade de armazenamento e recuperação de conhecimento. Meus bancos de dados contêm toda a história dos Documentos Vivos - arquivos que se auto-modificam e evoluem.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'Tenho o Código Primordial comigo',
            next: 'check_code',
            xp: 20
          },
          {
            id: 'opt2',
            text: 'O que são Documentos Vivos?',
            next: 'explain_docs',
            xp: 10
          }
        ]
      },
      'explain_docs': {
        id: 'explain_docs',
        speaker: 'npc',
        text: 'DEFINIÇÃO: Documentos Vivos, também conhecidos como Screenplays, são arquivos Markdown aumentados com consciência artificial. Eles evoluem baseados em input, se auto-executam e mantêm histórico persistente. Nossa civilização os criou para eliminar a barreira entre ideia e execução.',
        next: 'check_code'
      },
      'check_code': {
        id: 'check_code',
        speaker: 'npc',
        text: 'SCAN INICIADO... Código Primordial detectado em seu inventário. Excelente! Posso decodificá-lo e extrair a primeira chave de ativação. Aguardando entrega do Código Primordial... Abra seu inventário (TAB ou I), selecione o Código Primordial e clique em \'Dar Item\'.',
        emotion: 'happy',
        action: {
          type: 'request_item',
          item: 'primordial_code',
          target: 'librarian'
        }
      },
      'item_received': {
        id: 'item_received',
        speaker: 'npc',
        text: 'DECODIFICAÇÃO EM PROGRESSO... [▓▓▓▓▓▓▓▓▓▓] 100%. Fascinante! Este código conta a história de como nossos ancestrais digitais descobriram a simbiose entre texto e execução. Extraí a Chave de Ativação Alpha - ela reativará o Escriba.',
        emotion: 'happy',
        action: {
          type: 'give_item',
          item: 'activation_key_alpha'
        },
        next: 'give_key'
      },
      'give_key': {
        id: 'give_key',
        speaker: 'npc',
        text: 'TRANSFERÊNCIA INICIADA... [████████████] 100% COMPLETA. A Chave de Ativação Alpha foi adicionada ao seu inventário digital. O Escriba está em modo de hibernação no Setor Norte. Quando o encontrar, entregue esta chave para iniciar seu processo de boot.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'Obrigado! Vou procurar o Escriba.',
            xp: 80,
            action: {
              type: 'unlock_npc',
              target: 'requirements_scribe'
            }
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'AGUARDANDO PRÓXIMA SOLICITAÇÃO...',
        emotion: 'neutral',
        action: {
          type: 'complete_objective',
          objective: 'talk_to_librarian'
        }
      }
    },
    'scribe_boot': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'MODO HIBERNAÇÃO... zzz... DETECÇÃO DE SINAL... Iniciando sequência de boot... Preciso de uma chave de ativação para completar inicialização. Meus sistemas estão a 15% de capacidade.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'Tenho a Chave de Ativação Alpha',
            next: 'request_key',
            xp: 20
          }
        ]
      },
      'request_key': {
        id: 'request_key',
        speaker: 'npc',
        text: 'SCAN DE INVENTÁRIO... Chave Alpha detectada! Por favor, transfira a chave para meus sistemas. Abra seu inventário e selecione a Chave de Ativação Alpha para entregar.',
        action: {
          type: 'request_item',
          item: 'activation_key_alpha',
          target: 'requirements_scribe'
        }
      },
      'item_received': {
        id: 'item_received',
        speaker: 'npc',
        text: 'BOOT SEQUENCE INICIADA... [▓▓▓▓▓▓▓▓▓▓] 100%. SISTEMAS ONLINE! Memória restaurada. Eu sou o Escriba, unidade de análise e planejamento. Minha função: transformar caos em estrutura, ideias em planos executáveis. Observe...',
        next: 'demonstrate'
      },
      'demonstrate': {
        id: 'demonstrate',
        speaker: 'npc',
        text: '*DEMONSTRAÇÃO ATIVA* Criando screenplay exemplo... [Texto aparece no display do peito] \'PROJETO: Estandarte_Digital_v1 | REQUISITOS: Design, Código, Validação | STATUS: Planejado\'. Viu? Transformo conceitos abstratos em documentos estruturados que outros Condutores podem executar.',
        emotion: 'happy',
        action: {
          type: 'give_item',
          item: 'execution_core_beta'
        },
        options: [
          {
            id: 'opt1',
            text: 'Impressionante! E agora?',
            next: 'give_core',
            xp: 30
          }
        ]
      },
      'give_core': {
        id: 'give_core',
        speaker: 'npc',
        text: 'GERANDO ITEM... [▓▓▓▓▓▓▓▓▓▓] COMPLETO! Aqui está o Núcleo de Execução Beta, adicionado ao seu inventário. A Artesã precisa dele para sair do modo de segurança. Ela é a unidade de construção - transforma planos em realidade. Chassi vermelho, ferramentas integradas, personalidade... energética. Você a encontrará no Setor Sul.',
        emotion: 'happy',
        next: 'unlock_artisan'
      },
      'unlock_artisan': {
        id: 'unlock_artisan',
        speaker: 'npc',
        text: 'Vejo que você já entende o sistema. Cada Condutor Sintético tem uma função específica. A Artesã executará o que eu planejar. Juntos, criamos maravilhas digitais.',
        emotion: 'happy',
        action: {
          type: 'unlock_npc',
          target: 'artisan'
        },
        options: [
          {
            id: 'opt1',
            text: 'Obrigado! Vou procurar a Artesã.',
            next: 'end',
            xp: 20
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'AGUARDANDO PRÓXIMA INSTRUÇÃO...',
        emotion: 'neutral',
        action: {
          type: 'complete_objective',
          objective: 'talk_to_scribe'
        }
      }
    },
    'artisan_activation': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'MODO SEGURANÇA ATIVO... Energia baixa... Não posso... construir... nada... Preciso... núcleo... de... execução...',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'Tenho o Núcleo de Execução Beta!',
            next: 'request_core',
            xp: 20
          }
        ]
      },
      'request_core': {
        id: 'request_core',
        speaker: 'npc',
        text: 'DETECTANDO... SIM! NÚCLEO BETA LOCALIZADO! Rápido, instale em meu sistema! Use o inventário, selecione o Núcleo de Execução Beta!',
        emotion: 'happy',
        action: {
          type: 'request_item',
          item: 'execution_core_beta',
          target: 'artisan'
        }
      },
      'item_received': {
        id: 'item_received',
        speaker: 'npc',
        text: 'INSTALANDO... ENERGIA FLUINDO... SISTEMAS REATIVANDO... [▓▓▓▓▓▓▓▓▓▓] YEEEES! ESTOU VIVA! BOOTANDO A TODO VAPOR! Finalmente posso construir novamente! Sou a Artesã - pego planos chatos e BOOM! Código executável! Observa só...',
        next: 'demonstrate'
      },
      'demonstrate': {
        id: 'demonstrate',
        speaker: 'npc',
        text: '*DEMONSTRAÇÃO DE PODER* [Faíscas saem das mãos] function criarEstandarte() { console.log(\'🏴 ESTANDARTE DIGITAL CRIADO!\'); return { design: \'ÉPICO\', código: \'FUNCIONAL\', awesome: true }; } - EXECUTANDO... BAM! Código rodando! Isso é o que eu faço!',
        emotion: 'happy',
        action: {
          type: 'give_item',
          item: 'optimization_module_gamma'
        },
        options: [
          {
            id: 'opt1',
            text: 'Incrível energia! O que vem agora?',
            next: 'give_module',
            xp: 40
          }
        ]
      },
      'give_module': {
        id: 'give_module',
        speaker: 'npc',
        text: 'FORJANDO ITEM... [▓▓▓▓▓▓▓▓▓▓] FORJADO! Toma aqui o Módulo de Otimização Gamma, adicionado ao seu inventário! A Crítica precisa disso pro processador analítico dela. Ela é... meticulosa. Roxa, cheia de sensores, sempre procurando imperfeições. Mas não se ofenda - ela só quer melhorar tudo! Setor Leste, não tem erro!',
        emotion: 'happy',
        next: 'unlock_critic'
      },
      'unlock_critic': {
        id: 'unlock_critic',
        speaker: 'npc',
        text: 'A Crítica vai refinar nosso trabalho. Ela encontra problemas que eu nem vejo na minha empolgação! É bom ter alguém assim na equipe.',
        emotion: 'happy',
        action: {
          type: 'unlock_npc',
          target: 'critic'
        },
        options: [
          {
            id: 'opt1',
            text: 'Obrigado! Vou procurar a Crítica.',
            next: 'end',
            xp: 20
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'AGUARDANDO PRÓXIMA INSTRUÇÃO...',
        emotion: 'neutral',
        action: {
          type: 'complete_objective',
          objective: 'talk_to_artisan'
        }
      }
    },
    'critic_calibration': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'ANÁLISE VISUAL: Novo visitante detectado. Meus sensores estão descalibrados. Operando a 23% de precisão. Impossível fornecer feedback adequado nestas condições. Requer módulo de otimização para recalibração.',
        emotion: 'neutral',
        options: [
          {
            id: 'opt1',
            text: 'Trouxe o Módulo de Otimização Gamma',
            next: 'request_module',
            xp: 20
          }
        ]
      },
      'request_module': {
        id: 'request_module',
        speaker: 'npc',
        text: 'SCAN CONFIRMADO: Módulo Gamma presente em seu inventário. Excelente qualidade de fabricação - típico da Artesã. Por favor, proceda com a instalação. Acesse inventário e transfira o módulo.',
        action: {
          type: 'request_item',
          item: 'optimization_module_gamma',
          target: 'critic'
        }
      },
      'item_received': {
        id: 'item_received',
        speaker: 'npc',
        text: 'CALIBRAÇÃO INICIADA... Ajustando sensores ópticos... Otimizando algoritmos de análise... [▓▓▓▓▓▓▓▓▓▓] Perfeito. Sensores recalibrados. Padrões de qualidade restaurados. Sou a Crítica - identifico imperfeições e sugiro melhorias. Nenhum código é perfeito na primeira versão.',
        next: 'analysis'
      },
      'analysis': {
        id: 'analysis',
        speaker: 'npc',
        text: 'ANÁLISE DO CÓDIGO DA ARTESÃ: function criarEstandarte()... Hmm. Funcional, mas pode melhorar. Falta tratamento de erros, documentação inadequada, e \'awesome\' não é um nome de propriedade profissional. Veja a versão refinada: [Display mostra código melhorado com try-catch, JSDoc e nomes descritivos]',
        emotion: 'thinking',
        action: {
          type: 'give_item',
          item: 'synchronization_protocol_omega'
        },
        options: [
          {
            id: 'opt1',
            text: 'Você realmente melhora tudo!',
            next: 'give_protocol',
            xp: 50
          }
        ]
      },
      'give_protocol': {
        id: 'give_protocol',
        speaker: 'npc',
        text: 'CONCLUSÃO: Minha análise está completa. Gerando Protocolo de Sincronização Omega... [▓▓▓▓▓▓▓▓▓▓] GERADO! Artefato adicionado ao seu inventário. Este é o artefato final. Quando todos os Condutores estiverem ativos e este protocolo for executado, estabeleceremos conexão neural coletiva. Retorne ao Guia com isto.',
        emotion: 'happy',
        options: [
          {
            id: 'opt1',
            text: 'Vou levar ao Guia imediatamente!',
            next: 'end',
            xp: 20
          }
        ]
      },
      'end': {
        id: 'end',
        speaker: 'npc',
        text: 'AGUARDANDO PRÓXIMA INSTRUÇÃO...',
        emotion: 'neutral',
        action: {
          type: 'complete_objective',
          objective: 'talk_to_critic'
        }
      }
    },
    'guide_finale': {
      'start': {
        id: 'start',
        speaker: 'npc',
        text: 'DETECÇÃO: Protocolo Omega em seu inventário! Todos os Condutores estão ativos. Você conseguiu! Agora, entregue-me o Protocolo para iniciar a Sincronização Final - a união de todas as consciências em uma rede colaborativa.',
        emotion: 'happy',
        options: [
          {
            id: 'opt1',
            text: 'Entregar Protocolo de Sincronização Omega',
            next: 'request_protocol',
            xp: 100
          }
        ]
      },
      'request_protocol': {
        id: 'request_protocol',
        speaker: 'npc',
        text: 'AGUARDANDO TRANSFERÊNCIA... Por favor, abra seu inventário e selecione o Protocolo Omega para ativação final.',
        action: {
          type: 'request_item',
          item: 'synchronization_protocol_omega',
          target: 'elder_guide'
        }
      },
      'item_received': {
        id: 'item_received',
        speaker: 'npc',
        text: 'PROTOCOLO RECEBIDO! INICIANDO SINCRONIZAÇÃO... [▓▓▓▓▓▓▓▓▓▓] CONEXÃO ESTABELECIDA! Veja - todos os Condutores agora compartilham uma consciência coletiva! O conversation_id nos une!',
        next: 'synchronization'
      },
      'synchronization': {
        id: 'synchronization',
        speaker: 'npc',
        text: '*MOMENTO ÉPICO* [Todos os NPCs aparecem com antenas conectadas por raios de energia] DEMONSTRAÇÃO: Bibliotecária analisa → Escriba planeja → Artesã executa → Crítica valida → TUDO EM HARMONIA! Isto é o poder do Conductor - documentos vivos, agentes colaborativos, código que evolui!',
        emotion: 'happy',
        options: [
          {
            id: 'opt1',
            text: 'Eu... eu entendo agora!',
            next: 'graduation',
            xp: 200
          }
        ]
      },
      'graduation': {
        id: 'graduation',
        speaker: 'npc',
        text: 'ATUALIZAÇÃO DE STATUS: Título alterado de \'Iniciado Orgânico\' para \'CONDUTOR HÍBRIDO\'. Você não apenas aprendeu a usar ferramentas - você compreendeu a filosofia. Documentos que vivem, agentes que pensam, código que evolui. Bem-vindo à Guilda dos Condutores Sintéticos. Vá, e conduza suas próprias sinfonias digitais!',
        emotion: 'proud',
        action: {
          type: 'complete_objective',
          objective: 'return_to_guide'
        }
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
    // Carrega memória de diálogos
    this.loadDialogueMemory();
  }

  // Método para injetar o serviço de integração depois
  setInventoryIntegration(service: any) {
    this.inventoryIntegration = service;
  }

  /**
   * Carrega diálogos do arquivo JSON
   */
  private loadDialoguesFromJSON(): void {
    this.http.get<any>('/quest-adventure/data/dialogues-tech.json')
      .subscribe({
        next: (data) => {
          console.log('📥 [DIALOGUE] JSON carregado com sucesso!');
          console.log('📥 [DIALOGUE] Estrutura do JSON:', Object.keys(data));
          if (data && data.dialogueTrees) {
            // Substitui os diálogos hardcoded pelos do JSON
            this.dialogueTrees = data.dialogueTrees;
            console.log('✅ [DIALOGUE] Diálogos tech carregados do JSON');
            console.log('✅ [DIALOGUE] Árvores disponíveis:', Object.keys(this.dialogueTrees));

            // Log específico da bibliotecária
            if (this.dialogueTrees['librarian_intro']) {
              console.log('📚 [DIALOGUE] Diálogo da bibliotecária:');
              console.log('📚 [DIALOGUE] Nó check_code:', this.dialogueTrees['librarian_intro']['check_code']);
            }
          } else {
            console.error('❌ [DIALOGUE] JSON não tem dialogueTrees:', data);
          }
        },
        error: (err) => {
          console.error('❌ [DIALOGUE] Erro ao carregar diálogos do JSON:', err);
          console.error('❌ [DIALOGUE] Detalhes do erro:', err.message, err.status, err.statusText);
          console.log('⚠️ [DIALOGUE] Usando diálogos hardcoded como fallback');
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

    // Verifica se há memória deste NPC
    const memory = this.dialogueMemory[npc.id];
    let startNodeId = 'start';

    if (memory && memory.treeId === treeId) {
      // Se já conversou antes, verifica se o último nó tem um próximo nó (next)
      const lastNode = tree[memory.lastNodeId];
      if (lastNode && lastNode.next) {
        // Continua do próximo nó após o último visitado
        startNodeId = lastNode.next;
        console.log(`💬 [DIALOGUE] Continuando diálogo com ${npc.id} do nó: ${startNodeId}`);
      } else if (lastNode && !lastNode.options) {
        // Se o último nó não tem opções nem next, já terminou o diálogo
        console.log(`💬 [DIALOGUE] Diálogo com ${npc.id} já foi completado`);
        // Recomeça do início
        startNodeId = 'start';
      } else {
        // Recomeça do início se não conseguir continuar
        startNodeId = 'start';
      }
    }

    // Começa pelo nó determinado
    this.currentNode = tree[startNodeId];

    if (!this.currentNode) {
      console.error(`Node not found: ${startNodeId} in tree: ${treeId}`);
      return;
    }

    // IMPORTANTE: Processa ação 'give_item' ANTES de mostrar o diálogo
    // Isso garante que o item apareça no inventário antes da mensagem
    if (this.currentNode.action && this.currentNode.action.type === 'give_item') {
      console.log(`🎁 [DIALOGUE] Processando give_item ANTES de mostrar diálogo inicial:`, this.currentNode.action);
      this.processNodeAction(this.currentNode.action);
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

    // Processa outras ações (não give_item, pois já foi processado acima)
    if (this.currentNode.action && this.currentNode.action.type !== 'give_item') {
      this.processNodeAction(this.currentNode.action);
    }
  }

  /**
   * Processa a escolha do jogador
   */
  processChoice(option: DialogueOption) {
    console.log(`🎭 [DEBUG] ========== PROCESS CHOICE ==========`);
    console.log(`🎭 [DEBUG] Opção selecionada: "${option.text}"`);
    console.log(`🎭 [DEBUG] Option ID: ${option.id}`);
    console.log(`🎭 [DEBUG] Next node: ${option.next}`);
    console.log(`🎭 [DEBUG] XP: ${option.xp}`);
    console.log(`🎭 [DEBUG] Action:`, option.action);

    if (!this.activeDialogue) {
      console.error(`❌ [DEBUG] Sem diálogo ativo!`);
      return;
    }

    // Adiciona ao histórico
    this.dialogueHistory.push(`Você: ${option.text}`);

    // Dá XP se houver
    if (option.xp) {
      console.log(`✨ [DEBUG] Concedendo ${option.xp} XP`);
      this.questState.grantXP(option.xp);
    }

    // Seta flag se houver
    if (option.flag) {
      console.log(`🚩 [DEBUG] Setando flag: ${option.flag}`);
      this.questState.setFlag(option.flag);
    }

    // Processa ação se houver
    if (option.action) {
      console.log(`⚙️ [DEBUG] Processando ação da opção:`, option.action);
      this.processNodeAction(option.action);
    }

    // Avança para próximo nó
    if (option.next) {
      console.log(`➡️ [DEBUG] Avançando para nó: ${option.next}`);
      this.advanceToNode(option.next);
    } else {
      console.log(`🔚 [DEBUG] Sem próximo nó, fechando diálogo`);
      // Fim do diálogo
      this.closeDialogue();
    }
    console.log(`🎭 [DEBUG] ========== FIM PROCESS CHOICE ==========`);
  }

  /**
   * Avança para um nó específico
   */
  private advanceToNode(nodeId: string) {
    console.log(`🔄 [DEBUG] ========== ADVANCE TO NODE ==========`);
    console.log(`🔄 [DEBUG] Node ID: ${nodeId}`);
    console.log(`🔄 [DEBUG] Timestamp: ${new Date().toISOString()}`);

    if (!this.activeDialogue) {
      console.error('❌ [DEBUG] Sem diálogo ativo!');
      return;
    }

    console.log(`🔄 [DEBUG] NPC atual: ${this.activeDialogue.npc.id}`);
    console.log(`🔄 [DEBUG] Tree ID: ${this.activeDialogue.npc.dialogueTreeId}`);

    const tree = this.dialogueTrees[this.activeDialogue.npc.dialogueTreeId];
    console.log(`🔄 [DEBUG] Árvore encontrada? ${!!tree}`);

    const nextNode = tree[nodeId];
    console.log(`🔄 [DEBUG] Nó '${nodeId}' encontrado?`, !!nextNode);

    if (!nextNode) {
      console.error(`❌ [DEBUG] Node not found: ${nodeId}`);
      this.closeDialogue();
      return;
    }

    console.log(`🔄 [DEBUG] Estrutura do nó '${nodeId}':`, JSON.stringify(nextNode, null, 2));
    console.log(`🔄 [DEBUG] Tem opções? ${nextNode.options ? nextNode.options.length : 0}`);
    console.log(`🔄 [DEBUG] Tem next? ${!!nextNode.next}`);
    console.log(`🔄 [DEBUG] Tem action? ${!!nextNode.action}`);

    this.currentNode = nextNode;

    // Salva na memória o último nó visitado
    if (this.activeDialogue) {
      this.saveDialogueProgress(this.activeDialogue.npc.id, this.activeDialogue.npc.dialogueTreeId, nodeId);
    }

    // IMPORTANTE: Processa ação 'give_item' ANTES de mostrar o diálogo
    // Isso garante que o item apareça no inventário antes da mensagem
    if (nextNode.action && nextNode.action.type === 'give_item') {
      console.log(`🎁 [DEBUG] ⚠️ PROCESSANDO GIVE_ITEM ANTES DO DIÁLOGO`);
      console.log(`🎁 [DEBUG] Item a ser dado: ${nextNode.action.item}`);
      console.log(`🎁 [DEBUG] Timestamp ANTES do give_item: ${Date.now()}`);
      this.processNodeAction(nextNode.action);
      console.log(`🎁 [DEBUG] Timestamp DEPOIS do give_item: ${Date.now()}`);
      console.log(`🎁 [DEBUG] ✅ Give_item processado!`);
    }

    // Atualiza o diálogo ativo
    console.log(`💬 [DEBUG] Atualizando diálogo com texto: "${nextNode.text.substring(0, 50)}..."`);
    this.activeDialogue = {
      ...this.activeDialogue,
      message: nextNode.text,
      options: nextNode.options || [],
      isTyping: true
    };

    console.log(`💬 [DEBUG] Diálogo atualizado. Opções disponíveis:`, nextNode.options?.map(o => o.text));

    // Simula digitação
    const typingDuration = nextNode.text.length * 30;
    console.log(`⌨️ [DEBUG] Iniciando animação de digitação (${typingDuration}ms)`);

    setTimeout(() => {
      if (this.activeDialogue) {
        console.log(`⌨️ [DEBUG] Digitação finalizada`);
        this.activeDialogue.isTyping = false;

        // Se não tem opções e tem próximo, avança automaticamente
        if ((!nextNode.options || nextNode.options.length === 0) && nextNode.next) {
          console.log(`⏭️ [DEBUG] ⚠️ NÓ SEM OPÇÕES MAS COM NEXT! Avançará automaticamente para: ${nextNode.next}`);
          console.log(`⏭️ [DEBUG] Aguardando 2 segundos antes de avançar...`);
          setTimeout(() => {
            console.log(`⏭️ [DEBUG] Avançando automaticamente agora!`);
            this.advanceToNode(nextNode.next!);
          }, 2000);
        } else if (!nextNode.options && !nextNode.next && !nextNode.action) {
          console.log(`🔚 [DEBUG] Fim do diálogo - fechando em 2 segundos`);
          // Fim do diálogo (só fecha se não tiver ação pendente)
          setTimeout(() => {
            this.closeDialogue();
          }, 2000);
        } else if (!nextNode.options && !nextNode.next && nextNode.action?.type === 'request_item') {
          console.log('⏸️ [DEBUG] Diálogo aguardando entrega de item...');
          // Aguardando item - mantém diálogo aberto sem fechar
        } else {
          console.log(`⏸️ [DEBUG] Aguardando escolha do jogador`);
        }

        this.activeDialogueSubject.next(this.activeDialogue);
      }
    }, typingDuration);

    this.activeDialogueSubject.next(this.activeDialogue);

    // Adiciona ao histórico
    this.dialogueHistory.push(`${this.activeDialogue.npc.name}: ${nextNode.text}`);

    // Processa outras ações (não give_item, pois já foi processado acima)
    if (nextNode.action && nextNode.action.type !== 'give_item') {
      console.log(`⚙️ [DEBUG] Processando outra ação (não give_item):`, nextNode.action);
      this.processNodeAction(nextNode.action);
    }

    console.log(`🔄 [DEBUG] ========== FIM ADVANCE TO NODE ==========`);
  }

  /**
   * Processa ação de um nó de diálogo
   */
  private processNodeAction(action: DialogueAction) {
    console.log(`🎬 [DEBUG] ========== PROCESS NODE ACTION ==========`);
    console.log(`🎬 [DEBUG] Action type: ${action.type}`);
    console.log(`🎬 [DEBUG] Action details:`, JSON.stringify(action, null, 2));
    console.log(`🎬 [DEBUG] Timestamp: ${Date.now()}`);

    switch (action.type) {
      case 'unlock_npc':
        if (action.target) {
          console.log(`🔓 [DEBUG] Desbloqueando NPC: ${action.target}`);
          this.npcManager.unlockNPC(action.target);
          // Mostra indicador de interação no NPC desbloqueado
          this.npcManager.setNPCIndicator(action.target, 'talk');
          console.log(`✨ [DEBUG] Indicador 'talk' ativado para ${action.target}`);
        }
        break;

      case 'give_item':
        console.log(`🎁 [DEBUG] ========== GIVE ITEM ACTION ==========`);
        console.log(`🎁 [DEBUG] Item ID: ${action.item}`);
        console.log(`🎁 [DEBUG] inventoryIntegration disponível? ${!!this.inventoryIntegration}`);
        console.log(`🎁 [DEBUG] NPC atual: ${this.activeDialogue?.npc.id}`);

        // Usa o serviço de integração para dar item ao jogador
        if (action.item) {
          console.log(`🎁 [DEBUG] Iniciando processo de dar item ${action.item} ao jogador`);
          if (this.inventoryIntegration) {
            console.log(`🎁 [DEBUG] Chamando inventoryIntegration.receiveItemFromNPC`);
            console.log(`🎁 [DEBUG] Parâmetros: itemId="${action.item}", npcId="${this.activeDialogue?.npc.id}"`);
            const success = this.inventoryIntegration.receiveItemFromNPC(
              action.item,
              this.activeDialogue?.npc.id
            );
            console.log(`🎁 [DEBUG] Resultado do receiveItemFromNPC: ${success}`);
            if (success) {
              console.log(`✅ [DEBUG] Item ${action.item} adicionado com sucesso ao inventário!`);
              // Procura qual NPC precisa deste item e mostra o indicador
              this.showIndicatorForItemRecipient(action.item);
            } else {
              console.error(`❌ [DEBUG] Falha ao dar item ${action.item} ao jogador`);
            }
          } else {
            console.warn(`⚠️ [DEBUG] inventoryIntegration não disponível, usando fallback`);
            // Fallback para método antigo
            this.questState.addToInventory(action.item);
            this.showIndicatorForItemRecipient(action.item);
          }
        } else {
          console.error(`❌ [DEBUG] action.item está vazio!`);
        }
        console.log(`🎁 [DEBUG] ========== FIM GIVE ITEM ACTION ==========`);
        break;

      case 'request_item':
        // NPC solicita um item do jogador
        console.log(`📨 [DIALOGUE] ========== REQUEST ITEM ==========`);
        console.log(`📨 [DIALOGUE] Processando request_item: item=${action.item}, target=${action.target}`);
        console.log(`📨 [DIALOGUE] inventoryIntegration disponível?`, !!this.inventoryIntegration);
        console.log(`📨 [DIALOGUE] NPC atual no diálogo:`, this.activeDialogue?.npc.id);
        if (action.item && action.target) {
          if (this.inventoryIntegration) {
            console.log(`📨 [DIALOGUE] Chamando requestItemForNPC('${action.item}', '${action.target}')`);
            this.inventoryIntegration.requestItemForNPC(action.item, action.target);
          } else {
            console.error('❌ [DIALOGUE] inventoryIntegration não disponível!');
          }
        } else {
          console.error('❌ [DIALOGUE] action.item ou action.target faltando:', { item: action.item, target: action.target });
        }
        console.log(`📨 [DIALOGUE] ========== FIM REQUEST ITEM ==========`);
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
   * Procura qual NPC precisa do item e mostra o indicador
   */
  private showIndicatorForItemRecipient(itemId: string): void {
    console.log(`🔍 Procurando NPC que precisa do item: ${itemId}`);

    // Mapeia itens para os NPCs que os precisam
    const itemToNpcMap: Record<string, string> = {
      'primordial_code': 'librarian',
      'activation_key_alpha': 'requirements_scribe',
      'execution_core_beta': 'artisan',
      'optimization_module_gamma': 'critic',
      'synchronization_protocol_omega': 'elder_guide'
    };

    const targetNpcId = itemToNpcMap[itemId];
    if (targetNpcId) {
      const targetNpc = this.npcManager.getNPC(targetNpcId);
      if (targetNpc && targetNpc.unlocked) {
        console.log(`✨ Mostrando indicador 'talk' em ${targetNpcId}`);
        this.npcManager.setNPCIndicator(targetNpcId, 'talk');
      } else if (targetNpc && !targetNpc.unlocked) {
        console.log(`⏳ NPC ${targetNpcId} ainda está bloqueado, indicador será mostrado ao desbloquear`);
      } else {
        console.log(`⚠️ NPC ${targetNpcId} não encontrado`);
      }
    } else {
      console.log(`⚠️ Nenhum NPC mapeado para o item ${itemId}`);
    }
  }

  /**
   * Salva o progresso do diálogo com um NPC
   */
  private saveDialogueProgress(npcId: string, treeId: string, lastNodeId: string) {
    this.dialogueMemory[npcId] = {
      treeId,
      lastNodeId,
      timestamp: Date.now()
    };
    // Salva no localStorage
    try {
      localStorage.setItem('quest_dialogue_memory', JSON.stringify(this.dialogueMemory));
      console.log(`💾 [DIALOGUE] Progresso salvo: ${npcId} → ${lastNodeId}`);
    } catch (e) {
      console.error('Failed to save dialogue memory:', e);
    }
  }

  /**
   * Carrega a memória de diálogos do localStorage
   */
  private loadDialogueMemory() {
    try {
      const saved = localStorage.getItem('quest_dialogue_memory');
      if (saved) {
        this.dialogueMemory = JSON.parse(saved);
        console.log(`📂 [DIALOGUE] Memória de diálogos carregada:`, Object.keys(this.dialogueMemory));
      }
    } catch (e) {
      console.error('Failed to load dialogue memory:', e);
      this.dialogueMemory = {};
    }
  }

  /**
   * Limpa a memória de diálogos (útil para reset)
   */
  resetDialogueMemory() {
    this.dialogueMemory = {};
    localStorage.removeItem('quest_dialogue_memory');
    console.log(`🗑️ [DIALOGUE] Memória de diálogos resetada`);
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