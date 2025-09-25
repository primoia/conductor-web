import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CircleData {
  id: string;
  emoji: string;
  category: 'auth' | 'cart' | 'progress';
  title: string;
  description: string;
}

export interface CirclePosition {
  x: number;
  y: number;
}

export interface CircleEvent {
  circle: CircleData;
  position: CirclePosition;
  type: 'click' | 'doubleClick' | 'dragStart' | 'dragMove' | 'dragEnd';
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  hasMoved: boolean;
}

@Component({
  selector: 'draggable-circle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="draggable-circle"
         [class.dragging]="dragState.isDragging"
         [class.no-transition]="dragState.isDragging"
         [style.left.px]="position.x"
         [style.top.px]="position.y"
         [attr.data-manual]="isManualAgent"
         [title]="data.title"
         (mousedown)="onMouseDown($event)"
         (click)="onCircleClick($event)"
         (dblclick)="onCircleDoubleClick($event)">
      {{ data.emoji }}
    </div>
  `,
  styles: [`
    .draggable-circle {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: grab;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10;

      /* Força fontes de emoji para renderização correta */
      font-family: 'emoji', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif !important;

      /* No background, just the emoji */
      background: transparent;
      border: none;

      /* Add subtle hover effects */
      filter: drop-shadow(0 0 0 transparent);
    }

    .draggable-circle:hover {
      transform: scale(1.15);
      z-index: 20;

      /* Subtle glow effect on hover */
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))
              drop-shadow(0 0 15px rgba(255, 255, 255, 0.4))
              brightness(1.1);
    }

    .draggable-circle:active,
    .draggable-circle.dragging {
      cursor: grabbing !important;
      transform: scale(1.2) !important;
      z-index: 30 !important;

      /* More pronounced glow when dragging */
      filter: drop-shadow(0 0 12px rgba(255, 255, 255, 1))
              drop-shadow(0 0 20px rgba(255, 255, 255, 0.6))
              brightness(1.2) !important;
      transition: none !important;
    }

    /* No transition class for smooth dragging */
    .no-transition {
      transition: none !important;
    }

    /* Responsive font sizes */
    @media (max-width: 768px) {
      .draggable-circle {
        font-size: 20px;
      }
    }

    @media (min-width: 1200px) {
      .draggable-circle {
        font-size: 28px;
      }
    }

    /* Special animation for manual agents */
    .draggable-circle[data-manual="true"] {
      animation: subtlePulse 3s ease-in-out infinite;
    }

    @keyframes subtlePulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    /* Hover states for different contexts */
    .draggable-circle:hover::after {
      content: '';
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      pointer-events: none;
      opacity: 0;
      animation: fadeIn 0.2s ease forwards;
    }

    @keyframes fadeIn {
      to { opacity: 1; }
    }
  `]
})
export class DraggableCircle implements OnInit, OnDestroy {
  // Inputs - dados que o componente recebe do pai
  @Input() data!: CircleData;
  @Input() position: CirclePosition = { x: 0, y: 0 };
  @Input() disabled: boolean = false;
  @Input() container?: HTMLElement;

  // Outputs - eventos que o componente emite para o pai
  @Output() circleEvent = new EventEmitter<CircleEvent>();
  @Output() positionChange = new EventEmitter<CirclePosition>();

  // Estado interno do drag (encapsulado)
  dragState: DragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    hasMoved: false
  };

  // Referências para cleanup
  private onDocumentMouseMove = (event: MouseEvent) => this.onMouseMove(event);
  private onDocumentMouseUp = (event: MouseEvent) => this.onMouseUp(event);

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    console.log(`🎯 Circle ${this.data.id} initialized at (${this.position.x}, ${this.position.y})`);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  onMouseDown(event: MouseEvent): void {
    if (this.disabled || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.dragState = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      hasMoved: false
    };

    // Desabilitar transições CSS durante o drag
    const element = event.target as HTMLElement;
    element.style.transition = 'none';

    // Emitir evento de início do drag
    this.emitCircleEvent('dragStart');

    // Adicionar listeners globais
    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);

    console.log(`🎯 Drag iniciado: ${this.data.id}`);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.dragState.isDragging) return;

    // Verificar se houve movimento significativo
    const deltaX = Math.abs(event.clientX - this.dragState.startX);
    const deltaY = Math.abs(event.clientY - this.dragState.startY);

    if (deltaX > 5 || deltaY > 5) {
      this.dragState.hasMoved = true;
    }

    if (!this.dragState.hasMoved) return;

    event.preventDefault();

    // Usar container fornecido ou buscar automaticamente
    const container = this.container || this.findContainer();
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Calcular nova posição
    const newX = event.clientX - containerRect.left - this.dragState.offsetX;
    const newY = event.clientY - containerRect.top - this.dragState.offsetY;

    // Aplicar limites (emoji size is roughly 24-28px)
    const emojiSize = 30; // Buffer for emoji size
    const newPosition = {
      x: Math.max(0, Math.min(newX, containerRect.width - emojiSize)),
      y: Math.max(0, Math.min(newY, containerRect.height - emojiSize))
    };

    // Atualizar posição local
    this.position = newPosition;

    // Emitir mudança de posição para o pai
    this.positionChange.emit(newPosition);
    this.emitCircleEvent('dragMove');
  }

  private onMouseUp(event: MouseEvent): void {
    if (!this.dragState.isDragging) return;

    const wasDragged = this.dragState.hasMoved;
    console.log(`✅ Drag finalizado: ${this.data.id} - Moveu: ${wasDragged}`);

    // Restaurar transições
    this.restoreTransitions();

    // Cleanup listeners
    this.cleanup();

    if (wasDragged) {
      this.emitCircleEvent('dragEnd');
    }

    // Reset drag state
    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      hasMoved: false
    };
  }

  onCircleClick(event: MouseEvent): void {
    // Só executar clique se não houve drag
    if (this.dragState.hasMoved || this.disabled) return;

    event.stopPropagation();
    this.emitCircleEvent('click');
    console.log(`🖱️ Circle clicked: ${this.data.title}`);
  }

  onCircleDoubleClick(event: MouseEvent): void {
    // Só executar duplo clique se não houve drag
    if (this.dragState.hasMoved || this.disabled) return;

    event.stopPropagation();
    this.emitCircleEvent('doubleClick');
    console.log(`🖱️🖱️ Circle double-clicked: ${this.data.title}`);
  }

  // Método para atualizar posição externamente
  updatePosition(newPosition: CirclePosition): void {
    this.position = newPosition;
  }

  // Método para verificar se está sendo arrastado
  get isDragging(): boolean {
    return this.dragState.isDragging;
  }

  // Método para identificar agentes manuais
  get isManualAgent(): boolean {
    return this.data.id.startsWith('manual-agent');
  }

  // Métodos privados de utilidade
  private emitCircleEvent(type: CircleEvent['type']): void {
    this.circleEvent.emit({
      circle: this.data,
      position: this.position,
      type
    });
  }

  private findContainer(): HTMLElement | null {
    let parent = this.elementRef.nativeElement.parentElement;
    while (parent) {
      if (parent.classList.contains('canvas') ||
          parent.classList.contains('container') ||
          parent === document.body) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return document.body;
  }

  private restoreTransitions(): void {
    const element = this.elementRef.nativeElement.querySelector('.draggable-circle');
    if (element) {
      (element as HTMLElement).style.transition = '';
    }
  }

  private cleanup(): void {
    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
  }
}