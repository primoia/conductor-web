import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AgentMetricsService, AgentExecutionMetrics } from '../../services/agent-metrics.service';

interface AgentCharacter {
  id: string;
  agentId: string;
  screenplayId: string;
  name: string;
  emoji: string;
  position: { x: number, y: number };
  velocity: { x: number, y: number };
  isActive: boolean;
  radius: number;
  color: string;
  trail: { x: number, y: number, alpha: number }[];
  // Temporary push mechanics
  pushedUntil?: number; // Timestamp when push ends (null if not pushed)
  pushedVelocity?: { x: number, y: number }; // Velocity from being pushed
  // Sprite animation
  sprite: {
    image: HTMLImageElement;
    frameWidth: number;
    frameHeight: number;
    currentFrame: number;
    totalFrames: number;
    animationSpeed: number;
    lastFrameTime: number;
    direction: 'left' | 'right';
  };
  // Execution metrics
  executionMetrics: {
    totalExecutions: number;
    totalExecutionTime: number; // em millisegundos
    averageExecutionTime: number; // em millisegundos
    lastExecutionTime?: Date;
    isCurrentlyExecuting: boolean;
  };
  // Councilor status (promoted agents)
  isCouncilor?: boolean;
}

interface SpriteAnimation {
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  totalFrames: number;
  animationSpeed: number; // frames per second
}

interface Plant {
  id: string;
  type: 'tree' | 'bush' | 'flower' | 'grass';
  position: { x: number, y: number };
  size: number;
  emoji: string;
  animationOffset: number; // Para animação sutil
  swaySpeed: number; // Velocidade do balanço
  swayAmount: number; // Intensidade do balanço
  color: string;
}

interface AgentGroup {
  agentId: string;
  name: string;
  emoji: string;
  instances: AgentCharacter[];
  aggregatedMetrics: AgentExecutionMetrics;
  position: { x: number, y: number };
  color: string;
  isActive: boolean;
  agentType: string;
}

interface AgentFilter {
  showInstances: boolean;
  showGrouped: boolean;
  minExecutions: number;
  agentTypes: string[];
  searchTerm: string;
}

interface HeartParticle {
  id: string;
  position: { x: number, y: number };
  velocity: { x: number, y: number };
  alpha: number;
  scale: number;
  rotation: number;
  rotationSpeed: number;
  lifetime: number; // em millisegundos
  createdAt: number; // timestamp
  color: string;
}

