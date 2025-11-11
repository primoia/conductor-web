import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { InventoryService } from './inventory.service';
import { QuestStateService } from './quest-state.service';
import { DialogueService } from './dialogue.service';
import { NpcManagerService } from './npc-manager.service';
import { InventoryItem } from '../models/inventory.models';
import { DialogueAction } from '../models/quest.models';

/**
 * Serviço de integração entre Inventário e Sistema de Quest
 * Gerencia a entrega de itens para NPCs e progressão da quest
 */
@Injectable({
  providedIn: 'root'
})
export class InventoryQuestIntegrationService {
  // Estado da integração
  private npcWaitingForItem: string | null = null;
  private expectedItemId: string | null = null;
  private isInventoryOpen = false;

  // Subjects
  private inventoryOpenSubject = new BehaviorSubject<boolean>(false);
  private itemDeliverySubject = new BehaviorSubject<{
    success: boolean;
    npcId?: string;
    itemId?: string;
    rewardItem?: InventoryItem;
  } | null>(null);

  // Observables públicos
  inventoryOpen$ = this.inventoryOpenSubject.asObservable();
  itemDelivery$ = this.itemDeliverySubject.asObservable();

  constructor(
    private inventoryService: InventoryService,
    private questStateService: QuestStateService,
    private dialogueService: DialogueService,
    private npcManagerService: NpcManagerService
  ) {
    this.initializeIntegration();

    // Injeta este serviço no DialogueService para evitar dependência circular
    setTimeout(() => {
      if (this.dialogueService && 'setInventoryIntegration' in this.dialogueService) {
        (this.dialogueService as any).setInventoryIntegration(this);
      }
    }, 0);
  }

  /**
   * Inicializa a integração entre os serviços
   */
  private initializeIntegration(): void {
    // Por enquanto, integração manual
    // TODO: Implementar observação de ações de diálogo quando o método estiver disponível
    console.log('Inventory-Quest Integration initialized');
  }

  /**
   * Processa ações de diálogo relacionadas a itens
   */
  private handleDialogueAction(action: DialogueAction | null): void {
    if (!action) return;

    switch (action.type) {
      case 'give_item':
        if (action.item) {
          this.receiveItemFromNPC(action.item, action.target);
        }
        break;

      // Outros tipos de ação podem ser adicionados aqui conforme necessário
      default:
        // Ações não relacionadas a inventário são ignoradas
        break;
    }
  }

  /**
   * NPC dá um item ao jogador
   */
  receiveItemFromNPC(itemId: string, npcId?: string): boolean {
    const success = this.inventoryService.addItem(itemId);

    if (success) {
      console.log(`📦 Recebeu ${itemId} de ${npcId || 'NPC'}`);

      // Atualiza objetivo de quest se aplicável
      const currentObjective = this.questStateService.getCurrentObjective();
      // Por enquanto, vamos apenas verificar se o objetivo atual é relevante
      const relatedObjective = currentObjective &&
        currentObjective.target === itemId ? currentObjective : undefined;

      if (relatedObjective) {
        this.questStateService.completeObjective(relatedObjective.id);
      }

      // Efeito visual/sonoro
      this.playItemReceivedEffect(itemId);
    }

    return success;
  }

  /**
   * NPC solicita um item do jogador
   */
  requestItemForNPC(itemId: string, npcId: string): void {
    console.log(`🔔 [INTEGRATION] NPC ${npcId} solicitou item: ${itemId}`);
    console.log(`🔔 [INTEGRATION] Player tem o item? ${this.inventoryService.hasItem(itemId)}`);
    this.npcWaitingForItem = npcId;
    this.expectedItemId = itemId;

    // Abre inventário para jogador selecionar item
    this.openInventoryForItemDelivery(npcId, itemId);
  }

  /**
   * Abre inventário com contexto de entrega de item
   */
  openInventoryForItemDelivery(npcId: string, expectedItemId?: string): void {
    console.log(`📂 [INTEGRATION] Abrindo inventário para entrega a ${npcId}`);
    console.log(`📂 [INTEGRATION] Item esperado: ${expectedItemId}`);
    this.npcWaitingForItem = npcId;
    this.expectedItemId = expectedItemId || null;
    this.isInventoryOpen = true;
    this.inventoryOpenSubject.next(true);

    // Destaca o item esperado se existir
    if (expectedItemId && this.inventoryService.hasItem(expectedItemId)) {
      const item = this.inventoryService.getItem(expectedItemId);
      console.log(`📂 [INTEGRATION] Item encontrado no inventário:`, item);
      if (item) {
        this.inventoryService.selectItem(item);
      }
    } else {
      console.log(`⚠️ [INTEGRATION] Item não encontrado no inventário`);
    }
  }

