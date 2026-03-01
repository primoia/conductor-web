import {
  Component, Input, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { TranscriptEntry, WsMessage } from '../../models/media-studio.models';
import { getEngineColor } from '../../constants/media-studio-palette';
import { MediaStudioWebSocketService } from '../../services/media-studio-websocket.service';

interface DisplayEntry {
  text: string;
  type: 'partial' | 'final' | 'wake' | 'speaking';
  engine?: string;
  engineCss?: string;
  engineCssDim?: string;
  engineCssBg?: string;
  fading: boolean;
  faded: boolean;
  typewriterText: string;
  typewriterDone: boolean;
  showCursor: boolean;
}

@Component({
  selector: 'app-transcript-overlay',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="transcript-area">
      <div
        *ngIf="entries.length === 0"
        class="placeholder"
      >
        Transcriptions will appear here
      </div>
      <div
        *ngIf="speakingIndicator"
        class="transcript-entry speaking-indicator"
      >
        Falando...
      </div>
      <div
        *ngFor="let entry of entries; trackBy: trackByIdx"
        class="transcript-entry"
        [class.partial]="entry.type === 'partial'"
        [class.wake]="entry.type === 'wake'"
        [class.fading]="entry.fading"
        [class.faded]="entry.faded"
      >
        <span
          *ngIf="entry.engine && (entry.type === 'wake' || entry.type === 'final')"
          class="engine-tag"
          [style.background]="entry.engineCssBg"
          [style.color]="entry.engineCss"
          [style.border]="'1px solid ' + entry.engineCssDim"
        >
          {{ entry.engine | uppercase }}
        </span>
        <span>{{ entry.typewriterDone ? entry.text : entry.typewriterText }}</span>
        <span *ngIf="entry.showCursor" class="tw-cursor"></span>
      </div>
    </div>
  `,
  styleUrls: ['./transcript-overlay.component.scss'],
})
export class TranscriptOverlayComponent implements OnDestroy {
  entries: DisplayEntry[] = [];
  speakingIndicator = false;
  private partialEntry: DisplayEntry | null = null;
  private activeEngine: string | null = null;
  private destroy$ = new Subject<void>();
  private readonly MAX_ENTRIES = 4;

  constructor(
    private wsSvc: MediaStudioWebSocketService,
    private cdr: ChangeDetectorRef,
  ) {
    this.wsSvc.message$.pipe(takeUntil(this.destroy$)).subscribe((msg) => this.onMessage(msg));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByIdx(idx: number): number {
    return idx;
  }

  private onMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'wake_word':
        this.activeEngine = msg.engine || 'vosk';
        this.removePartial();
        this.addEntry(`"${msg.keyword}" DETECTED`, 'wake', this.activeEngine);
        break;

      case 'partial':
        if (msg.text) {
          if (this.partialEntry) {
            this.partialEntry.text = msg.text;
            this.partialEntry.typewriterText = msg.text;
            this.partialEntry.typewriterDone = true;
          } else {
            const entry = this.createEntry(msg.text, 'partial');
            entry.typewriterDone = true;
            entry.typewriterText = msg.text;
            this.entries.push(entry);
            this.partialEntry = entry;
          }
        }
        break;

      case 'transcription': {
        const eng = msg.engine || this.activeEngine || 'vosk';
        this.activeEngine = null;
        this.removePartial();
        this.addEntry(msg.text, 'final', eng);
        break;
      }

      case 'tts_start':
        this.speakingIndicator = true;
        break;

      case 'tts_end':
        this.speakingIndicator = false;
        break;
    }
    this.cdr.markForCheck();
  }

  private addEntry(text: string, type: 'final' | 'wake' | 'partial', engine?: string): void {
    const entry = this.createEntry(text, type, engine);

    if (type === 'final') {
      entry.typewriterDone = false;
      entry.typewriterText = '';
      this.entries.push(entry);
      this.runTypewriter(entry, text);
    } else {
      entry.typewriterDone = true;
      entry.typewriterText = text;
      this.entries.push(entry);
    }

    this.updateFading();
    this.trimEntries();
  }

  private createEntry(text: string, type: 'final' | 'wake' | 'partial', engine?: string): DisplayEntry {
    const entry: DisplayEntry = {
      text,
      type,
      engine,
      fading: false,
      faded: false,
      typewriterText: '',
      typewriterDone: false,
      showCursor: false,
    };
    if (engine && (type === 'wake' || type === 'final')) {
      const ec = getEngineColor(engine);
      entry.engineCss = ec.css;
      entry.engineCssDim = ec.cssDim;
      entry.engineCssBg = ec.cssBg;
    }
    return entry;
  }

  private runTypewriter(entry: DisplayEntry, text: string): void {
    let i = 0;
    entry.showCursor = true;
    const tick = () => {
      if (i < text.length) {
        entry.typewriterText = text.slice(0, i + 1);
        i++;
        this.cdr.markForCheck();
        setTimeout(tick, 18 + Math.random() * 25);
      } else {
        entry.typewriterDone = true;
        setTimeout(() => {
          entry.showCursor = false;
          this.cdr.markForCheck();
        }, 1200);
        this.cdr.markForCheck();
      }
    };
    tick();
  }

  private removePartial(): void {
    if (this.partialEntry) {
      const idx = this.entries.indexOf(this.partialEntry);
      if (idx >= 0) this.entries.splice(idx, 1);
      this.partialEntry = null;
    }
  }

  private updateFading(): void {
    const nonPartial = this.entries.filter((e) => e.type !== 'partial');
    nonPartial.forEach((e, i) => {
      const age = nonPartial.length - 1 - i;
      e.fading = age === 1;
      e.faded = age >= 2;
    });
  }

  private trimEntries(): void {
    while (this.entries.length > this.MAX_ENTRIES + 1) {
      this.entries.shift();
    }
  }
}