@Component({
  selector: 'app-agent-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-game.component.html',
  styleUrls: ['./agent-game.component.css']
})
export class AgentGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private agents: AgentCharacter[] = [];
  private canvasWidth = 0;
  private canvasHeight = 0;
  private lastTime = 0;
  private resizeObserver?: ResizeObserver;

  // Sprite management
  private spriteAnimations: Map<string, SpriteAnimation> = new Map();
  private spriteImages: Map<string, HTMLImageElement> = new Map();

  // Plant system
  private plants: Plant[] = [];
  private plantTypes: Array<{
    type: 'tree' | 'bush' | 'flower' | 'grass';
    emojis: string[];
    colors: string[];
  }> = [
    { type: 'tree', emojis: ['🌳', '🌲', '🌴', '🌿'], colors: ['#228B22', '#32CD32', '#006400', '#8FBC8F'] },
    { type: 'bush', emojis: ['🌿', '🌱', '🍀', '🌾'], colors: ['#90EE90', '#98FB98', '#9ACD32', '#ADFF2F'] },
    { type: 'flower', emojis: ['🌸', '🌺', '🌻', '🌷'], colors: ['#FFB6C1', '#FF69B4', '#FF1493', '#FFC0CB'] },
    { type: 'grass', emojis: ['🌱', '🌾', '🌿'], colors: ['#9ACD32', '#ADFF2F', '#7CFC00'] }
  ];

  // Heart particle system (collision effect)
  private heartParticles: HeartParticle[] = [];

  // Tooltip state
  selectedAgent: AgentCharacter | null = null;
  tooltipX = 0;
  tooltipY = 0;
  showTooltip = false;
  showAdvancedStats = false;

  // Drag state for tooltip
  isDraggingTooltip = false;
  dragOffsetX = 0;
  dragOffsetY = 0;

  // Mini map popup state
  hoveredAgent: AgentCharacter | null = null;
  miniMapPopupX = 0;
  miniMapPopupY = 0;
  showMiniMapPopup = false;
  private popupTimeout: any = null;

  // Periodic sync state
  private syncInterval: any = null;
  private readonly SYNC_INTERVAL_MS = 30000; // 30 segundos

  // Agent radius (smaller)
  private readonly AGENT_RADIUS = 18; // 48px / 2 = 24, ajustado para 18 (75% do anterior)

  // Debug panel state
  showDebugPanel = false;

  // View mode: 'instances' or 'agents'
  viewMode: 'instances' | 'agents' = 'instances';

  // Agent groups for consolidated view
  private agentsByType: Map<string, AgentGroup> = new Map();

  // Filter system
  filters: AgentFilter = {
    showInstances: true,
    showGrouped: false,
    minExecutions: 0,
    agentTypes: [],
    searchTerm: ''
  };

  showFilters = false;

  // Available agent types for filtering
  availableAgentTypes = [
    { value: 'code_generator', label: 'Gerador de Código', emoji: '🤖' },
    { value: 'test_runner', label: 'Test Runner', emoji: '🧪' },
    { value: 'documentation', label: 'Documentação', emoji: '📚' },
    { value: 'security', label: 'Segurança', emoji: '🔐' },
    { value: 'deployment', label: 'Deploy', emoji: '🚀' },
    { value: 'optimization', label: 'Otimização', emoji: '⚡' },
    { value: 'analysis', label: 'Análise', emoji: '🔍' }
  ];

  // Agent type colors
  private readonly AGENT_TYPE_COLORS = {
    'code_generator': '#FF6B6B',      // Vermelho
    'test_runner': '#4ECDC4',         // Azul claro
    'documentation': '#45B7D1',       // Azul
    'security': '#96CEB4',            // Verde
    'deployment': '#FFEAA7',          // Amarelo
    'optimization': '#DDA0DD',        // Roxo
    'analysis': '#F0E68C',            // Amarelo claro
    'default': '#DFE6E9'              // Cinza
  };
  debugRefreshInterval: any = null;

  constructor(
    private http: HttpClient,
    private agentMetricsService: AgentMetricsService,
    private cdr: ChangeDetectorRef
  ) {
    // Inicializar tracking automático
    this.initializeMetricsTracking();
  }

  ngAfterViewInit(): void {
    this.initCanvas();
    this.loadSprites();
    this.generatePlants(); // Gerar plantas no mapa
    this.loadAgentsFromBFF();
    this.startGameLoop();
    this.startPeriodicSync();

    // Force resize after a short delay to ensure container is properly sized
    setTimeout(() => {
      this.resizeCanvas();
    }, 100);

    // Additional resize after longer delay to ensure full rendering
    setTimeout(() => {
      this.resizeCanvas();
    }, 500);

    // DEBUG: Expor métodos para debug no console
    (window as any).debugAgentMetrics = () => this.debugAllAgentMetrics();
    (window as any).debugAgent = (name: string) => this.debugSingleAgent(name);
    (window as any).toggleDebug = () => this.toggleDebugPanel();
    console.log('🐛 [DEBUG] Comandos disponíveis:');
    console.log('   - toggleDebug() → Ativar/desativar painel de debug visual');
    console.log('   - debugAgentMetrics() → Ver métricas de TODOS os agentes');
    console.log('   - debugAgent("nome") → Ver métricas de UM agente específico');
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.popupTimeout) {
      clearTimeout(this.popupTimeout);
    }
    if (this.debugRefreshInterval) {
      clearInterval(this.debugRefreshInterval);
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    // Set canvas size to match container (full height vertical rectangle)
    this.resizeCanvas();

    // Use ResizeObserver to detect container size changes
    const container = canvas.parentElement;
    if (container && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      this.resizeObserver.observe(container);
    }

    // Fallback: Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * Carrega sprites para os personagens
   */
  private loadSprites(): void {
    try {
      // Criar sprites programaticamente (em vez de carregar imagens)
      this.createCharacterSprites();
      console.log('🎨 [SPRITES] Sprites carregados com sucesso');
    } catch (error) {
      console.error('❌ [SPRITES] Erro ao carregar sprites:', error);
    }
  }

  /**
   * Cria sprites de personagens programaticamente
   */
  private createCharacterSprites(): void {
    // Criar sprite de personagem masculino (4 frames de caminhada)
    const spriteMale = this.createWalkingCharacterSprite('male');
    this.spriteAnimations.set('character-male', spriteMale);

    // Criar sprite de personagem feminino (4 frames de caminhada)
    const spriteFemale = this.createWalkingCharacterSprite('female');
    this.spriteAnimations.set('character-female', spriteFemale);
  }

  /**
   * Gera plantas aleatórias no mapa
   */
  private generatePlants(): void {
    this.plants = [];
    const plantCount = 15 + Math.floor(Math.random() * 10); // 15-25 plantas
    
    for (let i = 0; i < plantCount; i++) {
      const plantType = this.plantTypes[Math.floor(Math.random() * this.plantTypes.length)];
      const emoji = plantType.emojis[Math.floor(Math.random() * plantType.emojis.length)];
      const color = plantType.colors[Math.floor(Math.random() * plantType.colors.length)];
      
      const plant: Plant = {
        id: `plant-${i}`,
        type: plantType.type,
        position: {
          x: Math.random() * this.canvasWidth,
          y: Math.random() * this.canvasHeight
        },
        size: 20 + Math.random() * 30, // 20-50px
        emoji,
        animationOffset: Math.random() * Math.PI * 2, // Offset para animação
        swaySpeed: 0.5 + Math.random() * 1.5, // 0.5-2.0
        swayAmount: 2 + Math.random() * 4, // 2-6px
        color
      };
      
      this.plants.push(plant);
    }
    
    console.log(`🌱 [PLANTS] Geradas ${this.plants.length} plantas no mapa`);
  }

  /**
   * Cria um sprite de personagem caminhando usando canvas (MINION)
   * @param gender - 'male' ou 'female' para personalização
   */
  private createWalkingCharacterSprite(gender: 'male' | 'female' = 'male'): SpriteAnimation {
    const frameWidth = 48; // Tamanho ajustado (75% do anterior)
    const frameHeight = 48; // Tamanho ajustado (75% do anterior)
    const totalFrames = 5; // 4 frames de caminhada + 1 frame idle

    // Criar canvas temporário para desenhar o sprite
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frameWidth * totalFrames;
    tempCanvas.height = frameHeight;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Desenhar 5 frames: 1 idle + 4 de caminhada (MINION style)
    for (let frame = 0; frame < totalFrames; frame++) {
      const x = frame * frameWidth;

      tempCtx.save();
      tempCtx.translate(x, 0);

      // === CORPO MINION (Cilindro amarelo) ===
      tempCtx.fillStyle = '#FFD700'; // Amarelo Minion
      // Corpo cilíndrico (retângulo arredondado) - 48px (75% do anterior)
      tempCtx.beginPath();
      tempCtx.roundRect(9, 12, 30, 30, 15);
      tempCtx.fill();

      // === ROUPA (VESTIDO PARA MENINAS, MACACÃO PARA MENINOS) ===
      if (gender === 'female') {
        // VESTIDO ROSA - 48px (75% do anterior)
        tempCtx.fillStyle = '#FF69B4'; // Rosa pink

        // Parte superior do vestido (corpete)
        tempCtx.fillRect(12, 18, 24, 9);

        // Saia com forma trapezoidal (usando triângulos)
        tempCtx.beginPath();
        tempCtx.moveTo(12, 27); // Topo esquerdo da saia
        tempCtx.lineTo(9, 42); // Base esquerda da saia (mais larga)
        tempCtx.lineTo(39, 42); // Base direita da saia
        tempCtx.lineTo(36, 27); // Topo direito da saia
        tempCtx.closePath();
        tempCtx.fill();

        // Detalhes rosa escuro na barra do vestido
        tempCtx.fillStyle = '#FF1493'; // Rosa escuro
        tempCtx.fillRect(9, 39, 30, 3);

        // Alças do vestido (fininhas)
        tempCtx.fillStyle = '#FF69B4';
        tempCtx.fillRect(15, 15, 3, 6); // Alça esquerda
        tempCtx.fillRect(30, 15, 3, 6); // Alça direita

        // CORAÇÃO PIXELADO COLORIDO no vestido - 48px (75% do anterior)
        const heartPixels = [
          // Linha 1 (topo)
          { x: 19.5, y: 30, color: '#FF0080' }, // Rosa forte
          { x: 21, y: 30, color: '#FF0080' },
          { x: 25.5, y: 30, color: '#FF0080' },
          { x: 27, y: 30, color: '#FF0080' },
          // Linha 2
          { x: 18, y: 31.5, color: '#FF1493' }, // Rosa médio
          { x: 19.5, y: 31.5, color: '#FFB6C1' }, // Rosa claro (centro)
          { x: 21, y: 31.5, color: '#FF69B4' },
          { x: 22.5, y: 31.5, color: '#FF1493' },
          { x: 24, y: 31.5, color: '#FF69B4' },
          { x: 25.5, y: 31.5, color: '#FFB6C1' }, // Rosa claro (centro)
          { x: 27, y: 31.5, color: '#FF1493' },
          { x: 28.5, y: 31.5, color: '#FF1493' },
          // Linha 3 (mais larga)
          { x: 18, y: 33, color: '#FF1493' },
          { x: 19.5, y: 33, color: '#FFB6C1' }, // Brilho
          { x: 21, y: 33, color: '#FFFFFF' }, // Brilho branco
          { x: 22.5, y: 33, color: '#FFB6C1' },
          { x: 24, y: 33, color: '#FFB6C1' },
          { x: 25.5, y: 33, color: '#FFFFFF' }, // Brilho branco
          { x: 27, y: 33, color: '#FFB6C1' },
          { x: 28.5, y: 33, color: '#FF1493' },
          // Linha 4
          { x: 19.5, y: 34.5, color: '#FF0080' },
          { x: 21, y: 34.5, color: '#FF69B4' },
          { x: 22.5, y: 34.5, color: '#FFB6C1' },
          { x: 24, y: 34.5, color: '#FFB6C1' },
          { x: 25.5, y: 34.5, color: '#FF69B4' },
          { x: 27, y: 34.5, color: '#FF0080' },
          // Linha 5 (meio)
          { x: 21, y: 36, color: '#FF0080' },
          { x: 22.5, y: 36, color: '#FF1493' },
          { x: 24, y: 36, color: '#FF1493' },
          { x: 25.5, y: 36, color: '#FF0080' },
          // Linha 6 (afunilando)
          { x: 22.5, y: 37.5, color: '#FF0080' },
          { x: 24, y: 37.5, color: '#FF0080' },
          // Linha 7 (ponta)
          { x: 23.25, y: 39, color: '#C71585' } // Rosa bem escuro (ponta)
        ];

        // Desenhar cada pixel do coração - pixel de 1.5x1.5 (75% de 2x2)
        heartPixels.forEach(pixel => {
          tempCtx.fillStyle = pixel.color;
          tempCtx.fillRect(pixel.x, pixel.y, 1.5, 1.5);
        });

      } else {
        // MACACÃO AZUL (masculino) - 48px (75% do anterior)
        tempCtx.fillStyle = '#0066CC'; // Azul macacão
        // Parte inferior do macacão
        tempCtx.fillRect(12, 30, 24, 12);
        // Alças do macacão
        tempCtx.fillRect(15, 15, 4.5, 18); // Alça esquerda
        tempCtx.fillRect(28.5, 15, 4.5, 18); // Alça direita
      }

      // === ÓCULOS MINION (olho único grande) - 48px (75% do anterior) ===
      // Armação cinza
      tempCtx.fillStyle = '#444444';
      tempCtx.beginPath();
      tempCtx.arc(24, 21, 9, 0, Math.PI * 2);
      tempCtx.fill();

      // Lente branca
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.beginPath();
      tempCtx.arc(24, 21, 7.5, 0, Math.PI * 2);
      tempCtx.fill();

      // Íris marrom
      tempCtx.fillStyle = '#8B4513';
      tempCtx.beginPath();
      tempCtx.arc(24, 21, 4.5, 0, Math.PI * 2);
      tempCtx.fill();

      // Pupila preta
      tempCtx.fillStyle = '#000000';
      tempCtx.beginPath();
      tempCtx.arc(24, 21, 2.25, 0, Math.PI * 2);
      tempCtx.fill();

      // Brilho no olho
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.beginPath();
      tempCtx.arc(25.5, 19.5, 1.5, 0, Math.PI * 2);
      tempCtx.fill();

      // === CABELO - 48px (75% do anterior) ===
      if (gender === 'female') {
        // Cabelo longo feminino com laço
        tempCtx.fillStyle = '#000000';

        // Cabelo longo dos lados
        tempCtx.fillRect(12, 7.5, 4.5, 15); // Lado esquerdo
        tempCtx.fillRect(31.5, 7.5, 4.5, 15); // Lado direito

        // Franja
        tempCtx.fillRect(16.5, 4.5, 15, 4.5);

        // Laço rosa no topo
        tempCtx.fillStyle = '#FF69B4';
        tempCtx.beginPath();
        tempCtx.arc(18, 6, 4.5, 0, Math.PI * 2);
        tempCtx.fill();
        tempCtx.beginPath();
        tempCtx.arc(30, 6, 4.5, 0, Math.PI * 2);
        tempCtx.fill();
        // Centro do laço
        tempCtx.fillRect(21, 3, 6, 6);

        // Cílios
        tempCtx.strokeStyle = '#000000';
        tempCtx.lineWidth = 1.5;
        tempCtx.beginPath();
        tempCtx.moveTo(18, 18);
        tempCtx.lineTo(16.5, 16.5);
        tempCtx.moveTo(30, 18);
        tempCtx.lineTo(31.5, 16.5);
        tempCtx.stroke();
      } else {
        // Cabelo masculino (poucos fios no topo)
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(19.5, 4.5, 3, 6); // Fio 1
        tempCtx.fillRect(24, 3, 3, 7.5); // Fio 2 (mais alto)
        tempCtx.fillRect(28.5, 4.5, 3, 6); // Fio 3
      }

      // === BOCA - 48px (75% do anterior) ===
      if (gender === 'female') {
        // Boca com batom
        tempCtx.fillStyle = '#FF1493';
        tempCtx.beginPath();
        tempCtx.ellipse(24, 33, 4.5, 2.25, 0, 0, Math.PI * 2);
        tempCtx.fill();

        // Brilho nos lábios
        tempCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        tempCtx.beginPath();
        tempCtx.ellipse(24, 32.25, 2.25, 1.2, 0, 0, Math.PI * 2);
        tempCtx.fill();
      } else {
        // Boca normal
        tempCtx.strokeStyle = '#000000';
        tempCtx.lineWidth = 1.5;
        tempCtx.beginPath();
        tempCtx.arc(24, 33, 4.5, 0.2, Math.PI - 0.2);
        tempCtx.stroke();
      }

      // === PERNAS E BRAÇOS (com animação) - 48px (75% do anterior) ===
      if (frame === 0) {
        // IDLE - Pernas paradas
        tempCtx.fillStyle = '#0066CC'; // Azul macacão
        tempCtx.fillRect(15, 42, 6, 9); // Perna esquerda
        tempCtx.fillRect(27, 42, 6, 9); // Perna direita

        // Sapatos pretos
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(13.5, 48, 9, 3); // Sapato esquerdo
        tempCtx.fillRect(25.5, 48, 9, 3); // Sapato direito

        // Braços parados (luvas pretas)
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(4.5, 27, 4.5, 9); // Braço esquerdo
        tempCtx.fillRect(39, 27, 4.5, 9); // Braço direito
      } else {
        // CAMINHADA - Movimento alternado
        const walkFrame = frame - 1;
        const legOffset = Math.sin(walkFrame * Math.PI / 2) * 4.5; // 75% de 6
        const armOffset = Math.sin(walkFrame * Math.PI / 2) * 3; // 75% de 4

        // Pernas com movimento
        tempCtx.fillStyle = '#0066CC'; // Azul macacão
        tempCtx.fillRect(15 - legOffset, 42, 6, 9); // Perna esquerda
        tempCtx.fillRect(27 + legOffset, 42, 6, 9); // Perna direita

        // Sapatos pretos com movimento
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(13.5 - legOffset, 48, 9, 3); // Sapato esquerdo
        tempCtx.fillRect(25.5 + legOffset, 48, 9, 3); // Sapato direito

        // Braços com movimento (luvas pretas)
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(4.5 - armOffset, 27, 4.5, 9); // Braço esquerdo
        tempCtx.fillRect(39 + armOffset, 27, 4.5, 9); // Braço direito
      }

      tempCtx.restore();
    }

    // Criar imagem diretamente do canvas
    const img = new Image();
    img.src = tempCanvas.toDataURL();

    return {
      image: img,
      frameWidth,
      frameHeight,
      totalFrames,
      animationSpeed: 8 // 8 FPS
    };
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;
    if (container) {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      
      // Force minimum height to ensure canvas uses full container height
      const minHeight = Math.max(newHeight, 200);
      
      // Only resize if dimensions actually changed
      if (newWidth !== this.canvasWidth || newHeight !== this.canvasHeight) {
        this.canvasWidth = canvas.width = newWidth;
        this.canvasHeight = canvas.height = newHeight;
        
        // Set CSS dimensions to match canvas dimensions
        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;
        
        console.log(`🎮 [AGENT-GAME] Canvas resized to: ${newWidth}x${newHeight}`);
        console.log(`🎮 [AGENT-GAME] Container dimensions: ${container.clientWidth}x${container.clientHeight}`);
        
        // Regenerate plants for new canvas size
        this.generatePlants();
        
        // Reposition agents if they're outside the new bounds
        this.agents.forEach(agent => {
          agent.position.x = Math.max(agent.radius, Math.min(this.canvasWidth - agent.radius, agent.position.x));
          agent.position.y = Math.max(agent.radius, Math.min(this.canvasHeight - agent.radius, agent.position.y));
        });
      }
    }
  }

  private async loadAgentsFromBFF(): Promise<void> {
    try {
      // Determine base URL
      const baseUrl = this.getBaseUrl();
      console.log('🎮 [AGENT-GAME] Base URL:', baseUrl);

      // Fetch agent instances from BFF
      const url = `${baseUrl}/agents/instances?limit=500`;
      console.log('🎮 [AGENT-GAME] Fetching from:', url);

      const response = await this.http.get<{ success: boolean, count: number, instances: any[] }>(url).toPromise();

      console.log('🎮 [AGENT-GAME] Response received:', response);
      console.log('🎮 [AGENT-GAME] Response type:', typeof response);
      console.log('🎮 [AGENT-GAME] Success:', response?.success);
      console.log('🎮 [AGENT-GAME] Count:', response?.count);
      console.log('🎮 [AGENT-GAME] Instances length:', response?.instances?.length);

      if (response && response.success && response.instances && response.instances.length > 0) {
        console.log('🎮 [AGENT-GAME] Loaded agents from BFF:', response.instances);

        // Clear existing agents
        this.agents = [];

        // Create agent characters from BFF data
        response.instances.forEach((agentData) => {
          this.addAgentFromBFF(agentData);
        });

        // Group agents by type after loading
        this.groupAgentsByType();

        console.log(`✅ [LOAD] Carregados ${this.agents.length} agentes. Use debugAgentMetrics() para ver detalhes.`);
      } else {
        console.warn('⚠️ [AGENT-GAME] No agents found in BFF response, no agents will be displayed');
        console.log('Response was:', response);
        // Clear existing agents instead of creating test agents
        this.agents = [];
      }
    } catch (error) {
      console.error('❌ [AGENT-GAME] Error loading agents from BFF:', error);
      console.error('Error details:', error);
      console.log('🎮 [AGENT-GAME] No agents will be displayed due to error');
      // Clear existing agents instead of creating test agents
      this.agents = [];
    }
  }

  private getBaseUrl(): string {
    // Use environment configuration
    return environment.apiUrl;
  }

  private addAgentFromBFF(agentData: any): void {
    // Find non-overlapping position
    const position = this.findNonOverlappingPosition();

    // Obter sprite de personagem (50% chance de ser masculino ou feminino)
    const isFemale = Math.random() > 0.5;
    const spriteKey = isFemale ? 'character-female' : 'character-male';
    const characterSprite = this.spriteAnimations.get(spriteKey);
    if (!characterSprite) {
      console.warn('⚠️ [SPRITE] Sprite de personagem não encontrado, usando emoji como fallback');
    }

    const agent: AgentCharacter = {
      id: agentData.instance_id || agentData.id || `agent_${Date.now()}_${Math.random()}`,
      agentId: agentData.agent_id ?? 'unknown',
      screenplayId: agentData.screenplay_id || 'unknown',
      name: agentData.definition?.title || agentData.name || 'Unknown Agent',
      emoji: agentData.emoji || agentData.definition?.emoji || '🤖',
      position: position,
      velocity: {
        x: 0, // Iniciar parado
        y: 0  // Iniciar parado
      },
      isActive: false,  // Start inactive, will be updated by parent
      radius: this.AGENT_RADIUS,
      color: this.getAgentColor(agentData),
      trail: [],
      // Sprite animation
      sprite: characterSprite ? {
        image: characterSprite.image,
        frameWidth: characterSprite.frameWidth,
        frameHeight: characterSprite.frameHeight,
        currentFrame: 0,
        totalFrames: characterSprite.totalFrames,
        animationSpeed: characterSprite.animationSpeed,
        lastFrameTime: 0,
        direction: 'right'
      } : {
        image: new Image(),
        frameWidth: 0,
        frameHeight: 0,
        currentFrame: 0,
        totalFrames: 0,
        animationSpeed: 0,
        lastFrameTime: 0,
        direction: 'right'
      },
      // Inicializar métricas de execução
      executionMetrics: {
        totalExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        isCurrentlyExecuting: false
      }
    };

    this.agents.push(agent);

    // Inicializar métricas do agente
    this.initializeAgentMetrics(agent);

    // console.log('🎮 [AGENT-GAME] Added agent:', agent.name, agent.emoji);
  }

  /**
   * Determina o tipo de agente baseado no nome e agentId
   */
  private determineAgentType(agentData: any): string {
    const name = (agentData.definition?.title || agentData.name || '').toLowerCase();
    const agentId = (agentData.agent_id || '').toLowerCase();
    
    if (name.includes('code') || name.includes('generator') || name.includes('código')) return 'code_generator';
    if (name.includes('test') || name.includes('runner') || name.includes('teste')) return 'test_runner';
    if (name.includes('doc') || name.includes('readme') || name.includes('documentação')) return 'documentation';
    if (name.includes('security') || name.includes('auth') || name.includes('segurança')) return 'security';
    if (name.includes('deploy') || name.includes('build') || name.includes('deployment')) return 'deployment';
    if (name.includes('optim') || name.includes('performance') || name.includes('otimização')) return 'optimization';
    if (name.includes('anal') || name.includes('review') || name.includes('análise')) return 'analysis';
    
    return 'default';
  }

  /**
   * Obtém a cor do agente baseada no tipo
   */
  private getAgentColor(agentData: any): string {
    const agentType = this.determineAgentType(agentData);
    return (this.AGENT_TYPE_COLORS as any)[agentType] || this.AGENT_TYPE_COLORS.default;
  }

  /**
   * Agrupa agentes por agentId para visualização consolidada
   */
  private groupAgentsByType(): void {
    this.agentsByType.clear();
    
    this.agents.forEach(agent => {
      if (!this.agentsByType.has(agent.agentId)) {
        this.agentsByType.set(agent.agentId, {
          agentId: agent.agentId,
          name: agent.name,
          emoji: agent.emoji,
          instances: [],
          aggregatedMetrics: {
            totalExecutions: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            isCurrentlyExecuting: false
          },
          position: { x: 0, y: 0 },
          color: agent.color,
          isActive: false,
          agentType: this.determineAgentType({ name: agent.name, agent_id: agent.agentId })
        });
      }
      
      const group = this.agentsByType.get(agent.agentId)!;
      group.instances.push(agent);
      
      // Agregar métricas
      group.aggregatedMetrics.totalExecutions += agent.executionMetrics.totalExecutions;
      group.aggregatedMetrics.totalExecutionTime += agent.executionMetrics.totalExecutionTime;
      group.isActive = group.isActive || agent.isActive;
    });
    
    // Calcular métricas agregadas e posições
    this.agentsByType.forEach((group, index) => {
      if (group.instances.length > 0) {
        group.aggregatedMetrics.averageExecutionTime = 
          group.aggregatedMetrics.totalExecutions > 0 
            ? group.aggregatedMetrics.totalExecutionTime / group.aggregatedMetrics.totalExecutions 
            : 0;
        
        // Posicionar grupo baseado na primeira instância
        group.position = { ...group.instances[0].position };
      }
    });
  }

  /**
   * Obtém agentes para renderização baseado no modo de visualização e filtros
   */
  private getDisplayedAgents(): (AgentCharacter | AgentGroup)[] {
    let agents: (AgentCharacter | AgentGroup)[] = [];
    
    if (this.viewMode === 'agents') {
      agents = Array.from(this.agentsByType.values());
    } else {
      agents = this.agents;
    }
    
    // Aplicar filtros
    return this.applyFilters(agents);
  }

  /**
   * Aplica filtros aos agentes
   */
  private applyFilters(agents: (AgentCharacter | AgentGroup)[]): (AgentCharacter | AgentGroup)[] {
    return agents.filter(agent => {
      // Filtro por execuções mínimas
      if (this.filters.minExecutions > 0) {
        const executions = this.viewMode === 'agents' 
          ? (agent as AgentGroup).aggregatedMetrics.totalExecutions
          : (agent as AgentCharacter).executionMetrics.totalExecutions;
        
        if (executions < this.filters.minExecutions) {
          return false;
        }
      }
      
      // Filtro por tipos de agente
      if (this.filters.agentTypes.length > 0) {
        const agentType = this.viewMode === 'agents' 
          ? (agent as AgentGroup).agentType
          : this.determineAgentType({ name: (agent as AgentCharacter).name, agent_id: (agent as AgentCharacter).agentId });
        
        if (!this.filters.agentTypes.includes(agentType)) {
          return false;
        }
      }
      
      // Filtro por termo de busca
      if (this.filters.searchTerm) {
        const searchLower = this.filters.searchTerm.toLowerCase();
        const name = this.viewMode === 'agents' 
          ? (agent as AgentGroup).name
          : (agent as AgentCharacter).name;
        
        if (!name.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Obtém instâncias de um agente específico
   */
  public getInstancesForAgent(agentId: string): AgentCharacter[] {
    return this.agents.filter(agent => agent.agentId === agentId);
  }

  /**
   * Obtém contagem de instâncias para um agente
   */
  public getInstanceCount(agentId: string): number {
    return this.getInstancesForAgent(agentId).length;
  }

  /**
   * Obtém métricas agregadas para um agente
   */
  public getAggregatedExecutions(agentId: string): number {
    return this.getInstancesForAgent(agentId)
      .reduce((total, agent) => total + agent.executionMetrics.totalExecutions, 0);
  }

  public getAggregatedTime(agentId: string): number {
    return this.getInstancesForAgent(agentId)
      .reduce((total, agent) => total + agent.executionMetrics.totalExecutionTime, 0);
  }

  /**
   * Inicializa as métricas de execução de um agente
   */
  private initializeAgentMetrics(agent: AgentCharacter): void {
    // 1. Carregar métricas da API (backend)
    this.loadAgentStatisticsFromAPI(agent);

    // 2. Subscrever às atualizações de métricas em memória
    // IMPORTANTE: usar agent.id (instance_id) ao invés de agent.agentId para instâncias únicas
    this.agentMetricsService.getAgentMetrics(agent.id).subscribe(metrics => {
      agent.executionMetrics = { ...metrics };
      // console.log(`📊 [METRICS] Métricas atualizadas para ${agent.name}:`, metrics);

      // Atualizar agrupamento quando métricas mudarem
      this.groupAgentsByType();

      // Forçar detecção de mudanças no Angular
      this.cdr.detectChanges();
    });
  }

  /**
   * Carrega estatísticas do agente da API do backend
   */
  private loadAgentStatisticsFromAPI(agent: AgentCharacter): void {
    const instanceId = agent.id;
    const baseUrl = this.getBaseUrl();
    const apiUrl = `${baseUrl}/agents/instances/${instanceId}`;

    console.log(`🔄 [API] Carregando stats para ${agent.name} (${instanceId})`);

    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        console.log(`📥 [API] Response para ${agent.name}:`, response);
        // A API retorna { success: true, instance: { statistics: {...} } }
        const statistics = response.instance?.statistics || response.statistics;

        if (statistics) {
          console.log(`✅ [API] Estatísticas para ${agent.name}:`, {
            task_count: statistics.task_count,
            total_time: statistics.total_execution_time,
            avg_time: statistics.average_execution_time
          });

          // Atualizar métricas do agente com dados do backend
          agent.executionMetrics = {
            totalExecutions: statistics.task_count || 0,
            totalExecutionTime: statistics.total_execution_time || 0,
            averageExecutionTime: statistics.average_execution_time || 0,
            lastExecutionTime: statistics.last_task_completed_at
              ? new Date(statistics.last_task_completed_at)
              : undefined,
            isCurrentlyExecuting: false
          };

          // Sincronizar com o serviço de métricas em memória
          // IMPORTANTE: usar agent.id (instance_id) para métricas únicas por instância
          this.agentMetricsService.syncFromBackend(agent.id, agent.executionMetrics);

          console.log(`✅ [SYNC] Agente atualizado:`, {
            name: agent.name,
            instance_id: agent.id,
            agentId: agent.agentId,
            metrics: agent.executionMetrics
          });

          // Forçar detecção de mudanças no Angular para atualizar tooltips/modals
          this.cdr.detectChanges();
        } else {
          // console.warn(`⚠️ [API] Sem estatísticas para ${agent.name}`);
        }
      },
      error: (error) => {
        console.error(`❌ [API] Erro ao carregar estatísticas para ${agent.name}:`, error.message);

        // Fallback para métricas em memória
        // IMPORTANTE: usar agent.id (instance_id)
        const currentMetrics = this.agentMetricsService.getCurrentMetrics(agent.id);
        agent.executionMetrics = { ...currentMetrics };
      }
    });
  }

  /**
   * Inicia sincronização periódica com o backend
   */
  private startPeriodicSync(): void {
    // console.log(`🔄 [SYNC] Iniciando sincronização periódica (intervalo: ${this.SYNC_INTERVAL_MS / 1000}s)`);

    // Sincronizar imediatamente
    this.syncAllAgentsFromBackend();

    // Configurar intervalo para sincronizações futuras
    this.syncInterval = setInterval(() => {
      this.syncAllAgentsFromBackend();
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Sincroniza estatísticas de todos os agentes com o backend
   */
  private syncAllAgentsFromBackend(): void {
    if (this.agents.length === 0) {
      // console.log('ℹ️ [SYNC] Nenhum agente para sincronizar');
      return;
    }

    // console.log(`🔄 [SYNC] Sincronizando ${this.agents.length} agentes com o backend...`);

    this.agents.forEach(agent => {
      this.loadAgentStatisticsFromAPI(agent);
    });
  }

  /**
   * Atualiza métricas de todos os agentes existentes
   */
  private updateAllAgentMetrics(): void {
    this.agents.forEach(agent => {
      // IMPORTANTE: usar agent.id (instance_id) para métricas únicas
      const currentMetrics = this.agentMetricsService.getCurrentMetrics(agent.id);
      agent.executionMetrics = { ...currentMetrics };
    });

    // Forçar detecção de mudanças após atualizar métricas de todos os agentes
    // Mas só se o componente já foi inicializado (evita erro de null reference)
    try {
      this.cdr.detectChanges();
    } catch (error) {
      // Ignora erro se componente ainda não foi inicializado
    }
  }

  /**
   * Inicializa o tracking automático de métricas
   */
  private initializeMetricsTracking(): void {
    // Subscrever às atualizações globais de métricas
    this.agentMetricsService.metrics$.subscribe(() => {
      this.updateAllAgentMetrics();
    });
    
    console.log('🎯 [METRICS] Tracking automático de métricas inicializado');
  }

  /**
   * Método de teste para simular execução de agente
   * TODO: Remover após integração completa
   */
  testAgentExecution(agentId: string): void {
    if (this.agentMetricsService.isAgentExecuting(agentId)) {
      console.log('⚠️ [TEST] Agente já está executando:', agentId);
      return;
    }

    console.log('🧪 [TEST] Simulando execução de agente:', agentId);
    this.agentMetricsService.forceStartExecution(agentId);
    
    // Simula execução por 2-5 segundos (aleatório)
    const executionTime = Math.random() * 3000 + 2000; // 2-5 segundos
    setTimeout(() => {
      this.agentMetricsService.forceEndExecution(agentId);
      console.log('🧪 [TEST] Execução simulada finalizada:', agentId);
    }, executionTime);
  }

  private findNonOverlappingPosition(): { x: number, y: number } {
    const maxAttempts = 50;
    const padding = this.AGENT_RADIUS + 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.random() * (this.canvasWidth - padding * 2) + padding;
      const y = Math.random() * (this.canvasHeight - padding * 2) + padding;

      // Check if this position overlaps with any existing agent
      let overlaps = false;
      for (const agent of this.agents) {
        const dx = x - agent.position.x;
        const dy = y - agent.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.AGENT_RADIUS * 2 + 10) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        return { x, y };
      }
    }

    // Fallback: return position even if overlapping (rare case)
    return {
      x: Math.random() * (this.canvasWidth - padding * 2) + padding,
      y: Math.random() * (this.canvasHeight - padding * 2) + padding
    };
  }

  /**
   * Atualiza a animação do sprite do agente
   */
  private updateSpriteAnimation(agent: AgentCharacter, deltaTime: number): void {
    if (!agent.sprite || agent.sprite.totalFrames === 0) return;

    // Calcular velocidade atual do agente
    let currentSpeed = Math.sqrt(agent.velocity.x ** 2 + agent.velocity.y ** 2);
    
    // Se o agente está sendo empurrado, considerar a velocidade de empurrão também
    if (!agent.isActive && agent.pushedVelocity) {
      const pushedSpeed = Math.sqrt(agent.pushedVelocity.x ** 2 + agent.pushedVelocity.y ** 2);
      currentSpeed = Math.max(currentSpeed, pushedSpeed);
    }
    
    const isMoving = currentSpeed > 0.1; // Threshold mínimo para considerar movimento

    // Só animar se estiver se movendo
    if (isMoving) {
      const now = Date.now();
      const timeSinceLastFrame = now - agent.sprite.lastFrameTime;
      const frameInterval = 1000 / agent.sprite.animationSpeed; // Convert FPS to milliseconds

      if (timeSinceLastFrame >= frameInterval) {
        // Ciclar entre frames 1-4 (caminhada), pulando o frame 0 (idle)
        agent.sprite.currentFrame = ((agent.sprite.currentFrame - 1 + 1) % 4) + 1;
        agent.sprite.lastFrameTime = now;
      }
    } else {
      // Quando parado, usar o frame 0 (idle)
      agent.sprite.currentFrame = 0;
    }

    // Atualizar direção baseada na velocidade
    if (agent.velocity.x > 0 || (agent.pushedVelocity && agent.pushedVelocity.x > 0)) {
      agent.sprite.direction = 'right';
    } else if (agent.velocity.x < 0 || (agent.pushedVelocity && agent.pushedVelocity.x < 0)) {
      agent.sprite.direction = 'left';
    }
  }

  /**
   * Desenha o sprite do agente
   */
  private drawAgentSprite(agent: AgentCharacter): void {
    if (!agent.sprite || !agent.sprite.image) return;

    const sprite = agent.sprite;
    const frameX = sprite.currentFrame * sprite.frameWidth;
    const frameY = 0;
    
    // Calcular escala baseada no raio do agente
    const scale = (agent.radius * 2) / Math.max(sprite.frameWidth, sprite.frameHeight);
    const scaledWidth = sprite.frameWidth * scale;
    const scaledHeight = sprite.frameHeight * scale;

    this.ctx.save();
    this.ctx.translate(agent.position.x, agent.position.y);
    
    // Espelhar horizontalmente se estiver indo para a esquerda
    if (sprite.direction === 'left') {
      this.ctx.scale(-1, 1);
    }
    
    // Desenhar o frame atual do sprite
    this.ctx.drawImage(
      sprite.image,
      frameX, frameY, sprite.frameWidth, sprite.frameHeight,
      -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight
    );
    
    this.ctx.restore();
  }


  private startGameLoop(): void {
    const gameLoop = (timestamp: number) => {
      const deltaTime = timestamp - this.lastTime;
      this.lastTime = timestamp;

      this.update(deltaTime);
      this.render();

      this.animationFrameId = requestAnimationFrame(gameLoop);
    };

    this.animationFrameId = requestAnimationFrame(gameLoop);
  }

  private update(deltaTime: number): void {
    // Debug: contar agentes ativos vs inativos (apenas ocasionalmente)
    if (Math.random() < 0.001) { // 0.1% de chance a cada frame
      const activeCount = this.agents.filter(a => a.isActive).length;
      const inactiveCount = this.agents.filter(a => !a.isActive).length;
      if (activeCount > 0 || inactiveCount > 0) {
        console.log(`🎮 [STATUS] Agentes: ${activeCount} ativos (processando), ${inactiveCount} inativos (parados)`);
      }
    }

    // Update each agent
    this.agents.forEach(agent => {
      // Update sprite animation
      this.updateSpriteAnimation(agent, deltaTime);
      
      // Só mover se estiver ativo (processando)
      if (agent.isActive) {
        // Add current position to trail
        agent.trail.push({
          x: agent.position.x,
          y: agent.position.y,
          alpha: 1.0
        });

        // Limit trail length (performance)
        if (agent.trail.length > 15) {
          agent.trail.shift();
        }

        // Fade trail
        agent.trail.forEach((point, index) => {
          point.alpha = (index + 1) / agent.trail.length * 0.4;
        });

        // Update position
        agent.position.x += agent.velocity.x;
        agent.position.y += agent.velocity.y;

        // Bounce off walls
        if (agent.position.x - agent.radius < 0 || agent.position.x + agent.radius > this.canvasWidth) {
          agent.velocity.x *= -1;
          agent.position.x = Math.max(agent.radius, Math.min(this.canvasWidth - agent.radius, agent.position.x));
        }

        if (agent.position.y - agent.radius < 0 || agent.position.y + agent.radius > this.canvasHeight) {
          agent.velocity.y *= -1;
          agent.position.y = Math.max(agent.radius, Math.min(this.canvasHeight - agent.radius, agent.position.y));
        }

        // Check collision with other agents
        this.agents.forEach(other => {
          if (agent.id !== other.id) {
            const dx = other.position.x - agent.position.x;
            const dy = other.position.y - agent.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = agent.radius + other.radius;

            if (distance < minDistance) {
              const angle = Math.atan2(dy, dx);
              const sin = Math.sin(angle);
              const cos = Math.cos(angle);

              // 💖 EFEITO DE CORAÇÃO: Spawn de partículas na colisão
              const midX = (agent.position.x + other.position.x) / 2;
              const midY = (agent.position.y + other.position.y) / 2;
              this.spawnHeartParticles(midX, midY);

              if (other.isActive) {
                // Both active: bounce off each other
                const vx1 = agent.velocity.x * cos + agent.velocity.y * sin;
                const vy1 = agent.velocity.y * cos - agent.velocity.x * sin;

                agent.velocity.x = -vx1 * cos - vy1 * sin;
                agent.velocity.y = -vy1 * cos + vx1 * sin;
              } else {
                // Active agent pushes inactive agent
                // Apply temporary velocity to inactive agent for 1 second
                const pushSpeed = 3.0; // Speed of push
                other.pushedVelocity = {
                  x: cos * pushSpeed,
                  y: sin * pushSpeed
                };
                other.pushedUntil = Date.now() + 1000; // Push for 1 second

                // Bounce active agent
                agent.velocity.x *= -0.8;
                agent.velocity.y *= -0.8;
              }

              // Separate agents
              const overlap = minDistance - distance;
              agent.position.x -= overlap * cos * 0.5;
              agent.position.y -= overlap * sin * 0.5;

              if (other.isActive) {
                other.position.x += overlap * cos * 0.5;
                other.position.y += overlap * sin * 0.5;
              }
            }
          }
        });

        // Add some randomness to movement
        if (Math.random() < 0.02) {
          agent.velocity.x += (Math.random() - 0.5) * 0.45;
          agent.velocity.y += (Math.random() - 0.5) * 0.45;
        }

        // Limit speed
        const speed = Math.sqrt(agent.velocity.x ** 2 + agent.velocity.y ** 2);
        const maxSpeed = 3.75;
        if (speed > maxSpeed) {
          agent.velocity.x = (agent.velocity.x / speed) * maxSpeed;
          agent.velocity.y = (agent.velocity.y / speed) * maxSpeed;
        }
      } else {
        // Clear trail when inactive (unless being pushed)
        const now = Date.now();
        const isBeingPushed = agent.pushedUntil && agent.pushedUntil > now;

        if (isBeingPushed && agent.pushedVelocity) {
          // Agent is being pushed - apply temporary velocity
          agent.position.x += agent.pushedVelocity.x;
          agent.position.y += agent.pushedVelocity.y;

          // Bounce off walls while being pushed
          if (agent.position.x - agent.radius < 0 || agent.position.x + agent.radius > this.canvasWidth) {
            agent.pushedVelocity.x *= -1;
            agent.position.x = Math.max(agent.radius, Math.min(this.canvasWidth - agent.radius, agent.position.x));
          }

          if (agent.position.y - agent.radius < 0 || agent.position.y + agent.radius > this.canvasHeight) {
            agent.pushedVelocity.y *= -1;
            agent.position.y = Math.max(agent.radius, Math.min(this.canvasHeight - agent.radius, agent.position.y));
          }

          // Check collision with other agents while being pushed
          this.agents.forEach(other => {
            if (agent.id !== other.id) {
              const dx = other.position.x - agent.position.x;
              const dy = other.position.y - agent.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const minDistance = agent.radius + other.radius;

              if (distance < minDistance && agent.pushedVelocity) {
                const angle = Math.atan2(dy, dx);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                // Bounce pushed agent off the obstacle
                agent.pushedVelocity.x *= -0.6; // Reduce velocity on collision
                agent.pushedVelocity.y *= -0.6;

                // Separate agents
                const overlap = minDistance - distance;
                agent.position.x -= overlap * cos;
                agent.position.y -= overlap * sin;
              }
            }
          });

          // Show small trail while being pushed
          agent.trail.push({
            x: agent.position.x,
            y: agent.position.y,
            alpha: 0.5
          });
          if (agent.trail.length > 8) {
            agent.trail.shift();
          }

          // Apply friction to slow down gradually
          agent.pushedVelocity.x *= 0.98;
          agent.pushedVelocity.y *= 0.98;
        } else {
          // Not being pushed - clear trail and reset push state
          agent.trail = [];
          agent.pushedUntil = undefined;
          agent.pushedVelocity = undefined;
        }
      }
    });

    // 💖 Atualizar partículas de coração
    this.updateHeartParticles(deltaTime);
  }

  private render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw plants
    this.renderPlants();

    // Draw agents based on view mode
    const displayedAgents = this.getDisplayedAgents();
    displayedAgents.forEach(agent => {
      if (this.viewMode === 'agents') {
        this.renderAgentGroup(agent as AgentGroup);
      } else {
        this.renderAgent(agent as AgentCharacter);
      }
    });

    // 💖 Renderizar partículas de coração (acima dos agentes)
    this.renderHeartParticles();
  }

  /**
   * Renderiza todas as plantas no mapa
   */
  private renderPlants(): void {
    this.plants.forEach(plant => {
      this.ctx.save();
      
      // Calcular posição com animação de balanço
      const time = Date.now() * 0.001; // Converter para segundos
      const swayX = Math.sin(time * plant.swaySpeed + plant.animationOffset) * plant.swayAmount;
      const swayY = Math.cos(time * plant.swaySpeed * 0.7 + plant.animationOffset) * (plant.swayAmount * 0.3);
      
      const x = plant.position.x + swayX;
      const y = plant.position.y + swayY;
      
      // Desenhar sombra sutil
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      this.ctx.beginPath();
      this.ctx.ellipse(x + 2, y + 2, plant.size * 0.8, plant.size * 0.3, 0, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Desenhar a planta
      this.ctx.font = `${plant.size}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(plant.emoji, x, y);
      
      this.ctx.restore();
    });
  }

  /**
   * Renderiza um agente individual
   */
  private renderAgent(agent: AgentCharacter): void {
    const { x, y } = agent.position;
    
    // Draw trail
    if (agent.trail.length > 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(agent.trail[0].x, agent.trail[0].y);

      for (let i = 1; i < agent.trail.length; i++) {
        this.ctx.lineTo(agent.trail[i].x, agent.trail[i].y);
      }

      this.ctx.strokeStyle = agent.color;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.3;
      this.ctx.stroke();
      this.ctx.globalAlpha = 1.0;
    }

    // Add execution indicator if currently executing
    if (agent.executionMetrics?.isCurrentlyExecuting) {
      // Pulsing ring around agent
      this.ctx.beginPath();
      this.ctx.arc(x, y, agent.radius + 8, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = 3;
      this.ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 300) * 0.4;
      this.ctx.stroke();
      this.ctx.globalAlpha = 1.0;

      // Spinning dots around agent
      const time = Date.now() / 1000;
      for (let i = 0; i < 3; i++) {
        const angle = (time * 2 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
        const dotX = x + Math.cos(angle) * (agent.radius + 15);
        const dotY = y + Math.sin(angle) * (agent.radius + 15);
        
        this.ctx.beginPath();
        this.ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.globalAlpha = 0.8;
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
      }
    }

    // Draw sprite or emoji fallback
    if (agent.sprite && agent.sprite.image && agent.sprite.totalFrames > 0) {
      // Draw sprite
      this.ctx.drawImage(
        agent.sprite.image,
        agent.sprite.currentFrame * agent.sprite.frameWidth,
        0,
        agent.sprite.frameWidth,
        agent.sprite.frameHeight,
        x - agent.radius,
        y - agent.radius,
        agent.radius * 2,
        agent.radius * 2
      );
    } else {
      // Draw emoji fallback
      this.ctx.font = '24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(agent.emoji, x, y);
    }

    // Draw golden crown for councilors
    if (agent.isCouncilor) {
      const crownSize = 16;
      const crownX = x;
      const crownY = y - agent.radius - 12;

      // Draw crown emoji with golden glow
      this.ctx.save();
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 10;
      this.ctx.font = `${crownSize}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('👑', crownX, crownY);
      this.ctx.restore();

      // Draw golden border around agent
      this.ctx.beginPath();
      this.ctx.arc(x, y, agent.radius + 2, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    }

    // Draw execution count badge
    if (agent.executionMetrics?.totalExecutions > 0) {
      const badgeText = agent.executionMetrics.totalExecutions.toString();
      const badgeWidth = badgeText.length * 8 + 8;
      const badgeHeight = 16;
      const badgeX = x + agent.radius - badgeWidth / 2;
      const badgeY = y - agent.radius - 8;

      // Badge text
      this.ctx.fillStyle = '#667eea';
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 3);
    }
  }

  /**
   * Renderiza um grupo de agentes consolidado
   */
  private renderAgentGroup(group: AgentGroup): void {
    const { x, y } = group.position;
    
    // Draw trail for group
    if (group.instances.length > 0 && group.instances[0].trail.length > 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(group.instances[0].trail[0].x, group.instances[0].trail[0].y);
      
      for (let i = 1; i < group.instances[0].trail.length; i++) {
        this.ctx.lineTo(group.instances[0].trail[i].x, group.instances[0].trail[i].y);
      }
      
      this.ctx.strokeStyle = group.color;
      this.ctx.lineWidth = 3; // Thicker line for groups
      this.ctx.globalAlpha = 0.4;
      this.ctx.stroke();
      this.ctx.globalAlpha = 1.0;
    }

    // Add execution indicator if any instance is currently executing
    if (group.aggregatedMetrics.isCurrentlyExecuting) {
      // Pulsing ring around group
      this.ctx.beginPath();
      this.ctx.arc(x, y, group.instances[0].radius + 12, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = 4;
      this.ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 300) * 0.4;
      this.ctx.stroke();
      this.ctx.globalAlpha = 1.0;

      // Spinning dots around group
      const time = Date.now() / 1000;
      for (let i = 0; i < 4; i++) {
        const angle = (time * 2 + i * (Math.PI * 2 / 4)) % (Math.PI * 2);
        const dotX = x + Math.cos(angle) * (group.instances[0].radius + 20);
        const dotY = y + Math.sin(angle) * (group.instances[0].radius + 20);
        
        this.ctx.beginPath();
        this.ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.globalAlpha = 0.8;
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
      }
    }

    // Draw group as larger circle with emoji
    this.ctx.beginPath();
    this.ctx.arc(x, y, group.instances[0].radius + 4, 0, Math.PI * 2);
    this.ctx.fillStyle = group.color;
    this.ctx.globalAlpha = 0.8;
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;

    // Draw border
    this.ctx.strokeStyle = group.color;
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Draw emoji
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(group.emoji, x, y);

    // Draw instance count badge
    if (group.instances.length > 1) {
      this.renderInstanceCounter(x, y, group.instances.length);
    }

    // Draw activity indicator
    if (group.isActive) {
      this.renderActivityIndicator(x, y);
    }

    // Draw aggregated execution count badge
    if (group.aggregatedMetrics.totalExecutions > 0) {
      const badgeText = group.aggregatedMetrics.totalExecutions.toString();
      const badgeWidth = badgeText.length * 8 + 8;
      const badgeHeight = 16;
      const badgeX = x + group.instances[0].radius - badgeWidth / 2;
      const badgeY = y - group.instances[0].radius - 8;

      // Badge text
      this.ctx.fillStyle = '#667eea';
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 3);
    }
  }

  /**
   * Renderiza contador de instâncias
   */
  private renderInstanceCounter(x: number, y: number, count: number): void {
    const badgeSize = 20;
    const badgeX = x + 20;
    const badgeY = y - 20;
    
    // Badge background
    this.ctx.fillStyle = '#FF4444';
    this.ctx.fillRect(badgeX, badgeY, badgeSize, badgeSize);
    
    // Badge border
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(badgeX, badgeY, badgeSize, badgeSize);
    
    // Count text
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(count.toString(), badgeX + badgeSize/2, badgeY + badgeSize/2);
  }

  /**
   * Renderiza indicador de atividade
   */
  private renderActivityIndicator(x: number, y: number): void {
    const time = Date.now() / 1000;
    const pulseSize = 8 + Math.sin(time * 4) * 2;

    this.ctx.beginPath();
    this.ctx.arc(x, y - 30, pulseSize, 0, Math.PI * 2);
    this.ctx.fillStyle = '#00FF00';
    this.ctx.globalAlpha = 0.7;
    this.ctx.fill();
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Cria partículas de coração quando dois minions se encostam
   */
  private spawnHeartParticles(x: number, y: number): void {
    const particleCount = 3 + Math.floor(Math.random() * 3); // 3-5 corações
    const now = Date.now();

    for (let i = 0; i < particleCount; i++) {
      // Velocidade e direção aleatórias para cima
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 3; // Cone de 60° para cima
      const speed = 1.5 + Math.random() * 1.5; // Velocidade entre 1.5 e 3

      const particle: HeartParticle = {
        id: `heart-${now}-${i}`,
        position: {
          x: x + (Math.random() - 0.5) * 20, // Espalha em X
          y: y + (Math.random() - 0.5) * 20  // Espalha em Y
        },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        },
        alpha: 1.0,
        scale: 0.1, // 💖 COMEÇA PEQUENO! (era 0.5 + random)
        rotation: Math.random() * Math.PI * 2, // Rotação inicial aleatória
        rotationSpeed: (Math.random() - 0.5) * 0.1, // Rotação aleatória
        lifetime: 1500 + Math.random() * 500, // Vive entre 1.5 e 2 segundos
        createdAt: now,
        color: this.getRandomHeartColor()
      };

      this.heartParticles.push(particle);
    }
  }

  /**
   * Retorna cor aleatória para corações (tons de rosa/vermelho)
   */
  private getRandomHeartColor(): string {
    const colors = [
      '#FF1493', // Deep Pink
      '#FF69B4', // Hot Pink
      '#FFB6C1', // Light Pink
      '#FF0080', // Magenta Pink
      '#FF6EB4', // Pink
      '#FF007F'  // Rose
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Atualiza partículas de coração (movimento, crescimento e fade)
   */
  private updateHeartParticles(deltaTime: number): void {
    const now = Date.now();

    // Atualizar cada partícula
    this.heartParticles.forEach(particle => {
      // Atualizar posição
      particle.position.x += particle.velocity.x;
      particle.position.y += particle.velocity.y;

      // Aplicar gravidade suave (acelera para baixo levemente)
      particle.velocity.y += 0.02;

      // Atualizar rotação
      particle.rotation += particle.rotationSpeed;

      // Calcular progresso de vida
      const age = now - particle.createdAt;
      const lifeProgress = age / particle.lifetime;

      // 💖 EFEITO DE CRESCIMENTO: começa pequeno (0.1) e cresce até grande (1.5)
      // Primeira metade da vida: cresce rapidamente
      // Segunda metade: mantém tamanho e desaparece
      if (lifeProgress < 0.5) {
        // Fase de crescimento (0 a 50% da vida)
        const growthProgress = lifeProgress * 2; // 0 a 1
        particle.scale = 0.1 + growthProgress * 1.4; // De 0.1 até 1.5
      } else {
        // Fase de manutenção (50 a 100% da vida)
        particle.scale = 1.5; // Mantém tamanho máximo
      }

      // Fade out gradual (só começa depois de 50% da vida)
      if (lifeProgress < 0.5) {
        particle.alpha = 1.0; // Opaco durante crescimento
      } else {
        const fadeProgress = (lifeProgress - 0.5) * 2; // 0 a 1 na segunda metade
        particle.alpha = Math.max(0, 1 - fadeProgress);
      }
    });

    // Remover partículas mortas
    this.heartParticles = this.heartParticles.filter(particle => {
      const age = now - particle.createdAt;
      return age < particle.lifetime;
    });
  }

  /**
   * Renderiza todas as partículas de coração
   */
  private renderHeartParticles(): void {
    this.heartParticles.forEach(particle => {
      this.ctx.save();

      // Aplicar transformações
      this.ctx.globalAlpha = particle.alpha;
      this.ctx.translate(particle.position.x, particle.position.y);
      this.ctx.rotate(particle.rotation);
      this.ctx.scale(particle.scale, particle.scale);

      // Desenhar coração pixel art (14x14 pixels dobrados = 28x28)
      this.drawPixelHeart(this.ctx, particle.color);

      this.ctx.restore();
    });
  }

  /**
   * Desenha um coração em estilo pixel art
   */
  private drawPixelHeart(ctx: CanvasRenderingContext2D, color: string): void {
    const pixelSize = 2; // Tamanho de cada pixel (dobrado)

    // Padrão de coração pixel art (7x7 grid, dobrado para 14x14)
    const heartPattern = [
      [0,1,1,0,1,1,0],
      [1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1],
      [0,1,1,1,1,1,0],
      [0,0,1,1,1,0,0],
      [0,0,0,1,0,0,0]
    ];

    ctx.fillStyle = color;

    // Desenhar pixels (centralizado em 0,0)
    const offsetX = -(heartPattern[0].length * pixelSize) / 2;
    const offsetY = -(heartPattern.length * pixelSize) / 2;

    heartPattern.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel === 1) {
          ctx.fillRect(
            offsetX + x * pixelSize,
            offsetY + y * pixelSize,
            pixelSize,
            pixelSize
          );
        }
      });
    });

    // Adicionar brilho branco no topo esquerdo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(offsetX + pixelSize, offsetY + pixelSize, pixelSize, pixelSize);
  }

  /**
   * Define o modo de visualização
   */
  public setViewMode(mode: 'instances' | 'agents'): void {
    this.viewMode = mode;
    console.log(`🎮 [VIEW] Modo alterado para: ${mode}`);
  }

  /**
   * Alterna entre modos de visualização
   */
  public toggleViewMode(): void {
    this.viewMode = this.viewMode === 'instances' ? 'agents' : 'instances';
    console.log(`🎮 [VIEW] Modo alternado para: ${this.viewMode}`);
  }

  /**
   * Manipula mudanças nos filtros
   */
  public onFilterChange(): void {
    console.log('🔍 [FILTER] Filtros atualizados:', this.filters);
  }

  /**
   * Manipula mudanças no filtro de tipos de agente
   */
  public onAgentTypeFilterChange(typeValue: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      if (!this.filters.agentTypes.includes(typeValue)) {
        this.filters.agentTypes.push(typeValue);
      }
    } else {
      this.filters.agentTypes = this.filters.agentTypes.filter(t => t !== typeValue);
    }
    this.onFilterChange();
  }

  /**
   * Limpa todos os filtros
   */
  public clearFilters(): void {
    this.filters = {
      showInstances: true,
      showGrouped: false,
      minExecutions: 0,
      agentTypes: [],
      searchTerm: ''
    };
    console.log('🗑️ [FILTER] Filtros limpos');
  }

  /**
   * Alterna visibilidade dos filtros
   */
  public toggleFilters(): void {
    this.showFilters = !this.showFilters;
    console.log(`👁️ [FILTER] Filtros ${this.showFilters ? 'mostrados' : 'ocultos'}`);
  }

  public onCanvasClick(event: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    // Ajustar coordenadas considerando scale do canvas
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    if (this.viewMode === 'agents') {
      // Check if click is on any agent group
      for (const group of this.agentsByType.values()) {
        const dx = x - group.position.x;
        const dy = y - group.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Use raio maior para melhor detecção (raio visual + margem de tolerância)
        // O círculo é desenhado com radius + 4, mais borda de 3px
        const groupRadius = group.instances[0].radius + 8;

        if (distance < groupRadius) {
          console.log(`👆 [CLICK] Grupo clicado:`, {
            name: group.name,
            agentId: group.agentId,
            instances: group.instances.length,
            executions: group.aggregatedMetrics.totalExecutions,
            clickPos: { x, y },
            agentPos: group.position,
            distance,
            radius: groupRadius
          });

          // Create a temporary agent object for the group
          this.selectedAgent = {
            id: group.agentId,
            agentId: group.agentId,
            screenplayId: group.instances[0].screenplayId,
            name: group.name,
            emoji: group.emoji,
            position: group.position,
            velocity: { x: 0, y: 0 },
            isActive: group.isActive,
            radius: groupRadius,
            color: group.color,
            trail: group.instances[0].trail,
            sprite: group.instances[0].sprite,
            executionMetrics: group.aggregatedMetrics
          } as AgentCharacter;

          // Show tooltip
          this.showTooltip = true;
          return;
        }
      }
    } else {
      // Check if click is on any agent instance
      for (const agent of this.agents) {
        const dx = x - agent.position.x;
        const dy = y - agent.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Aumentar área de clique para melhor detecção
        // O sprite é desenhado em radius * 2, então usamos radius + margem
        const clickRadius = agent.radius + 2;

        if (distance < clickRadius) {
          this.selectedAgent = agent;

          // DEBUG: Verificar vinculação
          console.log(`👆 [CLICK] Agente clicado:`, {
            name: agent.name,
            instance_id: agent.id,
            agentId: agent.agentId,
            executions: agent.executionMetrics.totalExecutions,
            clickPos: { x, y },
            agentPos: agent.position,
            distance,
            radius: clickRadius
          });

          // Show tooltip
          this.showTooltip = true;
          return;
        }
      }
    }

    // Click outside agents - hide tooltip
    this.showTooltip = false;
  }

  public closeTooltip(): void {
    this.showTooltip = false;
    this.selectedAgent = null;
    this.isDraggingTooltip = false;
  }

  /**
   * Inicia o arraste do tooltip
   */
  public onTooltipMouseDown(event: MouseEvent): void {
    // Só permite arrastar se clicar no header
    const target = event.target as HTMLElement;
    if (target.classList.contains('tooltip-header') || target.classList.contains('tooltip-emoji')) {
      this.isDraggingTooltip = true;
      this.dragOffsetX = event.clientX - this.tooltipX;
      this.dragOffsetY = event.clientY - this.tooltipY;
      event.preventDefault();
    }
  }

  /**
   * Durante o arraste do tooltip
   */
  public onTooltipMouseMove(event: MouseEvent): void {
    if (this.isDraggingTooltip) {
      this.tooltipX = event.clientX - this.dragOffsetX;
      this.tooltipY = event.clientY - this.dragOffsetY;
      event.preventDefault();
    }
  }

  /**
   * Finaliza o arraste do tooltip
   */
  public onTooltipMouseUp(): void {
    this.isDraggingTooltip = false;
  }

  /**
   * Listener para tecla ESC - fecha o tooltip e filtros
   */
  @HostListener('document:keydown', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // Prioridade: fechar tooltip primeiro, depois filtros
      if (this.showTooltip) {
        this.closeTooltip();
        event.preventDefault();
      } else if (this.showFilters) {
        this.toggleFilters();
        event.preventDefault();
      }
    }
  }

  public onCanvasMouseMove(event: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if mouse is over any agent
    for (const agent of this.agents) {
      const dx = x - agent.position.x;
      const dy = y - agent.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < agent.radius) {
        // Mouse is over an agent
        if (this.hoveredAgent !== agent) {
          this.hoveredAgent = agent;
          this.showMiniMapPopup = true;

          // DEBUG: Log agent metrics when hovering (comentado para reduzir poluição)
          // console.log(`🖱️ [HOVER] Agent: ${agent.name}, Executions: ${agent.executionMetrics.totalExecutions}`);

          // Position popup near the agent
          this.miniMapPopupX = event.clientX + 15;
          this.miniMapPopupY = event.clientY - 10;

          // Clear existing timeout
          if (this.popupTimeout) {
            clearTimeout(this.popupTimeout);
          }

          // Set auto-hide timeout (3 seconds)
          this.popupTimeout = setTimeout(() => {
            this.showMiniMapPopup = false;
            this.hoveredAgent = null;
          }, 3000);
        }
        return;
      }
    }

    // Mouse is not over any agent
    if (this.hoveredAgent) {
      this.hoveredAgent = null;
      this.showMiniMapPopup = false;
      if (this.popupTimeout) {
        clearTimeout(this.popupTimeout);
        this.popupTimeout = null;
      }
    }
  }

  public onCanvasMouseLeave(event: MouseEvent): void {
    // Hide popup when mouse leaves canvas
    this.hoveredAgent = null;
    this.showMiniMapPopup = false;
    if (this.popupTimeout) {
      clearTimeout(this.popupTimeout);
      this.popupTimeout = null;
    }
  }

  /**
   * Formata tempo de execução para exibição
   */
  public formatExecutionTime(milliseconds: number): string {
    return this.agentMetricsService.formatExecutionTime(milliseconds);
  }

  /**
   * Formata data da última execução para exibição
   */
  public formatLastExecution(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h atrás`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}min atrás`;
    } else if (minutes > 0) {
      return `${minutes}min ${seconds % 60}s atrás`;
    } else if (seconds > 10) {
      return `${seconds}s atrás`;
    } else {
      return 'Agora mesmo';
    }
  }

  public getScreenplayUrl(screenplayId: string): string {
    // Generate URL to open screenplay in a new tab
    const baseUrl = window.location.origin;
    return `${baseUrl}/screenplay?screenplayId=${screenplayId}`;
  }

  // Public method to update agent status from parent component
  public setAgentActive(instanceId: string, isActive: boolean): void {
    const agent = this.agents.find(a => a.id === instanceId);
    if (agent) {
      console.log(`🎮 [AGENT-GAME] Setting agent ${agent.name} (${instanceId}) to ${isActive ? 'ACTIVE (Processando)' : 'INACTIVE (Parado)'}`);
      agent.isActive = isActive;
      
      if (isActive) {
        // Se ficou ativo, dar velocidade aleatória para começar a se mover
        agent.velocity.x = (Math.random() - 0.5) * 2.25;
        agent.velocity.y = (Math.random() - 0.5) * 2.25;
      } else {
        // Se ficou inativo, parar a velocidade e limpar trail
        agent.velocity.x = 0;
        agent.velocity.y = 0;
        agent.trail = [];
        agent.pushedUntil = undefined;
        agent.pushedVelocity = undefined;
      }
    } else {
      console.warn(`⚠️ [AGENT-GAME] Agent with instanceId ${instanceId} not found`);
    }
  }

  // Public method to add new agent
  public addAgent(agentData: { emoji: string, name: string, agentId: string, screenplayId: string, instanceId?: string }): void {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#74B9FF'];
    const position = this.findNonOverlappingPosition();

    // Obter sprite de personagem (50% chance de ser masculino ou feminino)
    const isFemale = Math.random() > 0.5;
    const spriteKey = isFemale ? 'character-female' : 'character-male';
    const characterSprite = this.spriteAnimations.get(spriteKey);

    const newAgent: AgentCharacter = {
      id: agentData.instanceId || `agent_${Date.now()}`,
      agentId: agentData.agentId,
      screenplayId: agentData.screenplayId,
      name: agentData.name,
      emoji: agentData.emoji,
      position: position,
      velocity: {
        x: 0, // Iniciar parado
        y: 0  // Iniciar parado
      },
      isActive: false,
      radius: this.AGENT_RADIUS,
      color: colors[Math.floor(Math.random() * colors.length)],
      trail: [],
      // Sprite animation
      sprite: characterSprite ? {
        image: characterSprite.image,
        frameWidth: characterSprite.frameWidth,
        frameHeight: characterSprite.frameHeight,
        currentFrame: 0,
        totalFrames: characterSprite.totalFrames,
        animationSpeed: characterSprite.animationSpeed,
        lastFrameTime: 0,
        direction: 'right'
      } : {
        image: new Image(),
        frameWidth: 0,
        frameHeight: 0,
        currentFrame: 0,
        totalFrames: 0,
        animationSpeed: 0,
        lastFrameTime: 0,
        direction: 'right'
      },
      executionMetrics: {
        totalExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        isCurrentlyExecuting: false
      }
    };

    this.agents.push(newAgent);
    
    // Inicializar métricas do agente
    this.initializeAgentMetrics(newAgent);
  }

  // Public method to reload agents from BFF
  public async reloadAgents(): Promise<void> {
    await this.loadAgentsFromBFF();
  }

  // Public method to clear all agents immediately
  public clearAllAgents(): void {
    console.log('🎮 [AGENT-GAME] Clearing all agents immediately');
    this.agents = [];
  }

  // Public method to remove an agent by instance ID
  public removeAgent(instanceId: string): void {
    const index = this.agents.findIndex(a => a.id === instanceId);
    if (index !== -1) {
      const removedAgent = this.agents[index];
      this.agents.splice(index, 1);
      console.log(`🎮 [AGENT-GAME] Removed agent ${removedAgent.name} (${instanceId})`);
    } else {
      console.warn(`⚠️ [AGENT-GAME] Agent with instanceId ${instanceId} not found`);
    }
  }

  /**
   * Calcula a porcentagem de performance baseada nas métricas
   */
  public getPerformancePercentage(metrics: any): number {
    if (!metrics || metrics.totalExecutions === 0) {
      return 0;
    }
    
    // Fórmula simples: baseada no número de execuções e tempo médio
    const executionScore = Math.min(metrics.totalExecutions * 10, 50); // Máximo 50 pontos por execuções
    const timeScore = metrics.averageExecutionTime > 0 ? 
      Math.max(0, 50 - (metrics.averageExecutionTime / 1000)) : 0; // Penaliza tempo alto
    
    return Math.min(100, Math.round(executionScore + timeScore));
  }

  /**
   * Reseta as métricas de um agente específico
   * @param instanceId - O instance_id do agente (não o agentId!)
   */
  public resetAgentMetrics(instanceId: string): void {
    this.agentMetricsService.resetAgentMetrics(instanceId);

    // Atualizar o agente no canvas
    // IMPORTANTE: buscar por agent.id (instance_id)
    const agent = this.agents.find(a => a.id === instanceId);
    if (agent) {
      agent.executionMetrics = {
        totalExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        isCurrentlyExecuting: false
      };
    }

    console.log(`🔄 [METRICS] Métricas resetadas para instância ${instanceId}`);

    // Forçar detecção de mudanças para atualizar UI
    this.cdr.detectChanges();
  }

  /**
   * Alterna a exibição de estatísticas avançadas
   */
  public toggleAdvancedStats(): void {
    this.showAdvancedStats = !this.showAdvancedStats;
  }

  /**
   * Calcula a taxa de sucesso baseada nas execuções
   */
  getSuccessRate(metrics: AgentExecutionMetrics): number {
    if (metrics.totalExecutions === 0) return 0;
    
    // Simula taxa de sucesso baseada no tempo médio de execução
    // Tempos menores indicam maior sucesso
    const avgTime = metrics.averageExecutionTime;
    if (avgTime === 0) return 100;
    
    // Taxa de sucesso inversamente proporcional ao tempo médio
    const successRate = Math.max(0, Math.min(100, 100 - (avgTime / 1000) * 10));
    return Math.round(successRate);
  }

  /**
   * Calcula o tempo de ciclo (tempo entre execuções)
   */
  getCycleTime(metrics: AgentExecutionMetrics): string {
    if (metrics.totalExecutions < 2) return 'N/A';
    
    // Simula tempo de ciclo baseado na última execução
    const now = new Date();
    const lastExec = metrics.lastExecutionTime;
    
    if (!lastExec) return 'N/A';
    
    const cycleTime = now.getTime() - lastExec.getTime();
    return this.formatExecutionTime(cycleTime);
  }

  /**
   * Calcula a produtividade (execuções por minuto)
   */
  getProductivity(metrics: AgentExecutionMetrics): string {
    if (metrics.totalExecutions === 0) return '0/min';
    
    // Simula produtividade baseada no tempo total
    const totalTimeMinutes = metrics.totalExecutionTime / (1000 * 60);
    if (totalTimeMinutes === 0) return '∞/min';
    
    const productivity = metrics.totalExecutions / totalTimeMinutes;
    return `${productivity.toFixed(1)}/min`;
  }

  /**
   * Calcula a tendência de performance
   */
  public getPerformanceTrend(metrics: AgentExecutionMetrics): number {
    if (metrics.totalExecutions < 2) return 0;

    // Simula tendência baseada na comparação entre tempo médio e tempo total
    const avgTime = metrics.averageExecutionTime;
    const totalTime = metrics.totalExecutionTime;
    const expectedAvg = totalTime / metrics.totalExecutions;

    if (expectedAvg === 0) return 0;

    const trend = ((expectedAvg - avgTime) / expectedAvg) * 100;
    return Math.round(trend);
  }

  /**
   * DEBUG: Método para verificar métricas de UM agente específico
   * Chame no console: debugAgent("Test Quick Validation")
   */
  debugSingleAgent(name: string): void {
    const agent = this.agents.find(a => a.name.toLowerCase().includes(name.toLowerCase()));

    if (!agent) {
      console.log(`❌ Agente "${name}" não encontrado!`);
      console.log(`📋 Agentes disponíveis: ${this.agents.map(a => a.name).join(', ')}`);
      return;
    }

    console.log('🐛 ========== DEBUG: MÉTRICAS DO AGENTE ==========');
    console.log(`🐛 Nome: ${agent.name}`);
    console.log(`🐛 Agent ID: ${agent.agentId}`);
    console.log(`🐛 Instance ID: ${agent.id}`);
    console.log(`🐛 Emoji: ${agent.emoji}`);
    console.log(`🐛 Is Active: ${agent.isActive}`);
    console.log('🐛 ═══════════════════════════════════════════════');

    console.log(`📊 executionMetrics (no objeto do agente):`);
    console.log(agent.executionMetrics);

    // IMPORTANTE: usar agent.id (instance_id)
    const serviceMetrics = this.agentMetricsService.getCurrentMetrics(agent.id);
    console.log(`🔄 Métricas no AgentMetricsService:`);
    console.log(serviceMetrics);

    if (agent.executionMetrics.totalExecutions !== serviceMetrics.totalExecutions) {
      console.log(`⚠️ DIVERGÊNCIA DETECTADA!`);
    } else {
      console.log(`✅ Métricas sincronizadas corretamente`);
    }

    console.log('🐛 ═══════════════════════════════════════════════');
    console.log('🐛 Recarregando estatísticas da API...');
    this.loadAgentStatisticsFromAPI(agent);
  }

  /**
   * DEBUG: Método para verificar métricas de todos os agentes
   * Chame no console: debugAgentMetrics()
   */
  debugAllAgentMetrics(): void {
    console.log('🐛 ========== DEBUG: MÉTRICAS DE TODOS OS AGENTES ==========');
    console.log(`🐛 Total de agentes no canvas: ${this.agents.length}`);
    console.log('🐛 ========================================================');

    this.agents.forEach((agent, index) => {
      // IMPORTANTE: usar agent.id (instance_id)
      const serviceMetrics = this.agentMetricsService.getCurrentMetrics(agent.id);
      const divergence = agent.executionMetrics.totalExecutions !== serviceMetrics.totalExecutions;

      console.log(`\n[${index + 1}] ${agent.name} ${agent.emoji}`);
      console.log(`   Instance: ${agent.id}`);
      console.log(`   Canvas: ${agent.executionMetrics.totalExecutions} execs | Service: ${serviceMetrics.totalExecutions} execs ${divergence ? '⚠️' : '✅'}`);
    });

    console.log('\n🐛 ========================================================');
    console.log('💡 Use debugAgent("nome") para ver detalhes de um agente específico');
  }

  /**
   * Toggle do painel de debug visual
   * Chame no console: toggleDebug()
   */
  public toggleDebugPanel(): void {
    this.showDebugPanel = !this.showDebugPanel;

    if (this.showDebugPanel) {
      console.log('🐛 Painel de debug ATIVADO - veja no canto superior esquerdo do canvas');
      // Atualizar a cada 1 segundo
      this.debugRefreshInterval = setInterval(() => {
        this.cdr.detectChanges();
      }, 1000);
    } else {
      console.log('🐛 Painel de debug DESATIVADO');
      if (this.debugRefreshInterval) {
        clearInterval(this.debugRefreshInterval);
        this.debugRefreshInterval = null;
      }
    }

    this.cdr.detectChanges();
  }

  /**
   * Obtém informações de debug para exibição no painel
   */
  public getDebugInfo(): string {
    const info: string[] = [];
    info.push(`📊 AGENTES (${this.agents.length})`);
    info.push('─────────────────────');

    this.agents.forEach((agent, index) => {
      // IMPORTANTE: usar agent.id (instance_id)
      const serviceMetrics = this.agentMetricsService.getCurrentMetrics(agent.id);
      const divergence = agent.executionMetrics.totalExecutions !== serviceMetrics.totalExecutions;

      info.push(`${index + 1}. ${agent.emoji} ${agent.name}`);
      info.push(`   ID: ${agent.id.substring(0, 20)}...`); // Mostrar parte do instance_id
      info.push(`   Canvas: ${agent.executionMetrics.totalExecutions} execs`);
      info.push(`   Service: ${serviceMetrics.totalExecutions} execs ${divergence ? '⚠️ DIFF' : '✅'}`);
      info.push(`   Total: ${this.formatExecutionTime(agent.executionMetrics.totalExecutionTime)}`);
      info.push(`   Avg: ${this.formatExecutionTime(agent.executionMetrics.averageExecutionTime)}`);
      info.push('');
    });

    return info.join('\n');
  }
}
