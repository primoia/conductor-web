import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimState } from '../../models/media-studio.models';

@Component({
  selector: 'app-status-hud',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="hud hud-top">
      <div class="status-line" [ngClass]="statusClass">{{ statusText }}</div>
    </div>

    <div class="rec-timer" [class.active]="animState === 'recording'">
      <span class="rec-dot"></span>
      <span>{{ recTimeDisplay }}</span> / <span>{{ recMaxDisplay }}</span>
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
