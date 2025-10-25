import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface InvestigationPreset {
  id: string;
  name: string;
  description: string;
}

export interface InvestigationRequest {
  presetId: string;
  context: string;
}

@Component({
  selector: 'app-investigation-launcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>🔎 Lançar Investigação</h3>
          <button class="close-btn" (click)="close.emit()">×</button>
        </div>

        <div class="modal-body">
          <label>Tipo de investigador</label>
          <select [(ngModel)]="selectedPresetId">
            <option *ngFor="let p of presets" [value]="p.id">{{ p.name }}</option>
          </select>

          <label>Contexto adicional</label>
          <textarea [(ngModel)]="context" rows="5" placeholder="Ex.: Focar em complexidade e dependências"></textarea>
        </div>

        <div class="modal-footer">
          <button class="btn" (click)="close.emit()">Cancelar</button>
          <button class="btn primary" (click)="launch()">Iniciar Investigação</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.6); z-index: 1100; }
    .modal { width: 600px; max-width: 95vw; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); display: flex; flex-direction: column; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: #f8f9fa; border-bottom: 1px solid #e1e4e8; }
    .close-btn { background: none; border: none; font-size: 22px; cursor: pointer; }
    .modal-body { display: grid; gap: 8px; padding: 16px; }
    select, textarea { width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; background: #f8f9fa; border-top: 1px solid #e1e4e8; }
    .btn { padding: 8px 14px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; }
    .btn.primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
  `]
})
export class InvestigationLauncherComponent {
  @Input() isVisible = false;
  @Input() presets: InvestigationPreset[] = [
    { id: 'code-quality-analyst', name: 'Code Quality Analyst', description: 'Analisa complexidade, code smells' },
    { id: 'performance-investigator', name: 'Performance Investigator', description: 'Analisa latência e bottlenecks' },
    { id: 'security-auditor', name: 'Security Auditor', description: 'Analisa vulnerabilidades' },
    { id: 'architecture-reviewer', name: 'Architecture Reviewer', description: 'Analisa acoplamento e coesão' },
  ];

  @Output() close = new EventEmitter<void>();
  @Output() launchInvestigation = new EventEmitter<InvestigationRequest>();

  selectedPresetId: string = this.presets[0]?.id || 'code-quality-analyst';
  context: string = '';

  launch(): void {
    this.launchInvestigation.emit({ presetId: this.selectedPresetId, context: this.context.trim() });
  }
}
