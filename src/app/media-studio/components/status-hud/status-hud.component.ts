import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimState } from '../../models/media-studio.models';

@Component({
  selector: 'app-status-hud',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hud hud-top">
      <div class="status-line" [ngClass]="statusClass">{{ statusText }}</div>
      <div class="pipeline-line" *ngIf="pipelineSummary" [class.mismatch]="languageMismatch">{{ pipelineSummary }}</div>
    </div>

    <div class="rec-timer" [class.active]="animState === 'recording'">
      <span class="rec-dot"></span>
      <span>{{ recTimeDisplay }}</span> / <span>{{ recMaxDisplay }}</span>
    </div>

    <div class="control-buttons" *ngIf="activeAgent && animState !== 'idle'">
      <button class="ctrl-btn lock-btn" [class.active]="agentLocked"
              (click)="$event.stopPropagation(); lockToggle.emit()"
              (touchstart)="onBtnTouch($event, 'lock')"
              [attr.title]="agentLocked ? 'Agent travado (clique para destravar)' : 'Travar agent (impede timeout)'">
        <svg class="ctrl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path *ngIf="agentLocked" d="M7 11V7a5 5 0 0 1 10 0v4"/>
          <path *ngIf="!agentLocked" d="M7 11V7a5 5 0 0 1 9.9-1"/>
        </svg>
      </button>
      <button class="ctrl-btn mic-btn" [class.active]="micMuted"
              (click)="$event.stopPropagation(); muteToggle.emit()"
              (touchstart)="onBtnTouch($event, 'mute')"
              [attr.title]="micMuted ? 'Mic mutado (clique para ativar)' : 'Mutar mic (silencia entrada)'">
        <svg *ngIf="!micMuted" class="ctrl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        <svg *ngIf="micMuted" class="ctrl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    </div>

    <div class="info-line">{{ infoText }}</div>
  `,
  styleUrls: ['./status-hud.component.scss'],
})
export class StatusHudComponent implements OnChanges, OnDestroy {
  @Input() statusText = 'PRIMOIA MEDIA STUDIO';
  @Input() statusClass = 'idle';
  @Input() animState: AnimState = 'idle';
  @Input() infoText = '';
  @Input() maxRecSeconds = 10;
  @Input() recordStart = 0;
  @Input() pipelineSummary = '';
  @Input() languageMismatch = false;
  @Input() activeAgent: string | null = null;
  @Input() agentLocked = false;
  @Input() micMuted = false;

  @Output() lockToggle = new EventEmitter<void>();
  @Output() muteToggle = new EventEmitter<void>();

  recTimeDisplay = '00:00';
  recMaxDisplay = '00:10';
  private timerId: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['maxRecSeconds']) {
      this.recMaxDisplay = this.formatTime(this.maxRecSeconds);
    }
    if (changes['animState']) {
      if (this.animState === 'recording') {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  onBtnTouch(e: TouchEvent, action: string): void {
    e.stopPropagation();
    e.preventDefault();
    if (action === 'lock') this.lockToggle.emit();
    if (action === 'mute') this.muteToggle.emit();
  }

  private startTimer(): void {
    this.stopTimer();
    this.timerId = setInterval(() => {
      const secs = Math.min((Date.now() - this.recordStart) / 1000, this.maxRecSeconds);
      this.recTimeDisplay = this.formatTime(secs);
    }, 100);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
}
