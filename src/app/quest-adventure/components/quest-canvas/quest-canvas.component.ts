import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnChanges, SimpleChanges, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NPC, Position } from '../../models/quest.models';

@Component({
  selector: 'app-quest-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="quest-canvas-container">
      <canvas #gameCanvas
              class="quest-canvas"
              [width]="canvasWidth"
              [height]="canvasHeight"
              (click)="handleCanvasClick($event)"
              (touchstart)="handleTouchStart($event)">
      </canvas>

      <!-- Indicadores flutuantes -->
      <div class="canvas-overlays">
        <!-- Indicador de exclamação -->
        <div *ngFor="let npc of npcs || []"
             class="npc-indicator"
             [class.visible]="npc.showIndicator"
             [style.left.px]="npc.position.x - 10"
             [style.top.px]="npc.position.y - 40">
          <span class="indicator-icon">!</span>
        </div>

        <!-- Labels de NPCs (HTML overlay) -->
        <div *ngFor="let npc of npcs || []"
             class="npc-label"
             [class.locked]="!npc.unlocked"
             [attr.data-npc-id]="npc.id"
             [attr.data-npc-name]="npc.unlocked ? npc.name : '???'"
             [attr.data-npc-title]="npc.unlocked ? npc.title : 'Desconhecido'"
             [style.left.px]="npc.position.x"
             [style.top.px]="npc.position.y - 30">
          <div class="npc-name">{{ npc.unlocked ? npc.name : '???' }}</div>
          <div class="npc-title">{{ npc.unlocked ? npc.title : 'Desconhecido' }}</div>
        </div>
      </div>

      <!-- Nome do local atual -->
      <div class="location-name" *ngIf="currentLocation">
        {{ currentLocation }}
      </div>
    </div>
  `,
  styleUrls: ['./quest-canvas.component.scss']
})
export class QuestCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() npcs: NPC[] | null = [];
  @Input() playerPosition: Position | null = null;
  @Input() isPlayerMoving: boolean | null = false;
  @Input() focusTarget: string | null = null;

  @Output() onCanvasClick = new EventEmitter<Position>();
  @Output() onNpcInteract = new EventEmitter<string>();
  @Output() onCanvasResize = new EventEmitter<{width: number, height: number}>();

  private ctx!: CanvasRenderingContext2D;
  canvasWidth = 1024;
  canvasHeight = 768;
  currentLocation = 'Salão da Guilda dos Condutores';

  @HostListener('window:resize')
  onWindowResize() {
    this.adjustCanvasSize();
  }

  // Sprites e imagens
  private hallBackground: HTMLImageElement | null = null;
  private playerSprite: HTMLImageElement | null = null;
  private npcSprites: Map<string, HTMLImageElement> = new Map();

  // Animação
  private animationFrame: number | null = null;
  private playerPath: Position[] = [];
  private playerAnimationStep = 0;

  // NPCs emojis como fallback
  private npcEmojis: { [key: string]: string } = {
    'elder_guide': '🧙‍♂️',
    'requirements_scribe': '📋',
    'artisan': '⚒️',
    'critic': '🎨'
  };

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    // Ajusta para tela móvel
    this.adjustCanvasSize();

    // Carrega assets
    this.loadAssets();

    // Inicia render loop
    this.startRenderLoop();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['playerPosition'] && !changes['playerPosition'].firstChange) {
      this.animatePlayerMovement();
    }

    if (changes['focusTarget'] && this.focusTarget) {
      this.focusOnTarget();
    }
  }

  private adjustCanvasSize() {
    const container = this.canvasRef.nativeElement.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // Usa toda a área disponível do navegador
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;

    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;

    // Emite evento de redimensionamento
    this.onCanvasResize.emit({
      width: this.canvasWidth,
      height: this.canvasHeight
    });
  }

  private loadAssets() {
    // Por enquanto não temos imagens, então usaremos canvas drawing e emojis
    // Quando tivermos os assets, carregaremos aqui
    this.drawInitialScene();
  }

  private startRenderLoop() {
    const render = () => {
      this.drawScene();
      this.animationFrame = requestAnimationFrame(render);
    };
    render();
  }

  private drawScene() {
    // Limpa canvas
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Desenha fundo (Salão da Guilda)
    this.drawGuildHall();

    // Desenha NPCs
    this.drawNPCs();

    // Desenha player
    if (this.playerPosition) {
      this.drawPlayer();
    }

    // Desenha efeitos especiais (focus, partículas)
    if (this.focusTarget) {
      this.drawFocusEffect();
    }
  }

  private drawGuildHall() {
    // Fundo gradiente
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    gradient.addColorStop(0, '#2a2a3e');
    gradient.addColorStop(1, '#16161d');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Piso de pedra (pattern)
    this.ctx.strokeStyle = '#444455';
    this.ctx.lineWidth = 1;
    const tileSize = 50;

    for (let x = 0; x < this.canvasWidth; x += tileSize) {
      for (let y = this.canvasHeight * 0.6; y < this.canvasHeight; y += tileSize) {
        this.ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    // Círculo de invocação no centro (melhorado)
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight * 0.7;

    // Gradiente de fundo do círculo
    const circleGradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 100);
    circleGradient.addColorStop(0, 'rgba(255, 215, 0, 0.15)');
    circleGradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.05)');
    circleGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    this.ctx.fillStyle = circleGradient;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
    this.ctx.fill();

    // Círculos concêntricos (efeito de runas gravadas)
    for (let r = 40; r <= 100; r += 30) {
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      this.ctx.strokeStyle = r === 100 ? '#FFD700' : 'rgba(255, 215, 0, 0.4)';
      this.ctx.lineWidth = r === 100 ? 3 : 1;
      this.ctx.stroke();
    }

    // Runas ao redor do círculo externo
    const runeCount = 8;
    const runeSymbols = ['✦', '◆', '✧', '◈', '✦', '◆', '✧', '◈'];
    this.ctx.font = 'bold 16px Arial';
    this.ctx.fillStyle = '#FFD700';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let i = 0; i < runeCount; i++) {
      const angle = (i / runeCount) * Math.PI * 2 - Math.PI / 2;
      const runeX = centerX + Math.cos(angle) * 100;
      const runeY = centerY + Math.sin(angle) * 100;

      // Círculo de fundo para a runa
      this.ctx.beginPath();
      this.ctx.arc(runeX, runeY, 8, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(42, 42, 62, 0.8)';
      this.ctx.fill();
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();

      // Símbolo da runa
      this.ctx.fillStyle = '#FFD700';
      this.ctx.fillText(runeSymbols[i], runeX, runeY);
    }

    // Estrela central (símbolo da guilda)
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillText('⭐', centerX, centerY);

    // Linhas conectando o centro às runas
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.2)';
    this.ctx.lineWidth = 1;
    for (let i = 0; i < runeCount; i++) {
      const angle = (i / runeCount) * Math.PI * 2 - Math.PI / 2;
      const runeX = centerX + Math.cos(angle) * 100;
      const runeY = centerY + Math.sin(angle) * 100;

      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.lineTo(runeX, runeY);
      this.ctx.stroke();
    }

    this.ctx.textAlign = 'start';
    this.ctx.textBaseline = 'alphabetic';
  }

  private drawNPCs() {
    if (!this.npcs) return;

    this.npcs.forEach(npc => {
      const { x, y } = npc.position;

      // Define opacidade baseado no estado
      // NPCs bloqueados ficam mais visíveis (0.7) para sistema de descoberta
      const isLocked = !npc.unlocked;
      const alpha = isLocked ? 0.7 : 1.0;

      // Sombra
      this.ctx.beginPath();
      this.ctx.ellipse(x, y + 20, 15, 5, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * alpha})`;
      this.ctx.fill();

      // NPC (emoji como placeholder)
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.font = '32px Arial';
      this.ctx.fillText(this.npcEmojis[npc.id] || '👤', x - 16, y + 8);
      this.ctx.restore();

      // Nome e título agora são renderizados via HTML overlay
      // Removido daqui para evitar duplicação e permitir inspeção no DevTools

      // Status indicator (apenas para NPCs desbloqueados)
      if (!isLocked && npc.status === 'available') {
        this.ctx.beginPath();
        this.ctx.arc(x + 15, y - 15, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fill();
      }

      // Indicador de interação (apenas para NPCs desbloqueados)
      if (!isLocked && npc.currentIndicator === 'talk') {
        // Círculo pulsante
        const pulseTime = Date.now() % 1000;
        const pulseScale = 1 + Math.sin(pulseTime / 1000 * Math.PI * 2) * 0.1;

        this.ctx.save();
        this.ctx.translate(x, y - 35);
        this.ctx.scale(pulseScale, pulseScale);
        this.ctx.font = '16px Arial';
        this.ctx.fillText('💬', -8, 0);
        this.ctx.restore();
      }
    });
  }

  private drawPlayer() {
    if (!this.playerPosition) return;

    const { x, y } = this.playerPosition;

    // Sombra do player
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + 20, 12, 4, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.fill();

    // Player sprite (emoji temporário)
    this.ctx.font = '28px Arial';
    this.ctx.fillText('🧙', x - 14, y + 6);

    // Indicador de seleção
    this.ctx.beginPath();
    this.ctx.arc(x, y + 25, 20, 0, Math.PI * 2);
    this.ctx.strokeStyle = '#4A90E2';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Nome "Você" ou "Iniciado"
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Iniciado', x, y - 20);
    this.ctx.textAlign = 'start';
  }

  private drawFocusEffect() {
    if (!this.focusTarget || !this.npcs) return;

    const targetNPC = this.npcs.find(npc => npc.id === this.focusTarget);
    if (!targetNPC) return;

    const { x, y } = targetNPC.position;

    // Luz direcionada
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, 100);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x - 100, y - 100, 200, 200);

    // Seta apontando
    if (this.playerPosition) {
      const angle = Math.atan2(
        y - this.playerPosition.y,
        x - this.playerPosition.x
      );

      const arrowX = this.playerPosition.x + Math.cos(angle) * 50;
      const arrowY = this.playerPosition.y + Math.sin(angle) * 50;

      this.ctx.save();
      this.ctx.translate(arrowX, arrowY);
      this.ctx.rotate(angle);

      // Desenha seta
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(-15, -10);
      this.ctx.lineTo(-15, 10);
      this.ctx.closePath();

      this.ctx.fillStyle = '#FFD700';
      this.ctx.fill();

      this.ctx.restore();
    }
  }

  private animatePlayerMovement() {
    // Implementar animação suave de movimento
    if (!this.playerPosition || !this.isPlayerMoving) return;

    // Por enquanto, movimento instantâneo
    // TODO: Implementar pathfinding e animação suave
  }

  private focusOnTarget() {
    if (!this.npcs) return;

    const targetNPC = this.npcs.find(npc => npc.id === this.focusTarget);
    if (!targetNPC) return;

    // Mostra indicador no NPC
    targetNPC.showIndicator = true;

    // Remove após alguns segundos
    setTimeout(() => {
      targetNPC.showIndicator = false;
    }, 3000);
  }

  handleCanvasClick(event: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Escala para coordenadas do canvas
    const canvasX = (x / rect.width) * this.canvasWidth;
    const canvasY = (y / rect.height) * this.canvasHeight;

    const position = { x: canvasX, y: canvasY };

    // Sempre emite o clique para o componente pai decidir o que fazer
    // (pode ser movimento normal ou interação com NPC)
    this.onCanvasClick.emit(position);
  }

  handleTouchStart(event: TouchEvent) {
    event.preventDefault();

    if (event.touches.length === 0) return;

    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Escala para coordenadas do canvas
    const canvasX = (x / rect.width) * this.canvasWidth;
    const canvasY = (y / rect.height) * this.canvasHeight;

    const position = { x: canvasX, y: canvasY };

    // Sempre emite o toque para o componente pai decidir o que fazer
    this.onCanvasClick.emit(position);
  }

  private getNPCAtPosition(position: Position): NPC | null {
    if (!this.npcs) return null;

    const threshold = 30; // Raio de clique

    for (const npc of this.npcs) {
      if (!npc.unlocked) continue;

      const distance = Math.sqrt(
        Math.pow(position.x - npc.position.x, 2) +
        Math.pow(position.y - npc.position.y, 2)
      );

      if (distance < threshold) {
        return npc;
      }
    }

    return null;
  }

  private drawInitialScene() {
    // Desenha cena inicial estática
    this.drawScene();
  }

  ngOnDestroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}