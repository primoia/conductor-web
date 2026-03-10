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
      <button class="ctrl-btn" [class.active]="agentLocked"
              (click)="$event.stopPropagation(); lockToggle.emit()"
              (touchstart)="onBtnTouch($event, 'lock')"
              [attr.title]="agentLocked ? 'Agent travado' : 'Travar agent'">
        <span class="ctrl-icon">{{ agentLocked ? '\uD83D\uDD12' : '\uD83D\uDD13' }}</span>
      </button>
      <button class="ctrl-btn" [class.active]="micMuted"
              (click)="$event.stopPropagation(); muteToggle.emit()"
              (touchstart)="onBtnTouch($event, 'mute')"
              [attr.title]="micMuted ? 'Mic mutado' : 'Mutar mic'">
        <span class="ctrl-icon">{{ micMuted ? '\uD83D\uDD07' : '\uD83C\uDFA4' }}</span>
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
