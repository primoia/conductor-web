import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { AnimState, AgentCarouselItem } from './models/media-studio.models';
import { VisualizerCanvasComponent } from './components/visualizer-canvas/visualizer-canvas.component';
import { StatusHudComponent } from './components/status-hud/status-hud.component';
import { AgentCarouselComponent } from './components/agent-carousel/agent-carousel.component';
import { TranscriptOverlayComponent } from './components/transcript-overlay/transcript-overlay.component';
import { SttDialComponent } from './components/stt-dial/stt-dial.component';
import { LlmDialComponent } from './components/llm-dial/llm-dial.component';
import { VoiceDialComponent } from './components/voice-dial/voice-dial.component';
import { ResponseLangDialComponent } from './components/response-lang-dial/response-lang-dial.component';
import { MediaStudioWebSocketService } from './services/media-studio-websocket.service';
import { MediaStudioConfigService } from './services/media-studio-config.service';

@Component({
  selector: 'app-media-studio',
  standalone: true,
  imports: [
    CommonModule,
    VisualizerCanvasComponent,
    StatusHudComponent,
    AgentCarouselComponent,
    TranscriptOverlayComponent,
    SttDialComponent,
    LlmDialComponent,
    VoiceDialComponent,
    ResponseLangDialComponent,
  ],
  template: `
    <div class="media-studio-root" (click)="onTap()" (touchstart)="onTouchStart($event)">
      <app-visualizer-canvas></app-visualizer-canvas>
      <app-status-hud
        [statusText]="statusText"
        [statusClass]="statusClass"
        [animState]="animState"
        [infoText]="infoText"
        [maxRecSeconds]="maxRecSeconds"
        [recordStart]="recordStart"
        [pipelineSummary]="pipelineSummary"
        [languageMismatch]="languageMismatch"
        [activeAgent]="activeAgent"
        [agentLocked]="agentLocked"
        [micMuted]="micMuted"
        (lockToggle)="onLockToggle()"
        (muteToggle)="onMuteToggle()"
      ></app-status-hud>
      <app-agent-carousel
        [agents]="agents"
        [animState]="animState"
        [activeAgent]="activeAgent"
      ></app-agent-carousel>
      <app-transcript-overlay></app-transcript-overlay>
      <div class="dial-row">
        <app-stt-dial></app-stt-dial>
        <app-response-lang-dial></app-response-lang-dial>
        <app-llm-dial></app-llm-dial>
        <app-voice-dial></app-voice-dial>
      </div>
    </div>
  `,
  styleUrls: ['./media-studio.component.scss'],
})
export class MediaStudioComponent implements OnInit, OnDestroy {
  statusText = 'PRIMOIA MEDIA STUDIO';
  statusClass = 'idle';
  animState: AnimState = 'idle';
  infoText = '';
  maxRecSeconds = 10;
  recordStart = 0;
  agents: AgentCarouselItem[] = [];
  activeAgent: string | null = null;
  pipelineSummary = '';
  languageMismatch = false;
  agentLocked = false;
  micMuted = false;

  private destroy$ = new Subject<void>();

  constructor(
    private wsSvc: MediaStudioWebSocketService,
    private configSvc: MediaStudioConfigService,
  ) {}

  ngOnInit(): void {
    this.wsSvc.statusText$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.statusText = v));
    this.wsSvc.statusClass$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.statusClass = v));
    this.wsSvc.animState$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.animState = v));
    this.wsSvc.infoText$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.infoText = v));
    this.wsSvc.maxRecSeconds$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.maxRecSeconds = v));
    this.wsSvc.recordStart$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.recordStart = v));
    this.configSvc.agents.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.agents = v));
    this.wsSvc.activeAgent$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.activeAgent = v));
    this.wsSvc.agentLocked$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.agentLocked = v));
    this.wsSvc.micMuted$.pipe(takeUntil(this.destroy$)).subscribe((v) => (this.micMuted = v));

    // Pipeline summary line: combines all 4 dials into a single status string
    combineLatest([
      this.wsSvc.sttActiveProfile$,
      this.wsSvc.sttProfiles$,
      this.wsSvc.responseCurrentLang$,
      this.wsSvc.responseLangs$,
      this.wsSvc.llmCurrentProvider$,
      this.wsSvc.llmProviders$,
      this.wsSvc.ttsCurrentVoice$,
      this.wsSvc.ttsVoices$,
    ]).pipe(takeUntil(this.destroy$)).subscribe(([sttId, sttProfiles, respLangId, respLangs, llmId, llmProviders, ttsId, ttsVoices]) => {
      const sttProfile = sttProfiles.find(p => p.id === sttId);
      const respLang = respLangs.find(l => l.id === respLangId);
      const llmProv = llmProviders.find(p => p.id === llmId);
      const ttsVoice = ttsVoices.find(v => v.id === ttsId);

      const sttLabel = sttProfile ? (sttProfile.language === 'pt' ? 'PT-BR' : sttProfile.language === 'en' ? 'EN' : 'MULTI') : '';
      const respLabel = respLang ? respLang.short : 'AUT';
      const llmLabel = llmProv ? llmProv.name : '';
      const ttsLabel = ttsVoice ? `${ttsVoice.label}${ttsVoice.language ? ' (' + ttsVoice.language + ')' : ''}` : '';

      this.pipelineSummary = `\uD83C\uDFA4 ${sttLabel} \u2192 \uD83D\uDCAC ${respLabel} \u2192 \uD83E\uDD16 ${llmLabel} \u2192 \uD83D\uDD0A ${ttsLabel}`;

      // Mismatch: response language differs from TTS voice language
      const respBase = respLangId === 'auto' ? '' : respLangId.split('-')[0];
      const ttsLang = ttsVoice?.language || '';
      const ttsBase = ttsLang === 'multi' ? '' : ttsLang.split('-')[0];
      this.languageMismatch = respBase !== '' && ttsBase !== '' && respBase !== ttsBase;
    });

    this.configSvc.loadAgents();

    // Auto-connect (may fail if browser requires user gesture)
    this.wsSvc.startStreaming().catch(() => {});
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsSvc.stopStreaming();
  }

  onTap(): void {
    // Barge-in: tap during speaking/thinking interrupts the response
    if (this.animState === 'speaking' || this.animState === 'thinking') {
      this.wsSvc.interrupt();
      return;
    }
    this.wsSvc.toggleMic();
  }

  onLockToggle(): void {
    this.wsSvc.toggleAgentLock();
  }

  onMuteToggle(): void {
    this.wsSvc.toggleMicMute();
  }

  onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    // Barge-in: tap during speaking/thinking interrupts the response
    if (this.animState === 'speaking' || this.animState === 'thinking') {
      this.wsSvc.interrupt();
      return;
    }
    this.wsSvc.toggleMic();
  }
}
