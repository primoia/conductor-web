import {
  Component, Input, OnChanges, OnDestroy, OnInit,
  SimpleChanges, ElementRef, ViewChild, AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentCarouselItem, AnimState } from '../../models/media-studio.models';
import { AGENT_COLORS } from '../../constants/media-studio-palette';

@Component({
  selector: 'app-agent-carousel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="agent-carousel" [class.active]="isActive">
      <div class="agent-track" #track>
        <div
          *ngFor="let agent of agents; let i = index"
          class="agent-item"
          [class.active]="i === currentIdx"
          [style.color]="i === currentIdx ? getColor(i).color : getColor(i).dim"
          [style.textShadow]="i === currentIdx ? '0 0 16px ' + getColor(i).glow : 'none'"
        >
          {{ agent.name }}
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./agent-carousel.component.scss'],
})
export class AgentCarouselComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() agents: AgentCarouselItem[] = [];
  @Input() animState: AnimState = 'idle';
  @Input() activeAgent: string | null = null;

  @ViewChild('track') trackRef!: ElementRef<HTMLElement>;

  currentIdx = 0;
  isActive = false;
  private timer: any = null;
  private itemHeight = 26;
  private locked = false;

  ngOnInit(): void {
    this.startCarousel();
  }

  ngAfterViewInit(): void {
    this.measureAndUpdate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agents']) {
      this.currentIdx = 0;
      setTimeout(() => this.measureAndUpdate(), 0);
    }
    if (changes['animState']) {
      this.isActive = this.animState === 'listening' || this.animState === 'recording';
    }
    if (changes['activeAgent']) {
      if (this.activeAgent) {
        this.lockToAgent(this.activeAgent);
      } else {
        this.unlock();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  getColor(idx: number) {
    return AGENT_COLORS[idx % AGENT_COLORS.length];
  }

  private lockToAgent(keyword: string): void {
    const normalized = keyword.toLowerCase();
    const idx = this.agents.findIndex(a => a.name.toLowerCase() === normalized);
    if (idx >= 0) {
      this.locked = true;
      this.stopCarousel();
      this.currentIdx = idx;
      this.updateTrackPosition();
    }
  }

  private unlock(): void {
    this.locked = false;
    this.startCarousel();
  }

  private stopCarousel(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startCarousel(): void {
    if (this.timer || this.locked) return;
    this.timer = setInterval(() => {
      if (!this.agents.length) return;
      this.currentIdx = (this.currentIdx + 1) % this.agents.length;
      this.updateTrackPosition();
    }, 2800);
  }

  private measureAndUpdate(): void {
    if (this.trackRef?.nativeElement) {
      const firstItem = this.trackRef.nativeElement.querySelector('.agent-item') as HTMLElement;
      if (firstItem) {
        this.itemHeight = firstItem.offsetHeight || 26;
      }
    }
    this.updateTrackPosition();
  }

  private updateTrackPosition(): void {
    if (!this.trackRef?.nativeElement) return;
    const offset = -(this.currentIdx * this.itemHeight) + (40 - this.itemHeight / 2);
    this.trackRef.nativeElement.style.transform = `translateY(${offset}px)`;
  }
}