  /**
   * Tenta entregar um item para o NPC esperando
   */
  attemptItemDelivery(itemId: string): void {
    console.log(`📤 [INTEGRATION] ========== TENTANDO ENTREGAR ITEM ==========`);
    console.log(`📤 [INTEGRATION] Item a entregar: ${itemId}`);
    console.log(`📤 [INTEGRATION] NPC esperando: ${this.npcWaitingForItem}`);
    console.log(`📤 [INTEGRATION] Item esperado: ${this.expectedItemId}`);

    if (!this.npcWaitingForItem) {
      console.warn('❌ [INTEGRATION] Nenhum NPC esperando item');
      return;
    }

    // Verifica se é o item correto
    const isCorrectItem = !this.expectedItemId || this.expectedItemId === itemId;
    console.log(`📤 [INTEGRATION] Item correto? ${isCorrectItem}`);

    if (!isCorrectItem) {
      console.log(`❌ [INTEGRATION] ${this.npcWaitingForItem} não quer este item`);
      this.playWrongItemEffect();

      // TODO: Trigger diálogo de item errado quando o método estiver disponível
      // this.dialogueService.triggerSpecialDialogue(this.npcWaitingForItem, 'wrong_item');
      return;
    }

    // Entrega o item
    console.log(`📤 [INTEGRATION] Chamando inventoryService.giveItemToNPC(${itemId}, ${this.npcWaitingForItem})`);
    const result = this.inventoryService.giveItemToNPC(itemId, this.npcWaitingForItem);
    console.log(`📤 [INTEGRATION] Resultado:`, result);

    if (result.success) {
      console.log(`✅ [INTEGRATION] Item entregue com sucesso para ${this.npcWaitingForItem}`);
      console.log(`✅ [INTEGRATION] Item de recompensa:`, result.rewardItem);

      // Atualiza estado da quest
      this.updateQuestForItemDelivery(itemId, this.npcWaitingForItem);

      // Desbloqueia próximo NPC se houver
      if (result.rewardItem?.metadata?.unlocks) {
        console.log(`🔓 [INTEGRATION] Desbloqueando:`, result.rewardItem.metadata.unlocks);
        result.rewardItem.metadata.unlocks.forEach(unlock => {
          if (unlock.startsWith('npc_')) {
            const npcId = unlock.replace('npc_', '');
            this.npcManagerService.unlockNPC(npcId);
          }
        });
      }

      // Trigger diálogo de sucesso
      if ('triggerItemReceivedDialogue' in this.dialogueService) {
        console.log(`💬 [INTEGRATION] Triggering dialogue item_received para ${this.npcWaitingForItem}`);
        (this.dialogueService as any).triggerItemReceivedDialogue(this.npcWaitingForItem);
      }

      // Emite evento de entrega
      this.itemDeliverySubject.next({
        success: true,
        npcId: this.npcWaitingForItem,
        itemId: itemId,
        rewardItem: result.rewardItem
      });

      // Efeito visual
      this.playItemDeliveredEffect(itemId, this.npcWaitingForItem);

      // Limpa estado
      this.npcWaitingForItem = null;
      this.expectedItemId = null;
      this.closeInventory();
    } else {
      console.error(`❌ [INTEGRATION] Falha ao entregar item!`);
    }
    console.log(`📤 [INTEGRATION] ========== FIM ENTREGA ITEM ==========`);
  }

  /**
   * Atualiza objetivos de quest após entrega de item
   */
  private updateQuestForItemDelivery(itemId: string, npcId: string): void {
    // Procura objetivo relacionado ao objetivo atual
    const currentObjective = this.questStateService.getCurrentObjective();
    const deliveryObjective = currentObjective &&
      currentObjective.type === 'talk' &&
      currentObjective.target === npcId ? currentObjective : undefined;

    if (deliveryObjective) {
      this.questStateService.completeObjective(deliveryObjective.id);
    }

    // Casos especiais da quest principal
    this.handleMainQuestItemDelivery(itemId, npcId);
  }

