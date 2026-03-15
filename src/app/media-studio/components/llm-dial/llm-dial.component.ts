import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MediaStudioWebSocketService } from '../../services/media-studio-websocket.service';
import { LlmProviderInfo } from '../../models/media-studio.models';

@Component({
  selector: 'app-llm-dial',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dial-wrap" *ngIf="providers.length > 1"
         (click)="$event.stopPropagation()"
         (touchstart)="$event.stopPropagation(); $event.preventDefault()">
      <!-- LED indicators — all providers visible, active one lit -->
      <div class="led-strip" [class.leds-visible]="ledsVisible">
        <div
          *ngFor="let p of providers"
          class="led-item"
          [class.active]="p.id === currentProvider"
        >
          <span class="led-dot"></span>
          <span class="led-text">{{ p.name }}</span>
        </div>
      </div>
      <!-- Round cycle button -->
      <button
        class="cycle-btn"
        (click)="cycle(); $event.stopPropagation()"
        (touchstart)="cycle(); $event.stopPropagation(); $event.preventDefault()"
      >
        <span class="cycle-icon">{{ currentIcon }}</span>
      </button>
      <span class="cycle-sub">{{ current?.model || '' }}</span>
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
      background: rgba(206, 96, 240, 0.3);
      transition: all 0.3s ease;
    }

    .led-item.active .led-dot {
      background: #ce60f0;
      box-shadow: 0 0 8px rgba(206, 96, 240, 0.6);
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
      color: rgba(206, 96, 240, 0.9);
      text-shadow: 0 0 6px rgba(206, 96, 240, 0.3);
    }

    /* Round button */
    .cycle-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(206, 96, 240, 0.35);
      background: rgba(3, 5, 10, 0.85);
      backdrop-filter: blur(12px);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s ease;
      box-shadow: 0 0 10px rgba(206, 96, 240, 0.12),
                  inset 0 0 6px rgba(206, 96, 240, 0.04);
    }

    .cycle-btn:hover {
      border-color: rgba(206, 96, 240, 0.6);
      box-shadow: 0 0 18px rgba(206, 96, 240, 0.25),
                  inset 0 0 10px rgba(206, 96, 240, 0.08);
    }

    .cycle-btn:active {
      transform: scale(0.9);
    }

    .cycle-icon {
      font-size: 16px;
      line-height: 1;
      color: rgba(206, 96, 240, 0.9);
      font-weight: 700;
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    }

    .cycle-sub {
      font-size: 7px;
      color: rgba(255, 255, 255, 0.3);
      letter-spacing: 1px;
      max-width: 90px;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @media (max-width: 767px) and (orientation: portrait) {
      .dial-wrap { flex-direction: row; gap: 8px; }
      .led-strip {
        flex-direction: row; gap: 6px;
        max-width: 0; opacity: 0; overflow: hidden;
        transition: max-width 0.3s ease, opacity 0.3s ease;
      }
      .led-strip.leds-visible { max-width: 200px; opacity: 1; }
      .cycle-btn { width: 36px; height: 36px; flex-shrink: 0; }
      .cycle-icon { font-size: 14px; }
      .cycle-sub { display: none; }
      .led-text { font-size: 6px; letter-spacing: 1px; }
    }
  `],
})
export class LlmDialComponent implements OnInit, OnDestroy {
  providers: LlmProviderInfo[] = [];
  currentProvider = '';
  ledsVisible = false;

  private destroy$ = new Subject<void>();
  private hideTimer: any;

  private static readonly ICONS: Record<string, string> = {
    deepseek: 'DS',
    openai: 'AI',
    claude: 'CL',
    groq: 'GQ',
    default: 'LM',
  };

  constructor(private wsSvc: MediaStudioWebSocketService) {}

  ngOnInit(): void {
    this.wsSvc.llmProviders$.pipe(takeUntil(this.destroy$)).subscribe(p => this.providers = p);
    this.wsSvc.llmCurrentProvider$.pipe(takeUntil(this.destroy$)).subscribe(p => this.currentProvider = p);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cycle(): void {
    if (this.providers.length < 2) return;
    const isPortrait = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
    if (isPortrait && !this.ledsVisible) {
      this.ledsVisible = true;
      this.resetHideTimer();
      return;
    }
    const idx = this.providers.findIndex(p => p.id === this.currentProvider);
    const next = (idx + 1) % this.providers.length;
    this.wsSvc.setLlmProvider(this.providers[next].id);
    if (isPortrait) this.resetHideTimer();
  }

  private resetHideTimer(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.ledsVisible = false, 3000);
  }

  get current(): LlmProviderInfo | undefined {
    return this.providers.find(p => p.id === this.currentProvider);
  }

  get currentIcon(): string {
    return LlmDialComponent.ICONS[this.currentProvider] || LlmDialComponent.ICONS['default'];
  }
}
