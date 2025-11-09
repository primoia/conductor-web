import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { QuestObjective, Position } from '../../models/quest.models';

@Component({
  selector: 'app-quest-tracker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #trackerElement class="quest-tracker" [@slideIn]
         [style.left.px]="positionX"
         [style.top.px]="positionY">

      <!-- Close Button (X) -->
      <button class="close-button" (click)="closeTracker()" [attr.aria-label]="'Fechar'">
        ✕
      </button>

      <!-- Conteúdo do Tracker -->
      <div class="tracker-content">
        <!-- Header da Quest -->
        <div class="quest-header">
          <span class="quest-icon">🎯</span>
          <h3 class="quest-title">{{ questTitle }}</h3>
        </div>

        <!-- Barra de Progresso da Quest -->
        <div class="quest-progress">
          <div class="progress-bar">
            <div class="progress-fill"
                 [style.width.%]="progressPercent"
                 [@progressAnimation]>
            </div>
          </div>
          <span class="progress-text">{{ completedCount }}/{{ totalCount }}</span>
        </div>

        <!-- Lista de Objetivos -->
        <div class="quest-objectives">
          <div *ngFor="let objective of objectives; trackBy: trackByObjectiveId"
               class="objective-item"
               [class.completed]="objective.completed"
               [class.current]="objective.current"
               [@taskAnimation]>
            <span class="objective-checkbox">
              <span *ngIf="objective.completed">✅</span>
              <span *ngIf="!objective.completed && objective.current">⏳</span>
              <span *ngIf="!objective.completed && !objective.current">☐</span>
            </span>
            <span class="objective-text">{{ objective.text }}</span>
          </div>
        </div>

        <!-- Separador -->
        <div class="tracker-separator"></div>

        <!-- Display de XP e Nível -->
        <div class="player-stats">
          <div class="level-badge">
            <span class="level-label">Nível</span>
            <span class="level-number">{{ playerLevel ?? 1 }}</span>
          </div>

          <div class="xp-section">
            <div class="xp-bar">
              <div class="xp-fill"
                   [style.width.%]="xpPercent"
                   [@xpAnimation]>
              </div>
              <div class="xp-glow" [style.width.%]="xpPercent"></div>
            </div>
            <span class="xp-text">{{ playerXP ?? 0 }}/{{ xpToNextLevel ?? 100 }} XP</span>
          </div>
        </div>

        <!-- Indicador de Nova Quest -->
        <div class="new-quest-indicator" *ngIf="showNewQuestIndicator" [@pulseAnimation]>
          <span>Nova Missão!</span>
        </div>

        <!-- Botão de Reset -->
        <div class="tracker-separator"></div>
        <button class="reset-button" (click)="resetProgress()" title="Recomeçar do início">
          🔄 Recomeçar
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./quest-tracker.component.scss'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)' }),
        animate('300ms ease-out', style({ transform: 'translateX(0)' }))
      ])
    ]),
    trigger('collapseAnimation', [
      state('expanded', style({
        opacity: 1,
        width: '*',
        overflow: 'visible'
      })),
      state('collapsed', style({
        opacity: 0,
        width: 0,
        overflow: 'hidden'
      })),
      transition('expanded <=> collapsed', [
        animate('300ms ease-in-out')
      ])
    ]),
    trigger('taskAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('300ms', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition('* => completed', [
        animate('500ms', style({
          backgroundColor: '#4CAF50',
          transform: 'scale(1.05)'
        })),
        animate('300ms', style({
          backgroundColor: 'transparent',
          transform: 'scale(1)'
        }))
      ])
    ]),
    trigger('progressAnimation', [
      transition('* => *', [
        animate('500ms ease-out')
      ])
    ]),
    trigger('xpAnimation', [
      transition('* => *', [
        animate('800ms ease-out')
      ])
    ]),
    trigger('pulseAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('300ms', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      state('*', style({ transform: 'scale(1)' })),
      transition('* => *', [
        animate('1000ms', style({ transform: 'scale(1.1)' })),
        animate('1000ms', style({ transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class QuestTrackerComponent implements OnChanges {
  @ViewChild('trackerElement') trackerElement!: ElementRef<HTMLDivElement>;

  @Input() questTitle = 'Quest';
  @Input() objectives: QuestObjective[] | null = [];
  @Input() playerLevel: number | null = 1;
  @Input() playerXP: number | null = 0;
  @Input() xpToNextLevel: number | null = 100;
  @Input() playerPosition: Position | null = null;

  @Output() onReset = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();

  completedCount = 0;
  totalCount = 0;
  progressPercent = 0;
  xpPercent = 0;
  showNewQuestIndicator = false;

  // Position properties
  positionX: number | null = null;
  positionY: number | null = null;

  resetProgress() {
    if (confirm('Tem certeza que deseja recomeçar? Todo o progresso será perdido.')) {
      this.onReset.emit();
    }
  }

  closeTracker() {
    this.onClose.emit();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['objectives']) {
      this.checkForCompletedObjective(changes['objectives']);
      this.updateProgress();
      this.checkForNewQuest(changes['objectives']);
    }

    if (changes['playerXP'] || changes['xpToNextLevel']) {
      this.updateXPBar();
    }

    if (changes['playerLevel'] && !changes['playerLevel'].firstChange) {
      this.onLevelUp();
    }

    if (changes['playerPosition'] && this.playerPosition) {
      this.updatePositionNextToPlayer();
    }
  }

  private updatePositionNextToPlayer() {
    if (!this.playerPosition) return;

    // Posiciona o tracker ao lado direito do player
    const offsetX = 80; // Distância do player
    const offsetY = -100; // Centraliza verticalmente em relação ao player

    this.positionX = this.playerPosition.x + offsetX;
    this.positionY = this.playerPosition.y + offsetY;
  }

  private checkForCompletedObjective(change: any) {
    const oldObjectives = change.previousValue || [];
    const newObjectives = change.currentValue || [];

    // Verifica se algum objetivo foi completado agora
    for (let i = 0; i < newObjectives.length; i++) {
      const newObj = newObjectives[i];
      const oldObj = oldObjectives[i];

      if (oldObj && !oldObj.completed && newObj.completed) {
        // Objetivo foi completado!
        break;
      }
    }
  }

  private updateProgress() {
    if (!this.objectives) return;

    this.totalCount = this.objectives.length;
    this.completedCount = this.objectives.filter(obj => obj.completed).length;
    this.progressPercent = this.totalCount > 0
      ? (this.completedCount / this.totalCount) * 100
      : 0;

    // Marca o objetivo atual
    const currentIndex = this.objectives.findIndex(obj => !obj.completed);
    if (currentIndex !== -1) {
      this.objectives.forEach((obj, index) => {
        obj.current = index === currentIndex;
      });
    }
  }

  private updateXPBar() {
    const xp = this.playerXP ?? 0;
    const nextLevel = this.xpToNextLevel ?? 100;
    this.xpPercent = nextLevel > 0
      ? (xp / nextLevel) * 100
      : 0;
  }

  private checkForNewQuest(change: any) {
    // Se a lista de objetivos mudou significativamente, indica nova quest
    const oldObjectives = change.previousValue || [];
    const newObjectives = change.currentValue || [];

    if (oldObjectives.length > 0 && newObjectives.length > 0) {
      const allCompleted = oldObjectives.every((obj: QuestObjective) => obj.completed);
      const hasNewObjectives = newObjectives.some((obj: QuestObjective) => !obj.completed);

      if (allCompleted && hasNewObjectives) {
        this.showNewQuestIndicator = true;
        setTimeout(() => {
          this.showNewQuestIndicator = false;
        }, 3000);
      }
    }
  }

  private onLevelUp() {
    // Animação especial de level up
    // Pode adicionar efeitos visuais ou sons aqui
    console.log('Level Up! Novo nível:', this.playerLevel);
  }

  trackByObjectiveId(index: number, objective: QuestObjective): string {
    return objective.id;
  }
}