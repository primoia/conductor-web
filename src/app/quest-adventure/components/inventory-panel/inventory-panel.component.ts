import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../services/inventory.service';
import {
  InventoryItem,
  InventoryState,
  RARITY_COLORS,
  INVENTORY_CONFIG,
  ItemRarity
} from '../../models/inventory.models';

@Component({
  selector: 'app-inventory-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory-panel.component.html',
  styleUrls: ['./inventory-panel.component.scss']
})
export class InventoryPanelComponent implements OnInit, OnDestroy {
  @Input() initialShowDetails = true; // Controla se abre em modo lista ou grid
  @Output() itemSelected = new EventEmitter<InventoryItem>();
  @Output() itemGiven = new EventEmitter<{ item: InventoryItem, npcId: string }>();
  @Output() closed = new EventEmitter<void>();

  // Estado do inventário
  inventoryState: InventoryState | null = null;
  selectedItem: InventoryItem | null = null;
  hoveredItem: InventoryItem | null = null;

  // Grid do inventário
  inventoryGrid: (InventoryItem | null)[] = [];
  readonly slotsPerRow = INVENTORY_CONFIG.slotsPerRow;

  // Drag & Drop
  draggedItem: InventoryItem | null = null;
  dragOverSlot: number | null = null;

  // Animações
  itemAnimations: Map<string, string> = new Map();

  // Filtros
  filterType: string = 'all';
  sortBy: 'type' | 'rarity' | 'name' = 'rarity';

  // Controle de destruição
  private destroy$ = new Subject<void>();

  // Referências para cores de raridade
  readonly rarityColors = RARITY_COLORS;

  // Estado de visualização
  isMinimized = false;
  showDetails = true; // Inicia com detalhes (modo lista)

  constructor(private inventoryService: InventoryService) {}

