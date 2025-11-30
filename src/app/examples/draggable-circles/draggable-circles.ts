import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DraggableCircle, CircleData, CirclePosition, CircleEvent } from './draggable-circle.component';

interface Circle extends CircleData {
  position: CirclePosition;
}

@Component({
  selector: 'app-draggable-circles',
  standalone: true,
  imports: [CommonModule, DraggableCircle],
  template: `
    <div class="circles-container">
      <div class="header">
        <h1>🎯 Círculos Arrastáveis (Componentizados)</h1>
        <p>Cada círculo é um componente independente com sua própria lógica encapsulada</p>
        <div class="controls">
          <button (click)="resetPositions()" class="reset-btn">
            🔄 Resetar Posições
          </button>
          <button (click)="addRandomCircle()" class="add-btn">
            ➕ Adicionar Círculo
          </button>
          <button (click)="toggleDisabled()" class="toggle-btn"
                  [class.active]="globalDisabled">
            {{ globalDisabled ? '🔓 Ativar' : '🔒 Desativar' }} Drag
          </button>
          <button (click)="toggleDebug()" class="toggle-btn"
                  [class.active]="showDebug">
            {{ showDebug ? '🔍 Debug OFF' : '🔧 Debug ON' }}
          </button>
        </div>

        <!-- Stats panel -->
        <div class="stats-panel">
          <h3>📊 Estatísticas</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Total:</span>
              <span class="stat-value">{{ circles.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Auth:</span>
              <span class="stat-value">{{ getCirclesByCategory('auth').length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Cart:</span>
              <span class="stat-value">{{ getCirclesByCategory('cart').length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Progress:</span>
              <span class="stat-value">{{ getCirclesByCategory('progress').length }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="canvas" #canvas>
        <!-- Aqui usamos o componente filho para cada círculo -->
        <draggable-circle
          *ngFor="let circle of circles; trackBy: trackByCircleId"
          [data]="circle"
          [position]="circle.position"
          [disabled]="globalDisabled"
          [container]="canvas"
          (circleEvent)="onCircleEvent($event)"
          (positionChange)="onPositionChange(circle, $event)">
        </draggable-circle>

        <!-- Info panel -->
        <div class="info-panel" *ngIf="selectedCircle">
          <h3>{{ selectedCircle.title }}</h3>
          <p>{{ selectedCircle.description }}</p>
          <p><strong>Categoria:</strong> {{ getCategoryName(selectedCircle.category) }}</p>
          <p><strong>Posição:</strong> ({{ getCirclePosition(selectedCircle.id)?.x }}, {{ getCirclePosition(selectedCircle.id)?.y }})</p>
          <div class="info-actions">
            <button (click)="centerCircle(selectedCircle.id)" class="action-btn">
              🎯 Centralizar
            </button>
            <button (click)="removeCircle(selectedCircle.id)" class="action-btn danger"
                    *ngIf="selectedCircle.id.startsWith('circle-')">
              🗑️ Remover
            </button>
          </div>
          <button (click)="closeInfo()" class="close-btn">✕</button>
        </div>

        <!-- Debug panel -->
        <div class="debug-panel" *ngIf="showDebug">
          <h4>🔧 Debug</h4>
          <div class="debug-info">
            <p><strong>Último evento:</strong> {{ getLastEventType() }}</p>
            <p><strong>Círculo ativo:</strong> {{ getLastEventCircleId() }}</p>
            <p><strong>Posição:</strong> {{ getLastEventPosition() }}</p>
            <p><strong>Total de círculos:</strong> {{ circles.length }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .circles-container {
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 20px 40px;
      background: rgba(0, 0, 0, 0.2);
      /* REMOVIDO: backdrop-filter: blur(10px); - performance issue */
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      font-weight: 700;
    }

    .header p {
      margin: 0 0 20px 0;
      opacity: 0.8;
    }

    .controls {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .reset-btn, .add-btn, .toggle-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .reset-btn {
      background: #dc3545;
      color: white;
    }

    .reset-btn:hover {
      background: #c82333;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
    }

    .add-btn {
      background: #28a745;
      color: white;
    }

    .add-btn:hover {
      background: #218838;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
    }

    .toggle-btn {
      background: #6c757d;
      color: white;
    }

    .toggle-btn:hover {
      background: #5a6268;
      transform: translateY(-2px);
    }

    .toggle-btn.active {
      background: #ffc107;
      color: #333;
    }

    .stats-panel {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 15px;
      margin-top: 10px;
    }

    .stats-panel h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 6px;
    }

    .stat-label {
      font-size: 12px;
      opacity: 0.8;
    }

    .stat-value {
      font-size: 18px;
      font-weight: bold;
      margin-top: 2px;
    }

    .canvas {
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: default;
    }

    .info-panel {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      /* REMOVIDO: backdrop-filter: blur(10px); - performance issue */
      padding: 20px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      max-width: 300px;
      z-index: 100;
    }

    .info-panel h3 {
      margin: 0 0 10px 0;
      font-size: 18px;
    }

    .info-panel p {
      margin: 0 0 8px 0;
      font-size: 14px;
      opacity: 0.9;
    }

    .info-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .action-btn {
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }

    .action-btn.danger {
      background: rgba(220, 53, 69, 0.7);
    }

    .action-btn.danger:hover {
      background: rgba(220, 53, 69, 0.9);
    }

    .close-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .debug-panel {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      /* REMOVIDO: backdrop-filter: blur(10px); - performance issue */
      padding: 15px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      min-width: 200px;
      font-size: 12px;
    }

    .debug-panel h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
    }

    .debug-info p {
      margin: 4px 0;
      opacity: 0.8;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .header {
        padding: 15px 20px;
      }

      .controls {
        flex-direction: column;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .info-panel {
        position: fixed;
        top: auto;
        bottom: 20px;
        right: 20px;
        left: 20px;
        max-width: none;
      }
    }
  `]
})
export class DraggableCircles implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLElement>;

  circles: Circle[] = [
    {
      id: 'auth-1',
      emoji: '🤖',
      category: 'auth',
      title: 'Agente de Autenticação',
      description: 'IA especializada em gerar sistemas de autenticação JWT',
      position: { x: 200, y: 150 }
    },
    {
      id: 'auth-2',
      emoji: '🔐',
      category: 'auth',
      title: 'Segurança JWT',
      description: 'Tokens seguros com expiração automática',
      position: { x: 300, y: 150 }
    },
    {
      id: 'auth-3',
      emoji: '⚡',
      category: 'auth',
      title: 'Pronto para Execução',
      description: 'Sistema configurado e pronto para gerar código',
      position: { x: 400, y: 150 }
    },
    {
      id: 'cart-1',
      emoji: '🛒',
      category: 'cart',
      title: 'Agente do Carrinho',
      description: 'IA para gerar APIs REST de e-commerce',
      position: { x: 200, y: 300 }
    },
    {
      id: 'cart-2',
      emoji: '🔄',
      category: 'cart',
      title: 'Sincronização',
      description: 'LocalStorage + Backend automático',
      position: { x: 300, y: 300 }
    },
    {
      id: 'cart-3',
      emoji: '⏳',
      category: 'cart',
      title: 'Aguardando Implementação',
      description: 'Dependências: JWT deve ser implementado primeiro',
      position: { x: 400, y: 300 }
    },
    {
      id: 'progress',
      emoji: '🎯',
      category: 'progress',
      title: 'Dashboard de Progresso',
      description: 'Visualizar métricas e status do projeto',
      position: { x: 300, y: 450 }
    }
  ];

  selectedCircle: CircleData | null = null;
  globalDisabled = false;
  showDebug = false; // Debug panel temporariamente desabilitado
  lastEvent: CircleEvent | null = null;

  ngOnInit(): void {
    this.loadPositions();
    console.log('🎯 DraggableCircles parent initialized with', this.circles.length, 'circles');
  }

  ngOnDestroy(): void {
    this.savePositions();
  }

  // Event handlers - comunicação com componentes filhos
  onCircleEvent(event: CircleEvent): void {
    this.lastEvent = event;
    console.log(`📡 Circle event received:`, event);

    switch (event.type) {
      case 'click':
        this.selectedCircle = event.circle;
        break;
      case 'dragStart':
        console.log(`🎯 Drag started: ${event.circle.id}`);
        break;
      case 'dragMove':
        // Opcional: Reações durante o movimento
        break;
      case 'dragEnd':
        console.log(`✅ Drag ended: ${event.circle.id}`);
        this.savePositions();
        break;
    }
  }

  onPositionChange(circle: Circle, newPosition: CirclePosition): void {
    circle.position = newPosition;
    console.log(`📍 Position updated: ${circle.id} -> (${newPosition.x}, ${newPosition.y})`);
  }

  // Utility methods
  trackByCircleId(index: number, circle: Circle): string {
    return circle.id;
  }

  getCirclesByCategory(category: CircleData['category']): Circle[] {
    return this.circles.filter(c => c.category === category);
  }

  getCategoryName(category: CircleData['category']): string {
    const names = {
      auth: 'Autenticação',
      cart: 'Carrinho',
      progress: 'Progresso'
    };
    return names[category];
  }

  getCirclePosition(circleId: string): CirclePosition | undefined {
    return this.circles.find(c => c.id === circleId)?.position;
  }

  // Actions
  resetPositions(): void {
    const defaultPositions = [
      { id: 'auth-1', x: 200, y: 150 },
      { id: 'auth-2', x: 300, y: 150 },
      { id: 'auth-3', x: 400, y: 150 },
      { id: 'cart-1', x: 200, y: 300 },
      { id: 'cart-2', x: 300, y: 300 },
      { id: 'cart-3', x: 400, y: 300 },
      { id: 'progress', x: 300, y: 450 }
    ];

    defaultPositions.forEach(pos => {
      const circle = this.circles.find(c => c.id === pos.id);
      if (circle) {
        circle.position = { x: pos.x, y: pos.y };
      }
    });

    this.savePositions();
    console.log('🔄 Positions reset to default');
  }

  addRandomCircle(): void {
    const emojis = ['🚀', '💡', '⭐', '🔥', '💎', '🎨', '🎵', '🎲', '🎪', '🎭'];
    const categories: CircleData['category'][] = ['auth', 'cart', 'progress'];

    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const randomId = `circle-${Date.now()}`;

    const newCircle: Circle = {
      id: randomId,
      emoji: randomEmoji,
      category: randomCategory,
      title: `Círculo Aleatório ${randomEmoji}`,
      description: 'Círculo criado dinamicamente para demonstração',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100
      }
    };

    this.circles.push(newCircle);
    console.log(`➕ New circle added: ${randomEmoji}`);
  }

  centerCircle(circleId: string): void {
    const circle = this.circles.find(c => c.id === circleId);
    if (!circle || !this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    const centerX = (canvas.clientWidth / 2) - 30;
    const centerY = (canvas.clientHeight / 2) - 30;

    circle.position = { x: centerX, y: centerY };
    console.log(`🎯 Circle ${circleId} centered at (${centerX}, ${centerY})`);
  }

  removeCircle(circleId: string): void {
    this.circles = this.circles.filter(c => c.id !== circleId);
    if (this.selectedCircle?.id === circleId) {
      this.selectedCircle = null;
    }
    console.log(`🗑️ Circle ${circleId} removed`);
  }

  toggleDisabled(): void {
    this.globalDisabled = !this.globalDisabled;
    console.log(`🔒 Global disabled: ${this.globalDisabled}`);
  }

  toggleDebug(): void {
    this.showDebug = !this.showDebug;
    console.log(`🔧 Debug mode: ${this.showDebug}`);
  }

  closeInfo(): void {
    this.selectedCircle = null;
  }

  // Debug helper methods
  getLastEventType(): string {
    return this.lastEvent?.type || 'Nenhum';
  }

  getLastEventCircleId(): string {
    return this.lastEvent?.circle?.id || 'Nenhum';
  }

  getLastEventPosition(): string {
    if (!this.lastEvent?.position) return '(0, 0)';
    return `(${this.lastEvent.position.x || 0}, ${this.lastEvent.position.y || 0})`;
  }

  // Persistence
  private loadPositions(): void {
    const saved = localStorage.getItem('draggable-circles-positions-v2');
    if (saved) {
      try {
        const positions = JSON.parse(saved);
        positions.forEach((pos: any) => {
          const circle = this.circles.find(c => c.id === pos.id);
          if (circle) {
            circle.position = { x: pos.x, y: pos.y };
          }
        });
        console.log('🔄 Positions loaded from localStorage');
      } catch (e) {
        console.warn('❌ Error loading saved positions');
      }
    }
  }

  private savePositions(): void {
    const positions = this.circles.map(c => ({
      id: c.id,
      x: c.position.x,
      y: c.position.y
    }));
    localStorage.setItem('draggable-circles-positions-v2', JSON.stringify(positions));
    console.log('💾 Positions saved to localStorage');
  }
}