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
             [style.top.px]="npc.position.y - 40">
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
  @Input() playerName = '';
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
    'requirements_scribe': '👨‍💼',
    'artisan': '👩‍🔧',
    'critic': '👩‍🎨',
    'librarian': '📚'
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
    // Fundo gradiente limpo
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    gradient.addColorStop(0, '#2a2a3e');
    gradient.addColorStop(1, '#16161d');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  private drawNPCs() {
    if (!this.npcs) return;

    // Fator de escala dos personagens (deve ser o mesmo usado em drawAnimatedCharacter)
    const scale = 0.75;

    this.npcs.forEach(npc => {
      const { x, y } = npc.position;

      // Define opacidade baseado no estado
      // NPCs bloqueados ficam mais visíveis (0.7) para sistema de descoberta
      const isLocked = !npc.unlocked;
      const alpha = isLocked ? 0.7 : 1.0;

      // Sombra (ajustada para o tamanho menor)
      this.ctx.beginPath();
      this.ctx.ellipse(x, y + 20 * scale, 15 * scale, 5 * scale, 0, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * alpha})`;
      this.ctx.fill();

      // Cores por NPC
      const npcColors: { [key: string]: string } = {
        'elder_guide': '#9370DB',      // Roxo para o guia
        'requirements_scribe': '#4682B4', // Azul para o planejador
        'artisan': '#FF6347',          // Vermelho para a executora
        'critic': '#FFB6C1',           // Rosa para a refinadora
        'librarian': '#8B4513'         // Marrom para bibliotecária
      };

      // Desenha NPC animado (idle animation)
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      const color = npcColors[npc.id] || '#808080';
      this.drawAnimatedCharacter(x, y, color, false, npc.id);
      this.ctx.restore();

      // Status indicator (apenas para NPCs desbloqueados)
      if (!isLocked && npc.status === 'available') {
        this.ctx.beginPath();
        this.ctx.arc(x + 15 * scale, y - 15 * scale, 5 * scale, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fill();
      }

      // Indicador de interação (apenas para NPCs desbloqueados)
      if (!isLocked && npc.currentIndicator === 'talk') {
        // Círculo pulsante
        const pulseTime = Date.now() % 1000;
        const pulseScale = 1 + Math.sin(pulseTime / 1000 * Math.PI * 2) * 0.1;

        this.ctx.save();
        this.ctx.translate(x, y - 35 * scale);
        this.ctx.scale(pulseScale * scale, pulseScale * scale);
        this.ctx.font = '16px Arial';
        this.ctx.fillText('💬', -8, 0);
        this.ctx.restore();
      }
    });
  }

  private drawPlayer() {
    if (!this.playerPosition) return;

    const { x, y } = this.playerPosition;
    const scale = 0.75; // Mesma escala usada nos NPCs

    // Sombra do player (ajustada)
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + 20 * scale, 12 * scale, 4 * scale, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.fill();

    // Desenha player animado estilo minion
    const isMoving = this.isPlayerMoving || false;
    this.drawAnimatedCharacter(x, y, '#4169E1', isMoving);

    // Nome do player (ajustado para a nova altura)
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.playerName || 'Iniciado', x, y - 35 * scale);
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

  /**
   * Desenha personagem animado estilo robô tech com corpo, braços e pernas
   */
  private drawAnimatedCharacter(x: number, y: number, color: string, isWalking: boolean, id?: string) {
    const time = Date.now();

    // Fator de escala para reduzir o tamanho dos personagens (0.75 = 25% menor)
    const scale = 0.75;

    // Animação de caminhada ou idle
    let armSwing = 0;
    let legSwing = 0;
    let bodyBounce = 0;
    let antennaWave = 0;

    if (isWalking) {
      // Animação de caminhada
      armSwing = Math.sin(time / 150) * 15;
      legSwing = Math.sin(time / 150) * 20;
      bodyBounce = Math.abs(Math.sin(time / 150)) * 2 * scale;
      antennaWave = Math.sin(time / 200) * 8;
    } else {
      // Animação idle (respiração e movimento sutil)
      const idleOffset = id ? this.getIdleOffset(id) : 0;
      armSwing = Math.sin((time + idleOffset) / 1000) * 5;
      bodyBounce = Math.sin((time + idleOffset) / 1500) * 1.5 * scale;
      legSwing = Math.sin((time + idleOffset) / 2000) * 3;
      antennaWave = Math.sin((time + idleOffset) / 1200) * 5;
    }

    const bodyY = y - bodyBounce;

    this.ctx.save();

    // Corpo (retângulo arredondado tech)
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5 * scale;

    // Corpo principal (reduzido)
    this.ctx.beginPath();
    this.ctx.roundRect(x - 12 * scale, bodyY - 10 * scale, 24 * scale, 28 * scale, 4 * scale);
    this.ctx.fill();
    this.ctx.stroke();

    // Painel/Tela no peito (display tech)
    const gradient = this.ctx.createLinearGradient(x - 8 * scale, bodyY, x + 8 * scale, bodyY + 10 * scale);
    gradient.addColorStop(0, '#00FFFF');
    gradient.addColorStop(1, '#0080FF');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.roundRect(x - 8 * scale, bodyY, 16 * scale, 10 * scale, 2 * scale);
    this.ctx.fill();

    // Linhas de código no display (piscando)
    this.ctx.strokeStyle = '#003366';
    this.ctx.lineWidth = 1 * scale;
    const lineOffset = (time % 1000) / 100;
    for (let i = 0; i < 3; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x - 6 * scale, bodyY + 2 * scale + i * 3 * scale);
      this.ctx.lineTo(x + 6 * scale - (i === Math.floor(lineOffset) ? 4 * scale : 0), bodyY + 2 * scale + i * 3 * scale);
      this.ctx.stroke();
    }

    // Juntas/Parafusos
    this.ctx.fillStyle = '#333333';
    [[-10, -8], [10, -8], [-10, 16], [10, 16]].forEach(([ox, oy]) => {
      this.ctx.beginPath();
      this.ctx.arc(x + ox * scale, bodyY + oy * scale, 2 * scale, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Braço esquerdo (mecânico)
    this.ctx.save();
    this.ctx.translate(x - 12 * scale, bodyY);
    this.ctx.rotate((armSwing * Math.PI) / 180);

    // Braço superior
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5 * scale;
    this.ctx.beginPath();
    this.ctx.roundRect(-2 * scale, 0, 4 * scale, 12 * scale, 1 * scale);
    this.ctx.fill();
    this.ctx.stroke();

    // Articulação
    this.ctx.fillStyle = '#666666';
    this.ctx.beginPath();
    this.ctx.arc(0, 6 * scale, 2.5 * scale, 0, Math.PI * 2);
    this.ctx.fill();

    // Mão/Garra
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(0, 12 * scale, 3 * scale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Braço direito (mecânico)
    this.ctx.save();
    this.ctx.translate(x + 12 * scale, bodyY);
    this.ctx.rotate((-armSwing * Math.PI) / 180);

    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5 * scale;
    this.ctx.beginPath();
    this.ctx.roundRect(-2 * scale, 0, 4 * scale, 12 * scale, 1 * scale);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#666666';
    this.ctx.beginPath();
    this.ctx.arc(0, 6 * scale, 2.5 * scale, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(0, 12 * scale, 3 * scale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Perna esquerda (mecânica)
    this.ctx.save();
    this.ctx.translate(x - 6 * scale, bodyY + 18 * scale);
    this.ctx.rotate((-legSwing * Math.PI) / 180);

    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5 * scale;
    this.ctx.beginPath();
    this.ctx.roundRect(-2 * scale, 0, 4 * scale, 10 * scale, 1 * scale);
    this.ctx.fill();
    this.ctx.stroke();

    // Pé (base retangular)
    this.ctx.beginPath();
    this.ctx.roundRect(-4 * scale, 10 * scale, 7 * scale, 3 * scale, 1 * scale);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Perna direita (mecânica)
    this.ctx.save();
    this.ctx.translate(x + 6 * scale, bodyY + 18 * scale);
    this.ctx.rotate((legSwing * Math.PI) / 180);

    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5 * scale;
    this.ctx.beginPath();
    this.ctx.roundRect(-2 * scale, 0, 4 * scale, 10 * scale, 1 * scale);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.roundRect(-3 * scale, 10 * scale, 7 * scale, 3 * scale, 1 * scale);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // Cabeça (retângulo arredondado)
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5 * scale;
    this.ctx.beginPath();
    this.ctx.roundRect(x - 10 * scale, bodyY - 30 * scale, 20 * scale, 18 * scale, 3 * scale);
    this.ctx.fill();
    this.ctx.stroke();

    // Viseira/Display dos olhos (efeito tech)
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.beginPath();
    this.ctx.roundRect(x - 8 * scale, bodyY - 26 * scale, 16 * scale, 8 * scale, 2 * scale);
    this.ctx.fill();

    // Olhos digitais (pontos brilhantes)
    const eyeGlow = Math.sin(time / 300) * 0.3 + 0.7;
    this.ctx.fillStyle = `rgba(0, 255, 255, ${eyeGlow})`;
    this.ctx.shadowColor = '#00FFFF';
    this.ctx.shadowBlur = 5 * scale;

    const eyeDirection = isWalking ? Math.sin(time / 500) * 1.5 : 0;
    this.ctx.beginPath();
    this.ctx.arc(x - 4 * scale + eyeDirection, bodyY - 22 * scale, 2 * scale, 0, Math.PI * 2);
    this.ctx.arc(x + 4 * scale + eyeDirection, bodyY - 22 * scale, 2 * scale, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Antena no topo
    this.ctx.save();
    this.ctx.translate(x, bodyY - 30 * scale);
    this.ctx.rotate((antennaWave * Math.PI) / 180);

    // Haste da antena
    this.ctx.strokeStyle = '#666666';
    this.ctx.lineWidth = 1.5 * scale;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(0, -8 * scale);
    this.ctx.stroke();

    // Luz piscante no topo
    const blinkPhase = Math.floor((time / 500) % 2);
    this.ctx.fillStyle = blinkPhase === 0 ? '#00FF00' : '#00AA00';
    this.ctx.shadowColor = '#00FF00';
    this.ctx.shadowBlur = blinkPhase === 0 ? 8 * scale : 3 * scale;
    this.ctx.beginPath();
    this.ctx.arc(0, -8 * scale, 3 * scale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.restore();

    // Indicador de status (LED no canto)
    const statusColor = isWalking ? '#00FF00' : '#FFD700';
    this.ctx.fillStyle = statusColor;
    this.ctx.shadowColor = statusColor;
    this.ctx.shadowBlur = 4 * scale;
    this.ctx.beginPath();
    this.ctx.arc(x + 8 * scale, bodyY - 28 * scale, 1.5 * scale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;

    this.ctx.restore();
  }

  /**
   * Retorna um offset único para cada NPC para sincronização de animação idle
   */
  private getIdleOffset(id: string): number {
    const offsets: { [key: string]: number } = {
      'elder_guide': 0,
      'requirements_scribe': 500,
      'artisan': 1000,
      'critic': 1500,
      'librarian': 2000
    };
    return offsets[id] || 0;
  }

  ngOnDestroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}