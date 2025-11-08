import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ContentChild } from '@angular/core';
import { EventTickerComponent } from '../event-ticker/event-ticker.component';
import { CommonModule } from '@angular/common';
import { AgentMetricsService } from '../../services/agent-metrics.service';
import { Subscription, interval } from 'rxjs';
import { ScreenplayKpiService } from '../../services/screenplay-kpi.service';

type PanelState = 'collapsed' | 'expanded';

interface PanelKpis {
  activeAgents: number;
  totalExecutions: number;
  lastExecution: string | null;
}

@Component({
  selector: 'app-gamified-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gamified-panel" [class.expanded]="state === 'expanded'" [class.collapsed]="state === 'collapsed'" role="complementary" aria-label="Painel gamificado do roteiro">
      <!-- Header: Title + Actions -->
      <div class="panel-header">
        <div class="header-title">
          <span class="title-text">Notícias dos Agentes</span>
        </div>
        <div class="actions">
          <!-- Projected EventTicker controller (filter bar) -->
          <div class="filter-bar" *ngIf="ticker">
            <button
              class="filter-btn"
              [class.active]="ticker.currentFilter === 'all'"
              (click)="ticker.setFilter('all')"
              title="Mostrar tudo">
              Todos
            </button>
            <button
              class="filter-btn"
              [class.active]="ticker.currentFilter === 'result'"
              (click)="ticker.setFilter('result')"
              title="Apenas resultados de agentes">
              Resultados
            </button>
            <button
              class="filter-btn"
              [class.active]="ticker.currentFilter === 'debug'"
              (click)="ticker.setFilter('debug')"
              title="Logs de execução">
              Debug
            </button>
          </div>
          <!-- Compact Save Status (only when collapsed) -->
          <div
            class="save-status"
            *ngIf="showStatusInHeaderWhenCollapsed && state === 'collapsed'"
            [attr.title]="isSaving ? 'Salvando...' : (isDirty ? 'Modificado' : (hasCurrentScreenplay ? 'Salvo' : ''))">
            <span class="status saving" *ngIf="isSaving">
              <span class="spinner">⏳</span>
              <span class="sr-only">Salvando...</span>
            </span>
            <span class="status modified" *ngIf="!isSaving && isDirty">
              <span class="dot">●</span>
              <span class="sr-only">Modificado</span>
            </span>
            <span class="status saved" *ngIf="!isSaving && !isDirty && hasCurrentScreenplay">
              <span class="check">✓</span>
              <span class="sr-only">Salvo</span>
            </span>
          </div>
          <button class="icon-btn toggle-btn" (click)="toggleState()" [attr.aria-expanded]="state === 'expanded'" [title]="state === 'expanded' ? 'Recolher' : 'Expandir'">
            {{ state === 'expanded' ? '▲' : '▼' }}
          </button>
        </div>
      </div>

      <!-- Body: always visible, content adapts based on state -->
      <div class="panel-body">
        <ng-content></ng-content>
      </div>

      <!-- Footer: KPIs (visible only when expanded) -->
      <div class="panel-footer" *ngIf="state === 'expanded'">
        <div class="kpis">
          <div class="kpi" title="Agentes ativos">
            <span class="kpi-label">Agentes</span>
            <span class="kpi-value">{{ kpis?.activeAgents ?? '—' }}</span>
          </div>
          <div class="kpi" title="Execuções totais">
            <span class="kpi-label">Execuções</span>
            <span class="kpi-value">{{ kpis?.totalExecutions ?? '—' }}</span>
          </div>
          <div class="kpi" title="Última execução">
            <span class="kpi-label">Última</span>
            <span class="kpi-value">{{ kpis?.lastExecution || '—' }}</span>
          </div>
          <div class="kpi" title="Investigações ativas">
            <span class="kpi-label">Investigações</span>
            <span class="kpi-value">{{ investigationsActive }}</span>
          </div>
        </div>
        <button class="action-btn" (click)="loadProjectScreenplay()" title="Carregar screenplay do projeto">
          📜 Screenplay
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .gamified-panel {
      width: 100%;
      background: #f8f9fa;
      border-top: 1px solid #e1e4e8;
      transition: height 0.3s ease;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .gamified-panel.collapsed { height: 80px; max-height: 80px; }
    .gamified-panel.expanded { height: 350px; max-height: 350px; }

    /* Remove extra margins/padding around expanded content */
    .gamified-panel.expanded .panel-header { padding: 4px 10px; }
    .gamified-panel.expanded .panel-body { padding: 0; margin: 0; }
    .gamified-panel.expanded .panel-footer { padding: 4px 6px; }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 10px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
    }

    .header-title {
      display: flex;
      align-items: center;
    }

    .title-text {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
    }

    .actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .icon-btn { width: 28px; height: 28px; border-radius: 6px; background: #f9fafb; border: 1px solid #e5e7eb; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
    .icon-btn:hover { background: #f3f4f6; border-color: #d1d5db; }

    /* Compact Save Status in header */
    .save-status { display: inline-flex; align-items: center; gap: 6px; margin-right: 6px; }
    .status { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #6b7280; }
    .status .dot { color: #f59e0b; font-size: 12px; }
    .status.saved .check { color: #10b981; font-size: 12px; }
    .spinner { font-size: 12px; animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

    /* Filter bar (moved from EventTicker) */
    .filter-bar { display: inline-flex; gap: 4px; align-items: center; padding: 0; border: 0; background: transparent; }
    .filter-btn {
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .filter-btn:hover { background: #ffffff; border-color: #d1d5db; color: #111827; }
    .filter-btn.active { background: #111827; color: #ffffff; border-color: #111827; }

    .panel-body {
      flex: 1;
      overflow: hidden;
      background: #ffffff;
    }

    .panel-footer {
      padding: 4px 10px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    .kpis {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: center;
      flex: 1;
    }

    .kpi {
      display: flex;
      gap: 6px;
      align-items: baseline;
      padding: 4px 12px;
      border-radius: 6px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      font-size: 11px;
    }

    .kpi-label {
      color: #6b7280;
      font-weight: 600;
    }

    .kpi-value {
      color: #111827;
      font-weight: 700;
      min-width: 14px;
      text-align: right;
    }

    .action-btn {
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      color: #2563eb;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .action-btn:hover {
      background: #eff6ff;
      border-color: #2563eb;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class GamifiedPanelComponent implements OnInit, OnDestroy {
  @Input() refreshMs = 30000; // for KPI refresh cadence
  @Output() investigate = new EventEmitter<unknown>(); // reserved for fase 4
  @Output() settings = new EventEmitter<void>(); // fase 2
  @Output() stateChange = new EventEmitter<PanelState>(); // emit when panel expands/collapses
  @Output() loadScreenplay = new EventEmitter<void>(); // emit when user wants to load screenplay

  // Compact save status coming from parent (screenplay)
  @Input() isSaving = false;
  @Input() isDirty = false;
  @Input() hasCurrentScreenplay = false;
  @Input() showStatusInHeaderWhenCollapsed = true;

  // Access projected EventTicker to drive filters from header
  @ContentChild(EventTickerComponent, { static: false }) ticker?: EventTickerComponent;

  state: PanelState = 'collapsed';
  kpis: PanelKpis | null = null;
  investigationsActive = 0;

  private metricsSub?: Subscription;
  private tickSub?: Subscription;

  constructor(
    private readonly metrics: AgentMetricsService,
    private readonly screenplayKpis: ScreenplayKpiService
  ) {}

  ngOnInit(): void {
    this.refreshKpis();
    this.tickSub = interval(this.refreshMs).subscribe(() => this.refreshKpis());
    this.screenplayKpis.investigationsActive$.subscribe(v => this.investigationsActive = v);
  }

  ngOnDestroy(): void {
    this.metricsSub?.unsubscribe();
    this.tickSub?.unsubscribe();
  }

  toggleState(): void {
    this.state = this.state === 'collapsed' ? 'expanded' : 'collapsed';
    this.stateChange.emit(this.state);
  }

  loadProjectScreenplay(): void {
    this.loadScreenplay.emit();
  }

  private refreshKpis(): void {
    this.metricsSub?.unsubscribe();
    this.metricsSub = this.metrics.metrics$.subscribe(map => {
      const values = Array.from(map.values());
      const activeAgents = values.filter(v => v.isCurrentlyExecuting).length;
      const totalExecutions = values.reduce((acc, v) => acc + (v.totalExecutions || 0), 0);
      const lastExecDate = values
        .map(v => v.lastExecutionTime ? new Date(v.lastExecutionTime) : null)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;
      this.kpis = {
        activeAgents,
        totalExecutions,
        lastExecution: lastExecDate ? this.formatRelativeTime(lastExecDate) : null,
      };
    });
  }

  private formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d`;
  }
}
