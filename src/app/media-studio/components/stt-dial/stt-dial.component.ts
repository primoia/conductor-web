import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MediaStudioWebSocketService } from '../../services/media-studio-websocket.service';
import { SttProfile } from '../../models/media-studio.models';

@Component({
  selector: 'app-stt-dial',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dial-wrap" *ngIf="profiles.length > 1">
      <!-- LED indicators — all options visible, active one lit -->
      <div class="led-strip">
        <div
          *ngFor="let p of profiles"
          class="led-item"
          [class.active]="p.id === activeProfile"
        >
          <span class="led-dot"></span>
          <span class="led-text">{{ shortLabel(p) }}</span>
        </div>
      </div>
      <!-- Round cycle button -->
      <button
        class="cycle-btn"
        (click)="cycle()"
        (touchstart)="$event.stopPropagation()"
      >
        <span class="cycle-icon">{{ currentIcon }}</span>
      </button>
      <span class="cycle-sub">{{ current?.latency || '' }}</span>
    </div>
  `,
  styles: [`
    .dial-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      pointer-events: auto;
    }

    /* LED strip — shows all options like washing machine indicator LEDs */
    .led-strip {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .led-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      opacity: 0.3;
      transition: all 0.3s ease;
    }

    .led-item.active {
      opacity: 1;
    }

    .led-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: rgba(0, 180, 220, 0.3);
      transition: all 0.3s ease;
    }

    .led-item.active .led-dot {
      background: #00b4dc;
      box-shadow: 0 0 8px rgba(0, 180, 220, 0.6);
    }

    .led-text {
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.3);
      white-space: nowrap;
    }

    .led-item.active .led-text {
      color: rgba(0, 180, 220, 0.9);
      text-shadow: 0 0 6px rgba(0, 180, 220, 0.3);
    }

    /* Round button */
    .cycle-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(0, 180, 220, 0.35);
      background: rgba(3, 5, 10, 0.85);
      backdrop-filter: blur(12px);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s ease;
      box-shadow: 0 0 10px rgba(0, 180, 220, 0.12),
                  inset 0 0 6px rgba(0, 180, 220, 0.04);
    }

    .cycle-btn:hover {
      border-color: rgba(0, 180, 220, 0.6);
      box-shadow: 0 0 18px rgba(0, 180, 220, 0.25),
                  inset 0 0 10px rgba(0, 180, 220, 0.08);
    }

    .cycle-btn:active {
      transform: scale(0.9);
    }

    .cycle-icon {
      font-size: 18px;
      line-height: 1;
    }

    .cycle-sub {
      font-size: 7px;
      color: rgba(255, 255, 255, 0.3);
      letter-spacing: 1px;
    }
  `],
})
export class SttDialComponent implements OnInit, OnDestroy {
  profiles: SttProfile[] = [];
  activeProfile = 'fast';

  private destroy$ = new Subject<void>();

  constructor(private wsSvc: MediaStudioWebSocketService) {}

  ngOnInit(): void {
    this.wsSvc.sttProfiles$.pipe(takeUntil(this.destroy$)).subscribe(p => this.profiles = p);
    this.wsSvc.sttActiveProfile$.pipe(takeUntil(this.destroy$)).subscribe(p => this.activeProfile = p);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cycle(): void {
    if (this.profiles.length < 2) return;
    const idx = this.profiles.findIndex(p => p.id === this.activeProfile);
    const next = (idx + 1) % this.profiles.length;
    this.wsSvc.setSttProfile(this.profiles[next].id);
  }

  get current(): SttProfile | undefined {
    return this.profiles.find(p => p.id === this.activeProfile);
  }

  get currentIcon(): string {
    const p = this.current;
    if (!p) return '\u26A1';
    switch (p.language) {
      case 'pt': return '\u26A1';
      case 'en': return '\uD83C\uDDFA\uD83C\uDDF8';
      default:   return '\uD83C\uDF10';
    }
  }

  shortLabel(p: SttProfile): string {
    switch (p.language) {
      case 'pt': return 'PT-BR';
      case 'en': return 'EN';
      default:   return 'MULTI';
    }
  }
}