  ngOnInit(): void {
    // Define estado inicial de visualização
    this.showDetails = this.initialShowDetails;

    // Inscreve-se no estado do inventário
    this.inventoryService.inventory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.inventoryState = state;
        this.updateInventoryGrid();
      });

    // Inscreve-se no item selecionado
    this.inventoryService.selectedItem$
      .pipe(takeUntil(this.destroy$))
      .subscribe(item => {
        this.selectedItem = item;
      });

    // Inscreve-se nas transações para animações
    this.inventoryService.lastTransaction$
      .pipe(takeUntil(this.destroy$))
      .subscribe(transaction => {
        if (transaction && transaction.type === 'receive') {
          this.playItemAddedAnimation(transaction.itemId);
        }
      });

    // Marca itens novos como vistos após 3 segundos
    setTimeout(() => {
      this.inventoryService.markAllItemsAsSeen();
    }, 3000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Atualiza o grid visual do inventário
   */
  private updateInventoryGrid(): void {
    if (!this.inventoryState) return;

    // Cria grid com slots vazios
    this.inventoryGrid = new Array(this.inventoryState.maxSlots).fill(null);

    // Preenche com itens
    this.inventoryState.items.forEach((item, index) => {
      if (index < this.inventoryState!.maxSlots) {
        this.inventoryGrid[index] = item;
      }
    });
  }

  /**
   * Seleciona um item
   */
  selectItem(item: InventoryItem | null): void {
    if (!item) return;

    this.selectedItem = item;
    this.inventoryService.selectItem(item);
    this.itemSelected.emit(item);

    // Efeito visual de seleção
    this.playSelectionAnimation(item.id);
  }

  /**
   * Double-click no item - Alterna entre grid e lista
   */
  onItemDoubleClick(item: InventoryItem | null): void {
    if (!item) return;

    // Alterna para modo grid quando double-click
    this.showDetails = false;
    this.selectItem(item);
  }

  /**
   * Hover sobre item
   */
  onItemHover(item: InventoryItem | null): void {
    this.hoveredItem = item;
  }

  /**
   * Usa um item
   */
  useItem(item: InventoryItem): void {
    // Verifica se é consumível
    if (item.type === 'consumable') {
      if (this.inventoryService.useItem(item.id)) {
        this.playUseAnimation(item.id);
      }
    }
  }

  /**
   * Destrói um item (se possível)
   */
  destroyItem(item: InventoryItem): void {
    if (!item.destroyable) {
      this.playIndestructibleAnimation(item.id);
      return;
    }

    if (confirm(`Destruir ${item.name}?`)) {
      if (this.inventoryService.removeItem(item.id)) {
        this.playDestroyAnimation(item.id);
      }
    }
  }

  /**
   * Dá um item para um NPC
   */
  giveItemToNPC(item: InventoryItem): void {
    console.log(`🎁 Botão 'Dar Item' clicado para: ${item.name}, tradeable: ${item.tradeable}`);

    if (!item.tradeable) {
      console.warn('❌ Este item não pode ser entregue');
      return;
    }

    console.log(`✅ Emitindo evento itemGiven para item: ${item.name}`);
    // Emite evento para o componente pai processar
    this.itemGiven.emit({ item, npcId: item.metadata?.npcTarget || '' });
  }

  /**
   * Drag & Drop - Inicia
   */
  onDragStart(event: DragEvent, item: InventoryItem): void {
    if (!item) return;

    this.draggedItem = item;
    this.inventoryService.startDrag(item);

    // Define dados do drag
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('text/json', JSON.stringify(item));

    // Visual feedback
    const element = event.target as HTMLElement;
    element.classList.add('dragging');
  }

  /**
   * Drag & Drop - Fim
   */
  onDragEnd(event: DragEvent): void {
    this.draggedItem = null;
    this.dragOverSlot = null;
    this.inventoryService.endDrag();

    // Remove visual feedback
    const element = event.target as HTMLElement;
    element.classList.remove('dragging');
  }

  /**
   * Drag & Drop - Sobre slot
   */
  onDragOver(event: DragEvent, slotIndex: number): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dragOverSlot = slotIndex;
  }

  /**
   * Drag & Drop - Sai do slot
   */
  onDragLeave(): void {
    this.dragOverSlot = null;
  }

  /**
   * Drag & Drop - Solta no slot
   */
  onDrop(event: DragEvent, slotIndex: number): void {
    event.preventDefault();
    this.dragOverSlot = null;

    // Por enquanto, apenas reorganização visual
    // TODO: Implementar reorganização real no serviço
    console.log(`Dropped at slot ${slotIndex}`);
  }

  /**
   * Ordena o inventário
   */
  sortInventory(): void {
    this.inventoryService.sortInventory(this.sortBy);
  }

  /**
   * Alterna ordenação
   */
  toggleSort(): void {
    const sorts: ('type' | 'rarity' | 'name')[] = ['type', 'rarity', 'name'];
    const currentIndex = sorts.indexOf(this.sortBy);
    this.sortBy = sorts[(currentIndex + 1) % sorts.length];
    this.sortInventory();
  }

  /**
   * Minimiza/maximiza o painel
   */
  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
  }

  /**
   * Alterna visualização de detalhes
   */
  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  /**
   * Fecha o inventário
   */
  close(): void {
    this.closed.emit();
  }

  /**
   * Obtém cor de raridade
   */
  getRarityColor(item: InventoryItem): string {
    return this.rarityColors[item.rarity] || '#808080';
  }

  /**
   * Obtém classe CSS de raridade
   */
  getRarityClass(item: InventoryItem): string {
    return `rarity-${item.rarity}`;
  }

  /**
   * Verifica se item está animado
   */
  isAnimated(itemId: string): boolean {
    return this.itemAnimations.has(itemId);
  }

  /**
   * Obtém animação do item
   */
  getItemAnimation(itemId: string): string {
    return this.itemAnimations.get(itemId) || '';
  }

  // ===== Animações =====

  private playItemAddedAnimation(itemId: string): void {
    this.itemAnimations.set(itemId, 'item-added');
    setTimeout(() => {
      this.itemAnimations.delete(itemId);
    }, INVENTORY_CONFIG.animationDuration);
  }

  private playSelectionAnimation(itemId: string): void {
    this.itemAnimations.set(itemId, 'item-selected');
    setTimeout(() => {
      this.itemAnimations.delete(itemId);
    }, INVENTORY_CONFIG.animationDuration);
  }

  private playUseAnimation(itemId: string): void {
    this.itemAnimations.set(itemId, 'item-used');
    setTimeout(() => {
      this.itemAnimations.delete(itemId);
    }, INVENTORY_CONFIG.animationDuration);
  }

  private playDestroyAnimation(itemId: string): void {
    this.itemAnimations.set(itemId, 'item-destroyed');
    setTimeout(() => {
      this.itemAnimations.delete(itemId);
    }, INVENTORY_CONFIG.animationDuration);
  }

  private playIndestructibleAnimation(itemId: string): void {
    this.itemAnimations.set(itemId, 'item-indestructible');
    setTimeout(() => {
      this.itemAnimations.delete(itemId);
    }, INVENTORY_CONFIG.animationDuration * 2);
  }

  /**
   * Formata quantidade para exibição
   */
  formatQuantity(item: InventoryItem): string {
    if (!item.stackable || !item.quantity || item.quantity <= 1) {
      return '';
    }
    return item.quantity > 99 ? '99+' : item.quantity.toString();
  }

  /**
   * Obtém tooltip do item
   */
  getItemTooltip(item: InventoryItem): string {
    let tooltip = `${item.name}\n${item.description}\n\nRaridade: ${item.rarity}`;

    if (!item.destroyable) {
      tooltip += '\n🔒 Indestrutível';
    }

    if (item.metadata?.npcTarget) {
      tooltip += `\n👤 Para: ${item.metadata.npcTarget}`;
    }

    return tooltip;
  }
}