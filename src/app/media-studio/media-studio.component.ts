import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AnimState, AgentCarouselItem } from './models/media-studio.models';
import { VisualizerCanvasComponent } from './components/visualizer-canvas/visualizer-canvas.component';
import { StatusHudComponent } from './components/status-hud/status-hud.component';
import { AgentCarouselComponent } from './components/agent-carousel/agent-carousel.component';
import { TranscriptOverlayComponent } from './components/transcript-overlay/transcript-overlay.component';
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
      ></app-status-hud>
      <app-agent-carousel
        [agents]="agents"
        [animState]="animState"
        [activeAgent]="activeAgent"
      ></app-agent-carousel>
      <app-transcript-overlay></app-transcript-overlay>
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
