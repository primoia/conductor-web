import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-agent-game',
  standalone: true,
  imports: [CommonModule],
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

  // Tooltip state
  selectedAgent: AgentCharacter | null = null;
  tooltipX = 0;
  tooltipY = 0;
  showTooltip = false;
  showAdvancedStats = false;

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
  private readonly AGENT_RADIUS = 12;

  // Debug panel state
  showDebugPanel = false;
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
    // Criar sprite de personagem básico (4 frames de caminhada)
    const spriteData = this.createWalkingCharacterSprite();
    this.spriteAnimations.set('character', spriteData);
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
   * Cria um sprite de personagem caminhando usando canvas
   */
  private createWalkingCharacterSprite(): SpriteAnimation {
    const frameWidth = 32;
    const frameHeight = 32;
    const totalFrames = 5; // 4 frames de caminhada + 1 frame idle
    
    // Criar canvas temporário para desenhar o sprite
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = frameWidth * totalFrames;
    tempCanvas.height = frameHeight;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Desenhar 5 frames: 1 idle + 4 de caminhada
    for (let frame = 0; frame < totalFrames; frame++) {
      const x = frame * frameWidth;
      
      // Desenhar personagem baseado na referência
      tempCtx.save();
      tempCtx.translate(x, 0); // Sem centralização para usar coordenadas absolutas
      
      // Corpo (Retângulo) - baseado na referência
      tempCtx.fillStyle = '#FFD700'; // Amarelo dourado
      tempCtx.fillRect(4, 12, 24, 16); // Retângulo 24x16px
      
      // Cabeça (Retângulo) - baseado na referência
      tempCtx.fillStyle = '#FFD700'; // Amarelo dourado
      tempCtx.fillRect(10, 2, 12, 8); // Retângulo 12x8px acima do corpo
      
      // Olhos - baseado na referência
      tempCtx.fillStyle = '#000'; // Preto
      tempCtx.fillRect(13, 4, 2, 2); // Olho esquerdo
      tempCtx.fillRect(17, 4, 2, 2); // Olho direito
      
      if (frame === 0) {
        // Frame IDLE (parado) - baseado na referência
        // Calção azul
        tempCtx.fillStyle = '#4169E1'; // Azul
        tempCtx.fillRect(8, 24, 16, 6); // Calção azul
        
        // Pernas amarelas separadas
        tempCtx.fillStyle = '#FFD700'; // Amarelo dourado
        tempCtx.fillRect(10, 30, 4, 8); // Perna esquerda
        tempCtx.fillRect(18, 30, 4, 8); // Perna direita
        
        // Braços (idle) - baseado na referência
        tempCtx.fillStyle = '#FFD700'; // Amarelo dourado
        tempCtx.fillRect(2, 16, 4, 6); // Braço esquerdo
        tempCtx.fillRect(26, 16, 4, 6); // Braço direito
      } else {
        // Frames de caminhada (1-4) - baseado na referência
        const walkFrame = frame - 1; // Ajustar para 0-3
        const legOffset = Math.sin(walkFrame * Math.PI / 2) * 3; // Movimento das pernas
        const armOffset = Math.sin(walkFrame * Math.PI / 2) * 2; // Movimento dos braços
        
        // Calção azul
        tempCtx.fillStyle = '#4169E1'; // Azul
        tempCtx.fillRect(8, 24, 16, 6); // Calção azul
        
        // Pernas amarelas separadas com movimento
        tempCtx.fillStyle = '#FFD700'; // Amarelo dourado
        tempCtx.fillRect(10 - legOffset, 30, 4, 8); // Perna esquerda
        tempCtx.fillRect(18 + legOffset, 30, 4, 8); // Perna direita
        
        // Braços com movimento - baseado na referência
        tempCtx.fillStyle = '#FFD700'; // Amarelo dourado
        
        // Braço esquerdo com movimento
        tempCtx.fillRect(2 - armOffset, 16, 4, 6);
        
        // Braço direito com movimento
        tempCtx.fillRect(26 + armOffset, 16, 4, 6);
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
      const url = `${baseUrl}/api/agents/instances?limit=500`;
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
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#74B9FF', '#FD79A8', '#FDCB6E', '#6C5CE7'];

    // Find non-overlapping position
    const position = this.findNonOverlappingPosition();

    // Obter sprite de personagem
    const characterSprite = this.spriteAnimations.get('character');
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
      color: colors[this.agents.length % colors.length],
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
    const apiUrl = `${baseUrl}/api/agents/instances/${instanceId}`;

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
  }

  private render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw plants
    this.renderPlants();

    // Draw agents
    this.agents.forEach(agent => {
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

      // Círculo removido - apenas sprite/emoji visível
      // Área de contato mantida através do radius para detecção de clique

      // Add execution indicator if currently executing
      if (agent.executionMetrics?.isCurrentlyExecuting) {
        // Pulsing ring around agent
        this.ctx.beginPath();
        this.ctx.arc(agent.position.x, agent.position.y, agent.radius + 8, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 3;
        this.ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 300) * 0.4;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;

        // Spinning dots around agent
        const time = Date.now() / 1000;
        for (let i = 0; i < 3; i++) {
          const angle = (time * 2 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
          const dotX = agent.position.x + Math.cos(angle) * (agent.radius + 15);
          const dotY = agent.position.y + Math.sin(angle) * (agent.radius + 15);
          
          this.ctx.beginPath();
          this.ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
          this.ctx.fillStyle = '#f59e0b';
          this.ctx.globalAlpha = 0.8;
          this.ctx.fill();
          this.ctx.globalAlpha = 1.0;
        }
      }

      // Draw sprite or emoji fallback
      if (agent.sprite && agent.sprite.totalFrames > 0) {
        this.drawAgentSprite(agent);
      } else {
        // Fallback para emoji se sprite não estiver disponível
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(agent.emoji, agent.position.x, agent.position.y);
      }

      // Draw execution count badge if agent has executions
      if (agent.executionMetrics?.totalExecutions > 0) {
        const badgeText = agent.executionMetrics.totalExecutions.toString();
        const badgeWidth = badgeText.length * 8 + 8;
        const badgeHeight = 16;
        const badgeX = agent.position.x + agent.radius - badgeWidth / 2;
        const badgeY = agent.position.y - agent.radius - 8;

        // Badge background removido - fundo transparente
        // this.ctx.fillStyle = '#667eea';
        // this.ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);

        // Badge text
        this.ctx.fillStyle = '#667eea'; // Texto azul para contraste
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 3);
      }
    });
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

  onCanvasClick(event: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if click is on any agent
    for (const agent of this.agents) {
      const dx = x - agent.position.x;
      const dy = y - agent.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < agent.radius) {
        this.selectedAgent = agent;

        // DEBUG: Verificar vinculação
        console.log(`👆 [CLICK] Agente clicado:`, {
          name: agent.name,
          instance_id: agent.id,
          agentId: agent.agentId,
          executions: agent.executionMetrics.totalExecutions
        });

        // Position tooltip - usar altura maior para incluir o instance_id
        const tooltipWidth = 320;
        const tooltipHeight = 500; // Aumentado para acomodar todo o conteúdo

        // Calcular posição inicial (à direita do cursor)
        let tooltipX = event.clientX + 20;
        let tooltipY = event.clientY - tooltipHeight / 2; // Centralizar verticalmente no cursor

        // Obter dimensões da viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Ajustar se ultrapassar borda direita
        if (tooltipX + tooltipWidth > viewportWidth - 10) {
          tooltipX = event.clientX - tooltipWidth - 20; // Posicionar à esquerda
        }

        // Ajustar se ultrapassar borda superior
        if (tooltipY < 10) {
          tooltipY = 10;
        }

        // Ajustar se ultrapassar borda inferior
        if (tooltipY + tooltipHeight > viewportHeight - 10) {
          tooltipY = viewportHeight - tooltipHeight - 10;
        }

        this.tooltipX = tooltipX;
        this.tooltipY = tooltipY;
        this.showTooltip = true;
        return;
      }
    }

    // Click outside agents - hide tooltip
    this.showTooltip = false;
  }

  closeTooltip(): void {
    this.showTooltip = false;
    this.selectedAgent = null;
  }

  onCanvasMouseMove(event: MouseEvent): void {
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

  onCanvasMouseLeave(event: MouseEvent): void {
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
  formatExecutionTime(milliseconds: number): string {
    return this.agentMetricsService.formatExecutionTime(milliseconds);
  }

  /**
   * Formata data da última execução para exibição
   */
  formatLastExecution(date: Date): string {
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

  getScreenplayUrl(screenplayId: string): string {
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

    // Obter sprite de personagem
    const characterSprite = this.spriteAnimations.get('character');

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
  toggleAdvancedStats(): void {
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
  getPerformanceTrend(metrics: AgentExecutionMetrics): number {
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
  toggleDebugPanel(): void {
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
  getDebugInfo(): string {
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
