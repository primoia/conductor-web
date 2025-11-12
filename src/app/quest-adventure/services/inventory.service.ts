import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  InventoryItem,
  ItemTransaction,
  InventoryState,
  ItemRequest,
  INITIAL_ITEMS,
  INVENTORY_CONFIG,
  ItemType,
  ItemRarity
} from '../models/inventory.models';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  // Estado do inventário
  private inventoryState: InventoryState = {
    items: [],
    maxSlots: INVENTORY_CONFIG.initialMaxSlots,
    usedSlots: 0,
    transactions: [],
    lockedSlots: []
  };

  // Subjects para observables
  private inventorySubject = new BehaviorSubject<InventoryState>(this.inventoryState);
  private selectedItemSubject = new BehaviorSubject<InventoryItem | null>(null);
  private transactionSubject = new BehaviorSubject<ItemTransaction | null>(null);

  // Observables públicos
  inventory$ = this.inventorySubject.asObservable();
  selectedItem$ = this.selectedItemSubject.asObservable();
  lastTransaction$ = this.transactionSubject.asObservable();

  // Item sendo arrastado (para drag & drop)
  private draggedItem: InventoryItem | null = null;

  constructor() {
    this.loadInventory();
  }

  /**
   * Inicializa o inventário (carrega do localStorage ou cria novo)
   */
  private loadInventory(): void {
    const saved = localStorage.getItem('quest_inventory');

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.inventoryState = {
          ...this.inventoryState,
          ...parsed
        };
      } catch (e) {
        console.error('Failed to load inventory:', e);
        this.initializeNewInventory();
      }
    } else {
      this.initializeNewInventory();
    }

    this.updateInventory();
  }

  /**
   * Inicializa um novo inventário vazio
   */
  private initializeNewInventory(): void {
    // Inventário começa vazio - itens são adicionados via diálogos
    this.inventoryState.items = [];
    this.inventoryState.usedSlots = 0;
  }

  /**
   * Cria um item a partir do template
   */
  private createItemFromTemplate(itemId: string): InventoryItem | null {
    const template = INITIAL_ITEMS.find(item => item.id === itemId);
    if (!template) {
      console.error(`Item template not found: ${itemId}`);
      return null;
    }

    return {
      ...template,
      quantity: 1
    } as InventoryItem;
  }

  /**
   * Adiciona um item ao inventário
   */
  addItem(itemOrId: InventoryItem | string): boolean {
    console.log(`🎒 [DEBUG] ========== ADD ITEM TO INVENTORY ==========`);
    console.log(`🎒 [DEBUG] Input: ${typeof itemOrId === 'string' ? `ID="${itemOrId}"` : `Object name="${itemOrId.name}"`}`);
    console.log(`🎒 [DEBUG] Timestamp: ${Date.now()}`);
    console.log(`🎒 [DEBUG] Slots usados: ${this.inventoryState.usedSlots}/${this.inventoryState.maxSlots}`);
    console.log(`🎒 [DEBUG] Items atuais no inventário:`, this.inventoryState.items.map(i => i.id));

    // Verifica espaço disponível
    if (this.inventoryState.usedSlots >= this.inventoryState.maxSlots) {
      console.error(`❌ [DEBUG] Inventário cheio!`);
      this.showInventoryFullAnimation();
      return false;
    }

    let item: InventoryItem | null = null;

    if (typeof itemOrId === 'string') {
      console.log(`🎒 [DEBUG] Criando item do template: ${itemOrId}`);
      item = this.createItemFromTemplate(itemOrId);
      console.log(`🎒 [DEBUG] Item criado:`, item);
    } else {
      console.log(`🎒 [DEBUG] Usando item fornecido diretamente`);
      item = itemOrId;
    }

    if (!item) {
      console.error(`❌ [DEBUG] Falha ao criar/obter item!`);
      return false;
    }

    console.log(`🎒 [DEBUG] Item a ser adicionado: ID="${item.id}", Name="${item.name}", Stackable=${item.stackable}`);

    // Se o item é stackable, verifica se já existe
    if (item.stackable) {
      console.log(`🎒 [DEBUG] Item é stackable, verificando se já existe...`);
      const existingItem = this.inventoryState.items.find(i => i.id === item!.id);
      if (existingItem) {
        console.log(`🎒 [DEBUG] Item stackable já existe, incrementando quantidade`);
        existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);

        // Limita ao máximo de stack
        if (existingItem.quantity > INVENTORY_CONFIG.maxStackSize) {
          existingItem.quantity = INVENTORY_CONFIG.maxStackSize;
        }

        this.recordTransaction({
          id: this.generateTransactionId(),
          timestamp: Date.now(),
          type: 'receive',
          itemId: item.id,
          reason: 'Item stacked'
        });

        this.updateInventory();
        console.log(`✅ [DEBUG] Item stackado com sucesso! Nova quantidade: ${existingItem.quantity}`);
        console.log(`🎒 [DEBUG] ========== FIM ADD ITEM ==========`);
        return true;
      }
      console.log(`🎒 [DEBUG] Item stackable não existe, será adicionado como novo`);
    } else {
      console.log(`🎒 [DEBUG] Item NÃO é stackable, verificando duplicação...`);
      // Se o item NÃO é stackable, verifica se já existe (evita duplicação)
      const existingItem = this.inventoryState.items.find(i => i.id === item!.id);
      if (existingItem) {
        console.warn(`⚠️ [DEBUG] Item ${item.id} já existe no inventário (não-stackable), ignorando duplicação`);
        console.log(`🎒 [DEBUG] ========== FIM ADD ITEM ==========`);
        return false; // Não adiciona duplicado
      }
      console.log(`🎒 [DEBUG] Item não-stackable não existe, será adicionado`);
    }

    // Adiciona novo item e marca como novo
    console.log(`🎒 [DEBUG] Marcando item como novo (isNew=true)`);
    item.metadata = item.metadata || {};
    item.metadata.isNew = true;

    console.log(`🎒 [DEBUG] Adicionando item ao array de itens`);
    this.inventoryState.items.push(item);
    this.inventoryState.usedSlots++;
    console.log(`✅ [DEBUG] Item adicionado! Novo total de slots usados: ${this.inventoryState.usedSlots}`);

    // Registra transação
    console.log(`🎒 [DEBUG] Registrando transação`);
    this.recordTransaction({
      id: this.generateTransactionId(),
      timestamp: Date.now(),
      type: 'receive',
      itemId: item.id,
      reason: 'Item added to inventory'
    });

    // Auto-sort se configurado
    if (INVENTORY_CONFIG.autoSort) {
      console.log(`🎒 [DEBUG] Auto-sort ativado, ordenando inventário`);
      this.sortInventory();
    }

    console.log(`🎒 [DEBUG] Atualizando observables e salvando`);
    this.updateInventory();
    console.log(`🎒 [DEBUG] Exibindo animação de item adicionado`);
    this.showItemAddedAnimation(item);

    console.log(`✅ [DEBUG] Item ${item.id} adicionado com sucesso!`);
    console.log(`🎒 [DEBUG] Items finais no inventário:`, this.inventoryState.items.map(i => `${i.id}${i.metadata?.isNew ? '(NEW)' : ''}`));
    console.log(`🎒 [DEBUG] ========== FIM ADD ITEM ==========`);
    return true;
  }

  /**
   * Remove um item do inventário
   */
  removeItem(itemId: string, quantity: number = 1): boolean {
    const item = this.inventoryState.items.find(i => i.id === itemId);

    if (!item) {
      console.warn(`Item not found: ${itemId}`);
      return false;
    }

    // Verifica se o item pode ser destruído
    if (!item.destroyable) {
      console.warn(`Item cannot be destroyed: ${itemId}`);
      this.showIndestructibleAnimation(item);
      return false;
    }

    // Se é stackable, reduz quantidade
    if (item.stackable && item.quantity && item.quantity > quantity) {
      item.quantity -= quantity;

      this.recordTransaction({
        id: this.generateTransactionId(),
        timestamp: Date.now(),
        type: 'destroy',
        itemId: item.id,
        reason: `Removed ${quantity} unit(s)`
      });
    } else {
      // Remove completamente
      const index = this.inventoryState.items.indexOf(item);
      this.inventoryState.items.splice(index, 1);
      this.inventoryState.usedSlots--;

      this.recordTransaction({
        id: this.generateTransactionId(),
        timestamp: Date.now(),
        type: 'destroy',
        itemId: item.id,
        reason: 'Item removed from inventory'
      });
    }

    this.updateInventory();
    return true;
  }

  /**
   * Dá um item para um NPC
   */
  giveItemToNPC(itemId: string, npcId: string): { success: boolean; rewardItem?: InventoryItem } {
    console.log(`🎁 [INVENTORY] ========== GIVE ITEM TO NPC ==========`);
    console.log(`🎁 [INVENTORY] Item ID: ${itemId}`);
    console.log(`🎁 [INVENTORY] NPC ID: ${npcId}`);
    console.log(`🎁 [INVENTORY] Inventário atual:`, this.inventoryState.items.map(i => i.id));

    const item = this.inventoryState.items.find(i => i.id === itemId);
    console.log(`🎁 [INVENTORY] Item encontrado:`, item);

    if (!item) {
      console.error(`❌ [INVENTORY] Item não encontrado no inventário!`);
      return { success: false };
    }

    // Verifica se o item pode ser dado
    if (!item.tradeable) {
      console.warn(`❌ [INVENTORY] Item não pode ser trocado: ${itemId}, tradeable=${item.tradeable}`);
      return { success: false };
    }
    console.log(`✅ [INVENTORY] Item é trocável (tradeable=true)`);

    // Verifica se é o NPC correto
    if (item.metadata?.npcTarget && item.metadata.npcTarget !== npcId) {
      console.log(`❌ [INVENTORY] NPC incorreto. Esperado: ${item.metadata.npcTarget}, Recebido: ${npcId}`);
      return { success: false };
    }
    console.log(`✅ [INVENTORY] NPC correto ou sem restrição de NPC`);
    console.log(`🎁 [INVENTORY] Item metadata:`, item.metadata);

    // Remove o item do inventário (exceto se indestrutível)
    if (item.destroyable) {
      console.log(`🗑️ [INVENTORY] Removendo item do inventário (destroyable=true)`);
      const index = this.inventoryState.items.indexOf(item);
      this.inventoryState.items.splice(index, 1);
      this.inventoryState.usedSlots--;
    } else {
      console.log(`🔒 [INVENTORY] Item é indestrutível, mantendo no inventário (destroyable=false)`);
    }

    // Registra transação
    this.recordTransaction({
      id: this.generateTransactionId(),
      timestamp: Date.now(),
      type: 'give',
      itemId: item.id,
      to: npcId,
      reason: `Given to ${npcId}`
    });
    console.log(`📝 [INVENTORY] Transação registrada`);

    // Se há item de recompensa, adiciona
    let rewardItem: InventoryItem | undefined;
    if (item.metadata?.unlocks && item.metadata.unlocks.length > 0) {
      console.log(`🎁 [INVENTORY] Item tem recompensas:`, item.metadata.unlocks);
      const rewardId = item.metadata.unlocks[0];
      console.log(`🎁 [INVENTORY] Criando item de recompensa: ${rewardId}`);
      rewardItem = this.createItemFromTemplate(rewardId) || undefined;

      if (rewardItem) {
        console.log(`✅ [INVENTORY] Recompensa criada:`, rewardItem);
        this.addItem(rewardItem);
        console.log(`✅ [INVENTORY] Recompensa adicionada ao inventário`);
      } else {
        console.error(`❌ [INVENTORY] Falha ao criar item de recompensa: ${rewardId}`);
      }
    } else {
      console.log(`ℹ️ [INVENTORY] Item não tem recompensas`);
    }

    this.updateInventory();
    console.log(`💾 [INVENTORY] Inventário atualizado`);
    console.log(`🎁 [INVENTORY] ========== FIM GIVE ITEM ==========`);
    return { success: true, rewardItem };
  }

  /**
   * Usa um item consumível
   */
  useItem(itemId: string): boolean {
    const item = this.inventoryState.items.find(i => i.id === itemId);

    if (!item) {
      return false;
    }

    if (item.type !== ItemType.CONSUMABLE) {
      console.warn('Item is not consumable');
      return false;
    }

    // Verifica usos restantes
    if (item.metadata?.uses !== undefined && item.metadata.maxUses) {
      if (item.metadata.uses >= item.metadata.maxUses) {
        console.warn('Item has no uses left');
        return false;
      }
      item.metadata.uses++;

      // Remove se todos os usos foram consumidos
      if (item.metadata.uses >= item.metadata.maxUses) {
        this.removeItem(itemId);
      }
    } else {
      // Item de uso único
      this.removeItem(itemId);
    }

    this.recordTransaction({
      id: this.generateTransactionId(),
      timestamp: Date.now(),
      type: 'use',
      itemId: item.id,
      reason: 'Item consumed'
    });

    this.updateInventory();
    return true;
  }

  /**
   * Seleciona um item para visualização
   */
  selectItem(item: InventoryItem | null): void {
    this.selectedItemSubject.next(item);
  }

  /**
   * Obtém um item específico
   */
  getItem(itemId: string): InventoryItem | undefined {
    return this.inventoryState.items.find(i => i.id === itemId);
  }

  /**
   * Verifica se possui um item
   */
  hasItem(itemId: string): boolean {
    return this.inventoryState.items.some(i => i.id === itemId);
  }

  /**
   * Obtém contagem de um item
   */
  getItemCount(itemId: string): number {
    const item = this.getItem(itemId);
    return item ? (item.quantity || 1) : 0;
  }

  /**
   * Marca um item como visto (não novo)
   */
  markItemAsSeen(itemId: string): void {
    const item = this.getItem(itemId);
    if (item && item.metadata?.isNew) {
      item.metadata.isNew = false;
      this.updateInventory();
    }
  }

  /**
   * Marca todos os itens como vistos
   */
  markAllItemsAsSeen(): void {
    this.inventoryState.items.forEach(item => {
      if (item.metadata?.isNew) {
        item.metadata.isNew = false;
      }
    });
    this.updateInventory();
  }

  /**
   * Ordena o inventário
   */
  sortInventory(sortBy: 'type' | 'rarity' | 'name' = 'rarity'): void {
    this.inventoryState.items.sort((a, b) => {
      switch (sortBy) {
        case 'type':
          return a.type.localeCompare(b.type);
        case 'rarity':
          const rarityOrder = Object.values(ItemRarity);
          return rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    this.updateInventory();
  }

  /**
   * Expande o inventário
   */
  expandInventory(additionalSlots: number): void {
    this.inventoryState.maxSlots += additionalSlots;
    this.updateInventory();
  }

  /**
   * Limpa o inventário (exceto itens indestrutíveis)
   */
  clearDestroyableItems(): void {
    this.inventoryState.items = this.inventoryState.items.filter(item => !item.destroyable);
    this.inventoryState.usedSlots = this.inventoryState.items.length;
    this.updateInventory();
  }

  /**
   * Obtém histórico de transações
   */
  getTransactionHistory(limit?: number): ItemTransaction[] {
    const transactions = [...this.inventoryState.transactions];
    transactions.sort((a, b) => b.timestamp - a.timestamp);

    return limit ? transactions.slice(0, limit) : transactions;
  }

  /**
   * Drag & Drop - Inicia arrastar
   */
  startDrag(item: InventoryItem): void {
    if (INVENTORY_CONFIG.dragDropEnabled) {
      this.draggedItem = item;
    }
  }

  /**
   * Drag & Drop - Para arrastar
   */
  endDrag(): void {
    this.draggedItem = null;
  }

  /**
   * Drag & Drop - Obtém item sendo arrastado
   */
  getDraggedItem(): InventoryItem | null {
    return this.draggedItem;
  }

  /**
   * Salva o inventário no localStorage
   */
  saveInventory(): void {
    try {
      localStorage.setItem('quest_inventory', JSON.stringify(this.inventoryState));
    } catch (e) {
      console.error('Failed to save inventory:', e);
    }
  }

  /**
   * Reseta o inventário
   */
  resetInventory(): void {
    localStorage.removeItem('quest_inventory');
    this.inventoryState = {
      items: [],
      maxSlots: INVENTORY_CONFIG.initialMaxSlots,
      usedSlots: 0,
      transactions: [],
      lockedSlots: []
    };
    this.initializeNewInventory();
    this.updateInventory();
  }

  // ===== Métodos Privados =====

  /**
   * Registra uma transação
   */
  private recordTransaction(transaction: ItemTransaction): void {
    this.inventoryState.transactions.push(transaction);
    this.transactionSubject.next(transaction);

    // Limita histórico a 100 transações
    if (this.inventoryState.transactions.length > 100) {
      this.inventoryState.transactions.shift();
    }
  }

  /**
   * Gera ID único para transação
   */
  private generateTransactionId(): string {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Atualiza o observable e salva
   */
  private updateInventory(): void {
    this.inventorySubject.next({ ...this.inventoryState });
    this.saveInventory();
  }

  // ===== Animações Visuais (para integrar com componente) =====

  private showItemAddedAnimation(item: InventoryItem): void {
    // Emite evento para componente visual
    console.log(`✨ Item added: ${item.name}`);
  }

  private showInventoryFullAnimation(): void {
    console.log('📦 Inventory is full!');
  }

  private showIndestructibleAnimation(item: InventoryItem): void {
    console.log(`🔒 ${item.name} cannot be destroyed!`);
  }
}