import {
  Component, OnInit, AfterViewInit, OnDestroy,
  HostListener, ViewChild, ElementRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import {
  ContextSidebarComponent,
  HudHeaderComponent,
  StatusFooterComponent,
  GlobalChatComponent,
  OrbitalAgentsComponent,
  CoreIntegrityComponent,
  AgentRadarComponent,
  InboundStreamComponent,
  InteractionPanelComponent,
  DeepAnalysisComponent,
  AgentRegistrationModalComponent,
  JarvisCoreComponent,
  OrbitalAgent,
  ChatMessage,
  ContextGroup,
  SystemMetric,
  NewAgentData
} from 'jarvis-ui/src/public-api';

import { MediaStudioWebSocketService } from '../media-studio/services/media-studio-websocket.service';
import { MediaStudioConfigService } from '../media-studio/services/media-studio-config.service';
import { WsMessage } from '../media-studio/models/media-studio.models';
import { VoiceCaptureService } from 'jarvis-ui/src/app/services/voice-capture.service';

const AGENT_COLORS = ['#f59e0b', '#d946ef', '#10b981', '#ef4444', '#818cf8', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6'];
const ICON_TYPES: ('robot' | 'shield' | 'circle')[] = ['robot', 'shield', 'circle'];

@Component({
  selector: 'app-jarvis-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ContextSidebarComponent,
    HudHeaderComponent,
    StatusFooterComponent,
    GlobalChatComponent,
    OrbitalAgentsComponent,
    CoreIntegrityComponent,
    AgentRadarComponent,
    InboundStreamComponent,
    InteractionPanelComponent,
    DeepAnalysisComponent,
    AgentRegistrationModalComponent,
    JarvisCoreComponent
  ],
  templateUrl: './jarvis-dashboard.component.html',
  styleUrls: ['./jarvis-dashboard.component.scss']
})
export class JarvisDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  Math = Math;

  // UI state
  showDetailedAnalysis = false;
  showCommunicationHub = false;
  showAgentRegistration = false;
  showInteractionPanel = false;
  sidebarExpanded = false;
  activeContextId = 'voice';
  isMicActive = false;
  isAgentWorking = false;
  systemStatus = 'IDLE';

  @ViewChild('agentsContainer') agentsContainer!: ElementRef;

  agentScale = 1.0;
  isResizing = false;
  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  private standbyPositions = new Map<string, { nx: number; ny: number }>();
  private subs: Subscription[] = [];
  private audioInterval: ReturnType<typeof setInterval> | null = null;

  // Streaming LLM message being built
  private streamingMsgId: string | null = null;

  wsSvc = inject(MediaStudioWebSocketService);
  private cfgSvc = inject(MediaStudioConfigService);
  private voiceSvc = inject(VoiceCaptureService);
  private rafId: number | null = null;

  logs: string[] = [
    'JARVIS PIPELINE STANDBY...',
    'WAITING FOR VOICE UPLINK...',
    'NEURAL LOAD STABILIZED.'
  ];

  agents: OrbitalAgent[] = [];
  activeInteraction: ChatMessage[] = [];

  contextGroups: ContextGroup[] = [
    {
      id: 'voice',
      name: 'VOICE',
      category: 'PIPELINE',
      icon: 'calendar',
      agents: []
    },
    {
      id: 'assistants',
      name: 'ASSISTANTS',
      category: 'AI',
      icon: 'research',
      agents: [
        { id: 'a1', name: 'ORACLE', status: 'standby', color: '#06b6d4', iconType: 'robot', audioBars: [6, 3, 5], animationDelay: '0s', radarX: 0, radarY: 0 },
        { id: 'a2', name: 'FRIDAY', status: 'standby', color: '#f59e0b', iconType: 'robot', audioBars: [2, 2, 2], animationDelay: '1s', radarX: 0, radarY: 0 }
      ]
    },
    {
      id: 'tools',
      name: 'TOOLS',
      category: 'MCP',
      icon: 'shopping',
      agents: [
        { id: 't1', name: 'ARES', status: 'standby', color: '#ef4444', iconType: 'shield', audioBars: [5, 2, 4], animationDelay: '0.5s', radarX: 0, radarY: 0 },
        { id: 't2', name: 'VISION', status: 'standby', color: '#818cf8', iconType: 'circle', audioBars: [2, 4, 2], animationDelay: '1.5s', radarX: 0, radarY: 0 }
      ]
    },
    {
      id: 'social',
      name: 'SOCIAL',
      category: 'NETWORK',
      icon: 'social',
      agents: [
        { id: 's1', name: 'JOCASTA', status: 'standby', color: '#10b981', iconType: 'shield', audioBars: [4, 4, 4], animationDelay: '0.2s', radarX: 0, radarY: 0 },
        { id: 's2', name: 'EDITH', status: 'standby', color: '#d946ef', iconType: 'circle', audioBars: [1, 3, 1], animationDelay: '0.8s', radarX: 0, radarY: 0 }
      ]
    }
  ];

  metrics: SystemMetric[] = [
    { label: 'CPU', value: 42 },
    { label: 'MEM', value: 68 },
    { label: 'NET', value: 89 }
  ];

  // ── Lifecycle ──

  ngOnInit(): void {
    this.updateAgentScale();

    // Random audio bars animation
    this.audioInterval = setInterval(() => this.updateAgentAudio(), 150);

    // Auto-connect to jarvis-server WebSocket (may fail if browser requires user gesture)
    this.wsSvc.startStreaming().then(() => {
      this.isMicActive = true;
      this.addLog('VOICE UPLINK ESTABLISHED');
    }).catch(() => {
      this.addLog('AUTO-CONNECT PENDING // TAP MIC TO CONNECT');
    });

    // Sync isMicActive with actual WS streaming state
    this.subs.push(
      this.wsSvc.animState$.subscribe(st => {
        this.isMicActive = st !== 'idle';
        // Sync VoiceCaptureService recording state so hive animation starts/stops
        this.voiceSvc.isRecording.set(st !== 'idle');
      })
    );

    // Audio bridge: pump wsSvc.freqData → voiceSvc.audioLevels at 60fps
    // This feeds the JarvisHiveComponent animation which reads voiceSvc.audioLevels()
    this.startAudioBridge();

    // Load wake-word agents from jarvis-server config into the VOICE context group
    this.cfgSvc.loadAgents();
    this.subs.push(
      this.cfgSvc.agents.subscribe(items => {
        const voiceGroup = this.contextGroups.find(g => g.id === 'voice');
        if (!voiceGroup) return;
        voiceGroup.agents = items.map((item, i) => ({
          id: `ww-${i}`,
          name: item.name.toUpperCase(),
          status: 'standby' as const,
          color: AGENT_COLORS[item.colorIdx % AGENT_COLORS.length],
          iconType: ICON_TYPES[i % ICON_TYPES.length],
          audioBars: [3, 5, 2],
          animationDelay: `${i * 0.3}s`,
          radarX: 0,
          radarY: 0
        }));
        if (this.activeContextId === 'voice') {
          this.agents = [...voiceGroup.agents];
          this.agents.forEach(a => this.positionAgent(a));
        }
      })
    );

    // Subscribe to WS messages for HUD mapping
    this.subs.push(
      this.wsSvc.message$.subscribe(msg => this.onWsMessage(msg))
    );

    // Map WS animState to systemStatus
    this.subs.push(
      this.wsSvc.animState$.subscribe(st => {
        switch (st) {
          case 'idle': this.systemStatus = 'IDLE'; break;
          case 'connecting': this.systemStatus = 'CONNECTING'; break;
          case 'listening': this.systemStatus = 'LISTENING'; break;
          case 'recording': this.systemStatus = 'RECORDING'; break;
          case 'thinking': this.systemStatus = 'PROCESSING'; break;
          case 'speaking': this.systemStatus = 'SPEAKING'; break;
        }
      })
    );
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.activeContextId) {
        this.switchContext(this.activeContextId);
      }
    }, 0);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.audioInterval) clearInterval(this.audioInterval);
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.stopAudioBridge();
    // Reset voice service state so hive stops
    this.voiceSvc.isRecording.set(false);
    this.voiceSvc.audioLevels.set([]);
    // Disconnect WS when leaving the route
    if (this.wsSvc.streaming) {
      this.wsSvc.stopStreaming();
    }
  }

  // ── Audio bridge: wsSvc → voiceSvc (feeds JarvisHive) ──

  private startAudioBridge(): void {
    const pump = () => {
      this.wsSvc.updateAudioData();
      // Convert first 32 bins from Uint8Array (0-255) to normalized floats (0-1)
      const freq = this.wsSvc.freqData;
      const levels: number[] = [];
      const len = Math.min(32, freq.length);
      for (let i = 0; i < len; i++) {
        levels.push(freq[i] / 255);
      }
      this.voiceSvc.audioLevels.set(levels);
      this.rafId = requestAnimationFrame(pump);
    };
    this.rafId = requestAnimationFrame(pump);
  }

  private stopAudioBridge(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // ── WebSocket event → HUD mapping ──

  private onWsMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'config':
        this.addLog('UPLINK ESTABLISHED // SESSION ' + (msg.session_id || '').slice(0, 8).toUpperCase());
        break;

      case 'wake_word': {
        const keyword = msg.keyword?.toUpperCase() || 'AGENT';
        this.addLog(`WAKE WORD DETECTED // ${keyword}`);
        // Activate matching orbital agent
        const match = this.agents.find(a => a.name === keyword);
        if (match) {
          this.activateAgent(match);
        }
        break;
      }

      case 'transcription': {
        const text = msg.text || '';
        this.addLog('STT // ' + text.slice(0, 40).toUpperCase());
        this.activeInteraction = [{
          id: crypto.randomUUID(),
          sender: 'user',
          text,
          timestamp: new Date().toLocaleTimeString()
        }, ...this.activeInteraction];
        break;
      }

      case 'llm_start':
        this.isAgentWorking = true;
        this.addLog('LLM PROCESSING...');
        // Create streaming message placeholder
        this.streamingMsgId = crypto.randomUUID();
        {
          const active = this.getActiveAgent();
          this.activeInteraction = [{
            id: this.streamingMsgId,
            sender: 'agent',
            agentName: active?.name || 'JARVIS',
            agentColor: active?.color,
            text: '',
            timestamp: new Date().toLocaleTimeString(),
            isStreaming: true
          }, ...this.activeInteraction];
        }
        break;

      case 'llm_token': {
        const delta = msg.text || '';
        if (this.streamingMsgId) {
          const streamMsg = this.activeInteraction.find(m => m.id === this.streamingMsgId);
          if (streamMsg) {
            streamMsg.text += delta;
          }
        }
        break;
      }

      case 'llm_end':
        this.isAgentWorking = false;
        if (this.streamingMsgId) {
          const streamMsg = this.activeInteraction.find(m => m.id === this.streamingMsgId);
          if (streamMsg) {
            streamMsg.isStreaming = false;
          }
          this.streamingMsgId = null;
        }
        this.addLog('LLM COMPLETE');
        break;

      case 'tts_start':
        this.addLog('TTS SYNTHESIZING...');
        break;

      case 'tts_end':
        this.addLog('TTS COMPLETE');
        break;

      case 'interrupted':
        this.isAgentWorking = false;
        if (this.streamingMsgId) {
          const streamMsg = this.activeInteraction.find(m => m.id === this.streamingMsgId);
          if (streamMsg) {
            streamMsg.isStreaming = false;
            streamMsg.text += ' [INTERRUPTED]';
          }
          this.streamingMsgId = null;
        }
        this.addLog('BARGE-IN // INTERRUPTED');
        break;

      case 'conversation_end':
        this.addLog('CONVERSATION END');
        // Deactivate all agents
        this.agents.forEach(a => {
          if (a.status === 'active') a.status = 'standby';
        });
        this.agents.forEach(a => this.positionAgent(a));
        this.showInteractionPanel = false;
        break;
    }
  }

  private activateAgent(agent: OrbitalAgent): void {
    this.agents.forEach(a => {
      if (a.status === 'active') a.status = 'standby';
    });
    agent.status = 'active';
    this.showInteractionPanel = true;
    this.activeInteraction = [{
      sender: 'agent',
      agentName: agent.name,
      agentColor: agent.color,
      text: 'UPLINK ESTABLISHED. READY FOR COMMANDS.',
      timestamp: new Date().toLocaleTimeString()
    }];
    this.agents.forEach(a => this.positionAgent(a));
  }

  // ── Mic control (delegates to WebSocket service) ──

  triggerMicrophone(): void {
    // Check actual WS state, not just local flag
    const animState = this.wsSvc.animState$.getValue();

    // If speaking or thinking, interrupt instead of toggling mic
    if (animState === 'speaking' || animState === 'thinking') {
      this.wsSvc.interrupt();
      this.addLog('BARGE-IN // USER INTERRUPT');
      return;
    }

    if (this.wsSvc.streaming) {
      this.wsSvc.stopStreaming();
      this.addLog('VOICE UPLINK TERMINATED');
    } else {
      this.wsSvc.startStreaming().catch(err =>
        console.error('Voice uplink failed:', err)
      );
      this.addLog('VOICE UPLINK INITIALIZING...');
    }
  }

  // ── Agent & UI actions (same as original dashboard) ──

  toggleScan(): void {
    this.systemStatus = this.systemStatus === 'SCANNING' ? 'ACTIVE' : 'SCANNING';
  }

  openAgentRegistration(): void {
    this.showAgentRegistration = true;
  }

  registerAgent(agentData: NewAgentData): void {
    this.addLog('NEW UNIT REGISTERED // ' + agentData.name.toUpperCase() + ' // ' + this.activeContextId.toUpperCase() + ' CLUSTER');
    this.showAgentRegistration = false;

    const currentGroup = this.contextGroups.find(g => g.id === this.activeContextId);
    const newUnit: OrbitalAgent = {
      id: Math.random().toString(36).substr(2, 9),
      name: agentData.name,
      status: 'standby',
      color: agentData.color,
      iconType: agentData.iconType,
      top: '50%',
      left: '50%',
      audioBars: [2, 3, 2],
      animationDelay: '0s',
      radarX: 0,
      radarY: 0
    };
    if (currentGroup) {
      currentGroup.agents = [...(currentGroup.agents || []), newUnit];
    }
    this.agents = [...this.agents, newUnit];
    this.positionAgent(newUnit);
  }

  toggleAgent(agentName: string): void {
    const agent = this.agents.find(a => a.name === agentName);
    if (!agent) return;

    const wasActive = agent.status === 'active';
    if (!wasActive) {
      this.activateAgent(agent);
    } else {
      agent.status = 'standby';
      this.showInteractionPanel = false;
    }
    this.agents.forEach(a => this.positionAgent(a));
  }

  toggleSidebar(): void {
    this.sidebarExpanded = !this.sidebarExpanded;
  }

  toggleGlobalChat(): void {
    this.showCommunicationHub = !this.showCommunicationHub;
  }

  switchContext(groupId: string): void {
    this.activeContextId = groupId;
    const group = this.contextGroups.find(g => g.id === groupId);
    if (group && group.agents) {
      this.agents = [...group.agents];
      this.agents.forEach(a => this.positionAgent(a));
    }
  }

  getActiveAgent(): OrbitalAgent | undefined {
    return this.agents.find(a => a.status === 'active');
  }

  closePanels(): void {
    this.showDetailedAnalysis = false;
    this.showAgentRegistration = false;
    this.showInteractionPanel = false;
  }

  openDetailedAnalysis(): void {
    this.showDetailedAnalysis = true;
  }

  // ── Helpers ──

  private addLog(text: string): void {
    this.logs = [text, ...this.logs].slice(0, 20);
  }

  onLogGenerated(log: string): void {
    this.addLog(log);
  }

  private updateAgentAudio(): void {
    this.agents.forEach(agent => {
      if (agent.audioBars) {
        agent.audioBars = agent.audioBars.map(() => Math.floor(Math.random() * 8) + 1);
      }
    });
  }

  // ── Responsive scaling ──

  @HostListener('window:resize')
  onResize(): void {
    this.isResizing = true;
    this.updateAgentScale();
    this.agents.forEach(a => this.positionAgent(a));
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => { this.isResizing = false; }, 300);
  }

  private updateAgentScale(): void {
    const scaleW = window.innerWidth / 1920;
    const scaleH = window.innerHeight / 1080;
    this.agentScale = Math.min(Math.max(Math.min(scaleW, scaleH), 0.5), 1.1);
  }

  // ── Orbital positioning (copied from original dashboard) ──

  private positionAgent(agent: OrbitalAgent): void {
    if (!this.agentsContainer) return;

    const container = this.agentsContainer.nativeElement;
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    if (agent.status === 'active') {
      const activeAgents = this.agents.filter(a => a.status === 'active');
      const total = activeAgents.length || 1;
      const activeIndex = activeAgents.indexOf(agent);
      const angleStep = (Math.PI * 2) / total;
      const currentAngle = (activeIndex * angleStep) - (Math.PI / 2);
      this.setAgentCoords(agent, 280 * this.agentScale, currentAngle);
    } else {
      if (!this.standbyPositions.has(agent.id) || containerWidth === 0) {
        let x = 0, y = 0, attempts = 0, colliding = true;
        let minDist = 130 * this.agentScale;

        if (containerWidth === 0) return;

        if (this.agents.length > 15) minDist = 105 * this.agentScale;
        if (this.agents.length > 22) minDist = 85 * this.agentScale;

        const innerForbiddenRadius = 380 * this.agentScale;
        const margin = 80 * this.agentScale;
        const maxX = (containerWidth / 2) - margin;
        const maxY = (containerHeight / 2) - margin;

        while (colliding && attempts < 150) {
          x = (Math.random() * 2 - 1) * maxX;
          y = (Math.random() * 2 - 1) * maxY;
          const radius = Math.sqrt(x * x + y * y);
          if (radius < innerForbiddenRadius) { attempts++; continue; }

          colliding = false;
          for (const [id, pos] of this.standbyPositions) {
            if (id === agent.id) continue;
            const ox = pos.nx * maxX;
            const oy = pos.ny * maxY;
            const dist = Math.sqrt(Math.pow(x - ox, 2) + Math.pow(y - oy, 2));
            if (dist < (attempts > 70 ? minDist * 0.7 : minDist)) {
              colliding = true;
              break;
            }
          }
          attempts++;
        }
        this.standbyPositions.set(agent.id, { nx: x / maxX, ny: y / maxY });
      }

      const pos = this.standbyPositions.get(agent.id)!;
      const margin = 80 * this.agentScale;
      const maxX = (containerWidth / 2) - margin;
      const maxY = (containerHeight / 2) - margin;
      const x = pos.nx * maxX;
      const y = pos.ny * maxY;
      const radius = Math.sqrt(x * x + y * y);
      const angle = Math.atan2(y, x);
      this.setAgentCoords(agent, radius, angle);
    }

    if (agent.status === 'active') {
      this.standbyPositions.delete(agent.id);
    }

    const matchX = (agent.left || '').match(/calc\(50% \+ ([-]?\d+)px/);
    const matchY = (agent.top || '').match(/calc\(50% \+ ([-]?\d+)px/);
    const xCoord = matchX ? parseInt(matchX[1]) : 0;
    const yCoord = matchY ? parseInt(matchY[1]) : 0;
    agent.radarX = 50 + (xCoord / 14);
    agent.radarY = 50 + (yCoord / 14);
  }

  private setAgentCoords(agent: OrbitalAgent, radius: number, angle: number): void {
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const offset = 48 * this.agentScale;
    agent.top = `calc(50% + ${Math.round(y)}px - ${offset}px)`;
    agent.left = `calc(50% + ${Math.round(x)}px - ${offset}px)`;
  }
}
