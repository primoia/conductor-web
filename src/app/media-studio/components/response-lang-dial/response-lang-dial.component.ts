import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MediaStudioWebSocketService } from '../../services/media-studio-websocket.service';
import { ResponseLangInfo } from '../../models/media-studio.models';

@Component({
  selector: 'app-response-lang-dial',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dial-wrap" *ngIf="langs.length > 1"
         (click)="$event.stopPropagation()"
         (touchstart)="$event.stopPropagation(); $event.preventDefault()">
      <!-- LED indicators — all options visible, active one lit -->
      <div class="led-strip">
        <div
          *ngFor="let l of langs"
          class="led-item"
          [class.active]="l.id === currentLang"
        >
          <span class="led-dot"></span>
          <span class="led-text">{{ ledIcon(l) }} {{ l.short }}</span>
        </div>
      </div>
      <!-- Round cycle button -->
      <button
        class="cycle-btn"
        (click)="cycle(); $event.stopPropagation()"
        (touchstart)="cycle(); $event.stopPropagation(); $event.preventDefault()"
      >
        <span class="cycle-icon">LG</span>
      </button>
      <span class="cycle-sub">{{ current?.label || '' }}</span>
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
      background: rgba(76, 175, 80, 0.3);
      transition: all 0.3s ease;
    }

    .led-item.active .led-dot {
      background: #4caf50;
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
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
      color: rgba(76, 175, 80, 0.9);
      text-shadow: 0 0 6px rgba(76, 175, 80, 0.3);
    }

    .cycle-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(76, 175, 80, 0.35);
      background: rgba(3, 5, 10, 0.85);
      backdrop-filter: blur(12px);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s ease;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.12),
                  inset 0 0 6px rgba(76, 175, 80, 0.04);
    }

    .cycle-btn:hover {
      border-color: rgba(76, 175, 80, 0.6);
      box-shadow: 0 0 18px rgba(76, 175, 80, 0.25),
                  inset 0 0 10px rgba(76, 175, 80, 0.08);
    }

    .cycle-btn:active {
      transform: scale(0.9);
    }

    .cycle-icon {
      font-size: 16px;
      line-height: 1;
      color: rgba(76, 175, 80, 0.9);
      font-weight: 700;
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    }

    .cycle-sub {
      font-size: 7px;
      color: rgba(255, 255, 255, 0.3);
      letter-spacing: 1px;
    }
  `],
})
export class ResponseLangDialComponent implements OnInit, OnDestroy {
  langs: ResponseLangInfo[] = [];
  currentLang = 'auto';

  private destroy$ = new Subject<void>();

  constructor(private wsSvc: MediaStudioWebSocketService) {}

  ngOnInit(): void {
    this.wsSvc.responseLangs$.pipe(takeUntil(this.destroy$)).subscribe(l => this.langs = l);
    this.wsSvc.responseCurrentLang$.pipe(takeUntil(this.destroy$)).subscribe(l => this.currentLang = l);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cycle(): void {
    if (this.langs.length < 2) return;
    const idx = this.langs.findIndex(l => l.id === this.currentLang);
    const next = (idx + 1) % this.langs.length;
    this.wsSvc.setResponseLang(this.langs[next].id);
  }

  get current(): ResponseLangInfo | undefined {
    return this.langs.find(l => l.id === this.currentLang);
  }

  ledIcon(l: ResponseLangInfo): string {
    switch (l.id) {
      case 'auto':  return '\uD83D\uDD04'; // 🔄
      case 'pt-BR': return '\u26A1';        // ⚡
      case 'en':    return '\uD83C\uDDFA\uD83C\uDDF8'; // 🇺🇸
      default:      return '';
    }
  }
}
