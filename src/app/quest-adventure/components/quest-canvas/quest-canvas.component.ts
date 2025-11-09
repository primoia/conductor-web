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
              (mousemove)="handleMouseMove($event)"
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

      <!-- Nome do local atual (oculto) -->
      <!-- <div class="location-name" *ngIf="currentLocation">
        {{ currentLocation }}
      </div> -->
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
  @Input() hoveredNpcId: string | null = null;

  @Output() onCanvasClick = new EventEmitter<Position>();
  @Output() onNpcInteract = new EventEmitter<string>();
  @Output() onPlayerClick = new EventEmitter<void>();
  @Output() onNpcHover = new EventEmitter<string | null>();
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

  // Click effects (X marks)
  private clickEffects: Array<{position: Position, timestamp: number}> = [];

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

    // Desenha efeitos de click (X marks)
    this.drawClickEffects();
  }

  private drawGuildHall() {
    // Fundo gradiente limpo
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    gradient.addColorStop(0, '#2a2a3e');
    gradient.addColorStop(1, '#16161d');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  /**
   * Desenha a zona de controle ao redor de um NPC em hover
   */
  private drawControlZone(x: number, y: number) {
    const currentTime = Date.now();
    const interactionRadius = 80;

    // Animação de pulsação
    const pulsePhase = (currentTime % 2000) / 2000; // 0 a 1
    const pulseRadius = interactionRadius + Math.sin(pulsePhase * Math.PI * 2) * 5;
    const pulseAlpha = 0.15 + Math.sin(pulsePhase * Math.PI * 2) * 0.1;

    // Círculo de zona de controle (preenchimento)
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, pulseRadius);
    gradient.addColorStop(0, `rgba(255, 215, 0, 0)`);
    gradient.addColorStop(0.7, `rgba(255, 215, 0, ${pulseAlpha})`);
    gradient.addColorStop(1, `rgba(255, 215, 0, 0)`);

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Círculo de borda pulsante
    this.ctx.strokeStyle = `rgba(255, 215, 0, ${0.4 + pulseAlpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.lineDashOffset = -currentTime / 50; // Animação de movimento
    this.ctx.beginPath();
    this.ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset dash
  }

  /**
   * Desenha indicador visual de NPC congelado
   */
  private drawFrozenIndicator(x: number, y: number) {
    const currentTime = Date.now();
    const scale = 0.75;

    // Ícone de cristal de gelo acima do NPC
    const iconY = y - 50 * scale;
    const iconSize = 16;

    // Animação de flutuação
    const floatOffset = Math.sin(currentTime / 500) * 3;

    // Brilho pulsante
    const glowAlpha = 0.5 + Math.sin(currentTime / 400) * 0.3;

    this.ctx.save();
    this.ctx.translate(x, iconY + floatOffset);

    // Sombra/brilho do ícone
    this.ctx.shadowColor = `rgba(100, 200, 255, ${glowAlpha})`;
    this.ctx.shadowBlur = 10;

    // Desenha cristal de gelo (diamante com gradiente azul)
    this.ctx.beginPath();
    this.ctx.moveTo(0, -iconSize / 2);
    this.ctx.lineTo(iconSize / 2, 0);
    this.ctx.lineTo(0, iconSize / 2);
    this.ctx.lineTo(-iconSize / 2, 0);
    this.ctx.closePath();

    const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, iconSize);
    gradient.addColorStop(0, 'rgba(200, 240, 255, 0.9)');
    gradient.addColorStop(0.5, 'rgba(100, 200, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(50, 150, 255, 0.6)');

    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Borda do cristal
    this.ctx.strokeStyle = 'rgba(150, 220, 255, 0.9)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Linhas internas do cristal
    this.ctx.strokeStyle = 'rgba(200, 240, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -iconSize / 2);
    this.ctx.lineTo(0, iconSize / 2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(-iconSize / 2, 0);
    this.ctx.lineTo(iconSize / 2, 0);
    this.ctx.stroke();

    this.ctx.restore();
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

      // Desenha zona de controle se NPC está em hover
      if (this.hoveredNpcId === npc.id) {
        this.drawControlZone(x, y);
      }

      // Indicador visual de NPC congelado
      if (npc.isFrozen) {
        this.drawFrozenIndicator(x, y);
      }

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

      // Desenha NPC animado (wandering ou idle animation)
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      const color = npcColors[npc.id] || '#808080';
      const isMoving = npc.isWandering || false;
      this.drawAnimatedCharacter(x, y, color, isMoving, npc.id);
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
    const currentTime = Date.now();

    // Aura pulsante ao redor do player (destaque)
    const pulseSize = Math.sin(currentTime / 500) * 3 + 40;
    const pulseOpacity = Math.sin(currentTime / 500) * 0.1 + 0.15;

    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, pulseSize);
    gradient.addColorStop(0, `rgba(255, 215, 0, ${pulseOpacity})`);
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x - pulseSize, y - pulseSize, pulseSize * 2, pulseSize * 2);

    // Sombra do player (maior e mais visível que NPCs)
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + 20 * scale, 14 * scale, 5 * scale, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fill();

    // Círculo clean e sutil ao redor do player
    const circleRadius = 35; // Um pouco menor
    const pulsation = Math.sin(currentTime / 800) * 1.5; // Pulsação mais sutil

    this.ctx.beginPath();
    this.ctx.arc(x, y, circleRadius + pulsation, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)'; // Mais transparente e sutil
    this.ctx.lineWidth = 1.5; // Linha mais fina
    this.ctx.stroke();

    // Desenha player animado com cor DOURADA para destaque
    const isMoving = this.isPlayerMoving || false;
    this.drawAnimatedCharacter(x, y, '#FFD700', isMoving);

    // Nome do player (mais destacado)
    this.ctx.fillStyle = '#FFD700';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 3;
    this.ctx.font = 'bold 13px Arial';
    this.ctx.strokeText(this.playerName || 'Iniciado', x, y - 35 * scale);
    this.ctx.fillText(this.playerName || 'Iniciado', x, y - 35 * scale);
    this.ctx.textAlign = 'start';

    // Triângulo apontando para o próximo NPC da quest
    this.drawQuestPointer(x, y);
  }

  /**
   * Desenha triângulo apontando para o próximo NPC da quest
   */
  private drawQuestPointer(playerX: number, playerY: number) {
    if (!this.focusTarget || !this.npcs) return;

    const targetNPC = this.npcs.find(npc => npc.id === this.focusTarget);
    if (!targetNPC) return;

    const npcX = targetNPC.position.x;
    const npcY = targetNPC.position.y;

    // Calcula ângulo do player para o NPC
    const angle = Math.atan2(npcY - playerY, npcX - playerX);

    // Distância do player para desenhar o triângulo (na borda do círculo externo)
    const currentTime = Date.now();
    const circleRadius = 35;
    const pulsation = Math.sin(currentTime / 800) * 1.5;
    const distance = circleRadius + pulsation + 5; // +5 para ficar um pouco fora
    const pointerX = playerX + Math.cos(angle) * distance;
    const pointerY = playerY + Math.sin(angle) * distance;

    // Tamanho do triângulo
    const triangleSize = 12;

    // Animação de pulsação
    const pulse = Math.sin(currentTime / 300) * 0.2 + 1;
    const size = triangleSize * pulse;

    this.ctx.save();
    this.ctx.translate(pointerX, pointerY);
    this.ctx.rotate(angle);

    // Desenha triângulo apontador
    this.ctx.beginPath();
    this.ctx.moveTo(size, 0);
    this.ctx.lineTo(-size / 2, -size / 2);
    this.ctx.lineTo(-size / 2, size / 2);
    this.ctx.closePath();

    // Sombra do triângulo
    this.ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
    this.ctx.shadowBlur = 10;

    // Preenchimento com gradiente
    const gradient = this.ctx.createLinearGradient(-size, 0, size, 0);
    gradient.addColorStop(0, '#FFA500');
    gradient.addColorStop(1, '#FFD700');
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Contorno
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
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

    // Verifica se clicou no player
    if (this.playerPosition && this.isClickOnPlayer(position)) {
      this.onPlayerClick.emit();
      return;
    }

    // Verifica se clicou em NPC - NÃO move mais automaticamente
    const clickedNPC = this.getNPCAtPosition(position);
    if (clickedNPC) {
      // Emite evento de interação com NPC (será tratado no componente pai)
      this.onNpcInteract.emit(clickedNPC.id);
      return;
    }

    // Adiciona efeito visual de X no local do click
    this.clickEffects.push({
      position: { x: canvasX, y: canvasY },
      timestamp: Date.now()
    });

    // Sempre emite o clique para o componente pai decidir o que fazer
    this.onCanvasClick.emit(position);
  }

  /**
   * Verifica se o clique foi no player
   */
  private isClickOnPlayer(clickPosition: Position): boolean {
    if (!this.playerPosition) return false;

    const dx = clickPosition.x - this.playerPosition.x;
    const dy = clickPosition.y - this.playerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Raio de clique no player (um pouco maior para facilitar)
    const clickRadius = 35;
    return distance <= clickRadius;
  }

  handleMouseMove(event: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Escala para coordenadas do canvas
    const canvasX = (x / rect.width) * this.canvasWidth;
    const canvasY = (y / rect.height) * this.canvasHeight;

    const position = { x: canvasX, y: canvasY };

    // Verifica se está sobre um NPC
    const hoveredNPC = this.getNPCAtPosition(position);

    if (hoveredNPC) {
      this.onNpcHover.emit(hoveredNPC.id);
    } else {
      this.onNpcHover.emit(null);
    }
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

    // Verifica se clicou no player
    if (this.playerPosition && this.isClickOnPlayer(position)) {
      this.onPlayerClick.emit();
      return;
    }

    // Verifica se clicou em NPC (IGUAL AO MOUSE)
    const clickedNPC = this.getNPCAtPosition(position);
    if (clickedNPC) {
      // Emite evento de interação com NPC
      this.onNpcInteract.emit(clickedNPC.id);
      return;
    }

    // Adiciona efeito visual de X no local do toque
    this.clickEffects.push({
      position: { x: canvasX, y: canvasY },
      timestamp: Date.now()
    });

    // Se não clicou em nada específico, emite toque no canvas
    this.onCanvasClick.emit(position);
  }

  private getNPCAtPosition(position: Position): NPC | null {
    if (!this.npcs) return null;

    const threshold = 40; // Raio de clique aumentado para facilitar

    for (const npc of this.npcs) {
      // Permite clicar em TODOS os NPCs (bloqueados e desbloqueados)
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
   * Desenha efeitos de click (X marks que desaparecem)
   */
  private drawClickEffects() {
    const now = Date.now();
    const duration = 500; // 500ms para desaparecer

    // Remove efeitos antigos e desenha os ativos
    this.clickEffects = this.clickEffects.filter(effect => {
      const age = now - effect.timestamp;

      if (age > duration) {
        return false; // Remove efeito expirado
      }

      // Calcula fade out
      const progress = age / duration;
      const alpha = 1 - progress;
      const scale = 1 + progress * 0.5; // Cresce um pouco enquanto desaparece

      // Desenha X
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(effect.position.x, effect.position.y);
      this.ctx.scale(scale, scale);

      // Linhas do X (mesmo tom do círculo)
      this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';

      // Linha \ (diagonal esquerda-direita)
      this.ctx.beginPath();
      this.ctx.moveTo(-10, -10);
      this.ctx.lineTo(10, 10);
      this.ctx.stroke();

      // Linha / (diagonal direita-esquerda)
      this.ctx.beginPath();
      this.ctx.moveTo(10, -10);
      this.ctx.lineTo(-10, 10);
      this.ctx.stroke();

      this.ctx.restore();

      return true; // Mantém efeito ativo
    });
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