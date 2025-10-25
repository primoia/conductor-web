import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentMetricsService } from '../../services/agent-metrics.service';
import { Subscription, interval } from 'rxjs';

export interface CommandBarKpis {
  activeAgents: number;
  totalExecutions: number;
  lastExecution: string | null;
}

@Component({
  selector: 'app-command-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="command-bar" role="status" aria-label="Painel de comandos gamificado">
      <div class="footer-section footer-left section left">
        <ng-content select="[left]"></ng-content>
      </div>
      <div class="footer-section footer-center section center">
        <ng-content select="[center]"></ng-content>
      </div>
      <div class="footer-section footer-right section right">
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
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .command-bar { display: contents; }
    .section { display: flex; align-items: center; gap: 8px; }
    .right { justify-content: flex-end; }
    .kpi { display: inline-flex; gap: 6px; align-items: baseline; padding: 4px 8px; border-radius: 10px; background: #ffffff; border: 1px solid #e1e4e8; font-size: 11px; }
    .kpi-label { color: #6b7280; font-weight: 600; }
    .kpi-value { color: #111827; font-weight: 700; min-width: 14px; text-align: right; }
  `]
})
export class CommandBarComponent implements OnInit, OnDestroy {
  @Input() refreshMs = 30000; // 30s default

  kpis: CommandBarKpis | null = null;
  private sub?: Subscription;
  private tickSub?: Subscription;

  constructor(private metrics: AgentMetricsService) {}

  ngOnInit(): void {
    this.refresh();
    this.tickSub = interval(this.refreshMs).subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.tickSub?.unsubscribe();
  }

  private refresh(): void {
    // Aggregate from existing service without backend calls
    if (this.sub) this.sub.unsubscribe();
    this.sub = this.metrics.metrics$.subscribe(map => {
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
