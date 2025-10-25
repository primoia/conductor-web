import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
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
      <!-- Header: KPIs + Actions -->
      <div class="panel-header">
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
        <div class="actions">
          <button class="icon-btn" title="Gerenciar Secretários" (click)="settings.emit()">⚙️</button>
          <button class="icon-btn toggle-btn" (click)="toggleState()" [attr.aria-expanded]="state === 'expanded'" [title]="state === 'expanded' ? 'Recolher' : 'Expandir'">
            {{ state === 'expanded' ? '▲' : '▼' }}
          </button>
        </div>
      </div>

      <!-- Body: visible only when expanded -->
      <div class="panel-body" *ngIf="state === 'expanded'">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .gamified-panel {
      width: 100%;
      background: #f8f9fa;
      border-top: 1px solid #e1e4e8;
      transition: height 0.3s ease, min-height 0.3s ease;
      overflow-x: hidden; /* remove scroll horizontal */
    }
    .gamified-panel.collapsed { min-height: 60px; }
    .gamified-panel.expanded { height: 300px; }

    .panel-header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
    }
    .kpis { display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .kpi { display: inline-flex; gap: 6px; align-items: baseline; padding: 4px 8px; border-radius: 10px; background: #ffffff; border: 1px solid #e1e4e8; font-size: 11px; }
    .kpi-label { color: #6b7280; font-weight: 600; }
    .kpi-value { color: #111827; font-weight: 700; min-width: 14px; text-align: right; }

    .actions { display: inline-flex; align-items: center; gap: 6px; }
    .icon-btn { width: 28px; height: 28px; border-radius: 6px; background: #ffffff; border: 1px solid #e1e4e8; cursor: pointer; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
    .icon-btn:hover { background: #f7fafc; border-color: #a8b9ff; transform: scale(1.05); }

    .panel-body {
      height: calc(300px - 44px); /* 300 total - header approx */
      overflow-y: auto; /* scroll vertical no expandido */
      padding: 8px 12px;
      background: #ffffff;
      border-top: 1px solid #eef2f7;
    }
  `]
})
export class GamifiedPanelComponent implements OnInit, OnDestroy {
  @Input() refreshMs = 30000; // for KPI refresh cadence
  @Output() investigate = new EventEmitter<unknown>(); // reserved for fase 4
  @Output() settings = new EventEmitter<void>(); // fase 2

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
