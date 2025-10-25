import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentPersonalizationService, AgentProfile } from '../../services/agent-personalization.service';
import { AgentMetricsService } from '../../services/agent-metrics.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-agent-personalization-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="onBackdropClick()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>⚙️ Gerenciar Secretários</h3>
          <button class="close-btn" (click)="close.emit()">×</button>
        </div>
        <div class="modal-body">
          <div class="hint">Edite os nomes, cargos e emojis dos agentes.</div>

          <div class="profiles">
            <div class="profile" *ngFor="let p of editableProfiles; trackBy: trackById">
              <div class="row">
                <label>ID</label>
                <input type="text" [value]="p.agentId" disabled />
              </div>
              <div class="row">
                <label>Nome</label>
                <input type="text" [(ngModel)]="p.displayName" placeholder="Maria" />
              </div>
              <div class="row">
                <label>Cargo</label>
                <input type="text" [(ngModel)]="p.role" placeholder="Inspetora de Qualidade" />
              </div>
              <div class="row">
                <label>Emoji</label>
                <input type="text" [(ngModel)]="p.emoji" placeholder="🔍" />
              </div>
            </div>

            <div class="empty" *ngIf="editableProfiles.length === 0">Nenhum agente detectado ainda.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" (click)="close.emit()">Cancelar</button>
          <button class="btn primary" (click)="save()">Salvar</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { width: 700px; max-width: 95vw; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #f8f9fa; border-bottom: 1px solid #e1e4e8; }
    .close-btn { background: none; border: none; font-size: 22px; cursor: pointer; }
    .modal-body { padding: 16px; max-height: 60vh; overflow: auto; }
    .hint { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
    .profiles { display: grid; gap: 12px; }
    .profile { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fafafa; }
    .row { display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 8px; margin-bottom: 8px; }
    .row label { font-size: 12px; font-weight: 600; color: #4b5563; }
    .row input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .empty { text-align: center; color: #6b7280; padding: 24px 0; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; background: #f8f9fa; border-top: 1px solid #e1e4e8; }
    .btn { padding: 8px 14px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
    .btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
  `]
})
export class AgentPersonalizationModalComponent implements OnInit, OnDestroy {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();

  editableProfiles: AgentProfile[] = [];
  private metricsSub?: Subscription;

  constructor(
    private readonly personalization: AgentPersonalizationService,
    private readonly metrics: AgentMetricsService,
  ) {}

  ngOnInit(): void {
    this.metricsSub = this.metrics.metrics$.subscribe(map => {
      const ids = Array.from(map.keys());
      this.editableProfiles = ids.map(id => ({ ...this.personalization.getProfile(id) }));
    });
  }

  ngOnDestroy(): void {
    this.metricsSub?.unsubscribe();
  }

  save(): void {
    this.personalization.upsertMany(this.editableProfiles);
    this.close.emit();
  }

  onBackdropClick(): void { this.close.emit(); }
  trackById(_: number, p: AgentProfile): string { return p.agentId; }
}