  /**
   * Lida com entregas específicas da quest principal
   */
  private handleMainQuestItemDelivery(itemId: string, npcId: string): void {
    // Mapeamento de itens para progressão da quest
    const itemProgressionMap: Record<string, string> = {
      'primordial_code': 'librarian_activated',
      'activation_key_alpha': 'scribe_activated',
      'execution_core_beta': 'artisan_activated',
      'optimization_module_gamma': 'critic_activated',
      'synchronization_protocol_omega': 'synchronization_complete'
    };

    const progressionFlag = itemProgressionMap[itemId];
    if (progressionFlag) {
      // Armazena flag usando o método setFlag
      this.questStateService.setFlag(progressionFlag, true);

      // Ações especiais por progressão
      switch (progressionFlag) {
        case 'scribe_activated':
          this.npcManagerService.unlockNPC('requirements_scribe');
          this.npcManagerService.setNPCIndicator('requirements_scribe', 'talk');
          break;

        case 'artisan_activated':
          this.npcManagerService.unlockNPC('artisan');
          this.npcManagerService.setNPCIndicator('artisan', 'talk');
          break;

        case 'critic_activated':
          this.npcManagerService.unlockNPC('critic');
          this.npcManagerService.setNPCIndicator('critic', 'talk');
          break;

        case 'synchronization_complete':
          // Momento épico - todos os NPCs se conectam
          this.triggerSynchronizationSequence();
          break;
      }
    }
  }

  /**
   * Sequência épica de sincronização
   */
  private triggerSynchronizationSequence(): void {
    console.log('🌟 INICIANDO SINCRONIZAÇÃO DOS CONDUTORES!');

    // Coloca todos NPCs em modo "working"
    ['elder_guide', 'librarian', 'requirements_scribe', 'artisan', 'critic'].forEach(npcId => {
      this.npcManagerService.setNPCIndicator(npcId, 'working');
    });

    // Após 3 segundos, marca quest como completa
    setTimeout(() => {
      // Completa o último objetivo
      this.questStateService.completeObjective('return_to_guide');

      // Define flags importantes usando o método setFlag
      this.questStateService.setFlag('open_world_unlocked', true);
      this.questStateService.setFlag('synchronization_complete', true);

      // Concede XP final
      this.questStateService.grantXP(1000);

      console.log('✨ Sincronização completa! Você agora é um Condutor Híbrido!');
    }, 3000);
  }

  /**
   * Verifica se jogador possui item
   */
  checkIfPlayerHasItem(itemId: string): boolean {
    return this.inventoryService.hasItem(itemId);
  }

  /**
   * Abre inventário normal (sem contexto de entrega)
   */
  openInventory(): void {
    this.isInventoryOpen = true;
    this.inventoryOpenSubject.next(true);
  }

  /**
   * Fecha inventário
   */
  closeInventory(): void {
    this.isInventoryOpen = false;
    this.inventoryOpenSubject.next(false);
    this.npcWaitingForItem = null;
    this.expectedItemId = null;
  }

  /**
   * Obtém estado atual do inventário
   */
  isInventoryCurrentlyOpen(): boolean {
    return this.isInventoryOpen;
  }

  /**
   * Obtém NPC esperando item
   */
  getNPCWaitingForItem(): string | null {
    return this.npcWaitingForItem;
  }

  /**
   * Obtém item esperado
   */
  getExpectedItem(): string | null {
    return this.expectedItemId;
  }

  /**
   * Reseta integração (para novo jogo)
   */
  resetIntegration(): void {
    this.npcWaitingForItem = null;
    this.expectedItemId = null;
    this.isInventoryOpen = false;
    this.inventoryOpenSubject.next(false);
    this.itemDeliverySubject.next(null);

    // Reseta inventário
    this.inventoryService.resetInventory();
  }

  // ===== Efeitos Visuais/Sonoros =====

  private playItemReceivedEffect(itemId: string): void {
    // TODO: Integrar com sistema de áudio/visual
    console.log(`✨ Efeito: Item ${itemId} recebido!`);
  }

  private playItemDeliveredEffect(itemId: string, npcId: string): void {
    // TODO: Integrar com sistema de áudio/visual
    console.log(`🎯 Efeito: Item ${itemId} entregue para ${npcId}!`);
  }

  private playWrongItemEffect(): void {
    // TODO: Integrar com sistema de áudio/visual
    console.log(`❌ Efeito: Item incorreto!`);
  }
}