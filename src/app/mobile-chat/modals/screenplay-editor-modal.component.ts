import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScreenplayStorage, Screenplay } from '../../services/screenplay-storage';

@Component({
  selector: 'app-screenplay-editor-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="onClose()">
      <div class="modal-container" (click)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (touchend)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <h3 class="modal-title">{{ screenplayId ? 'Editar Roteiro' : 'Novo Roteiro' }}</h3>
          <button class="close-btn" (click)="onClose()">✕</button>
        </div>

        <!-- Loading -->
        <div class="loading-state" *ngIf="isLoading">
          <div class="spinner"></div>
          <span>Carregando...</span>
        </div>

        <!-- Form -->
        <div class="editor-body" *ngIf="!isLoading">
          <div class="field-row">
            <label class="field-label">Nome</label>
            <input
              class="field-input"
              type="text"
              inputmode="text"
              [(ngModel)]="name"
              placeholder="Nome do roteiro"
              maxlength="100"
              (touchend)="$event.stopPropagation()">
          </div>

          <div class="field-row">
            <label class="field-label">Descricao</label>
            <input
              class="field-input"
              type="text"
              inputmode="text"
              [(ngModel)]="description"
              placeholder="Descricao breve (opcional)"
              maxlength="200"
              (touchend)="$event.stopPropagation()">
          </div>

          <div class="field-row">
            <label class="field-label">Caminho do arquivo</label>
            <input
              class="field-input field-path"
              type="text"
              inputmode="url"
              [(ngModel)]="importPath"
              placeholder="/caminho/para/roteiro.md"
              (touchend)="$event.stopPropagation()">
          </div>

          <div class="field-row content-row">
            <label class="field-label">Conteudo (Markdown)</label>
            <textarea
              class="field-content"
              [(ngModel)]="content"
              placeholder="Escreva o roteiro em Markdown..."
              inputmode="text"
              (touchend)="$event.stopPropagation()"></textarea>
          </div>
        </div>

        <!-- Footer -->
        <div class="editor-footer" *ngIf="!isLoading">
          <button class="btn-cancel" (click)="onClose()">Cancelar</button>
          <button
            class="btn-save"
            (click)="save()"
            [disabled]="!name || name.trim().length < 2 || isSaving">
            {{ isSaving ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 2100;
      display: flex;
      align-items: stretch;
      justify-content: center;
      padding: 0;
    }

    .modal-container {
      width: 100%;
      height: 100%;
      background: #fff;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    @media (min-width: 768px) {
      .modal-backdrop {
        align-items: center;
        padding: 24px;
      }
      .modal-container {
        width: 90%;
        max-width: 800px;
        height: 85vh;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      flex-shrink: 0;
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 60px;
      color: #64748b;
      flex: 1;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .editor-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      -webkit-overflow-scrolling: touch;
    }

    .field-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex-shrink: 0;
    }

    .content-row {
      flex: 1;
      min-height: 0;
    }

    .field-label {
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }

    .field-input {
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }

    .field-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
    }

    .field-path {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 13px;
      color: #64748b;
    }

    .field-content {
      flex: 1;
      min-height: 200px;
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      line-height: 1.6;
      outline: none;
      resize: none;
      transition: border-color 0.2s;
      -webkit-overflow-scrolling: touch;
    }

    .field-content:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
    }

    .editor-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 20px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .btn-cancel {
      padding: 10px 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      color: #64748b;
      font-size: 14px;
      cursor: pointer;
    }

    .btn-save {
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class ScreenplayEditorModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Input() screenplayId: string | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>(); // emits screenplay id

  name = '';
  description = '';
  content = '';
  importPath = '';
  isLoading = false;
  isSaving = false;

  constructor(private screenplayStorage: ScreenplayStorage) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && this.isVisible) {
      if (this.screenplayId) {
        this.loadScreenplay(this.screenplayId);
      } else {
        this.name = '';
        this.description = '';
        this.content = '';
        this.importPath = '';
        this.isLoading = false;
      }
    }
  }

  private loadScreenplay(id: string): void {
    this.isLoading = true;
    this.screenplayStorage.getScreenplay(id).subscribe({
      next: (sp) => {
        this.name = sp.name || '';
        this.description = sp.description || '';
        this.content = sp.content || '';
        this.importPath = sp.importPath || '';
        this.isLoading = false;
      },
      error: (err) => {
        console.error('[ScreenplayEditor] Error loading:', err);
        this.isLoading = false;
        this.onClose();
      }
    });
  }

  save(): void {
    if (!this.name?.trim() || this.isSaving) return;
    this.isSaving = true;

    if (this.screenplayId) {
      this.screenplayStorage.updateScreenplay(this.screenplayId, {
        name: this.name.trim(),
        description: this.description?.trim() || undefined,
        content: this.content,
        importPath: this.importPath?.trim() || undefined
      }).subscribe({
        next: () => {
          this.isSaving = false;
          this.saved.emit(this.screenplayId!);
          this.closeModal.emit();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('[ScreenplayEditor] Error updating:', err);
        }
      });
    } else {
      this.screenplayStorage.createScreenplay({
        name: this.name.trim(),
        description: this.description?.trim() || undefined,
        content: this.content,
        importPath: this.importPath?.trim() || undefined
      }).subscribe({
        next: (created) => {
          this.isSaving = false;
          this.saved.emit(created.id);
          this.closeModal.emit();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('[ScreenplayEditor] Error creating:', err);
        }
      });
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }
}
