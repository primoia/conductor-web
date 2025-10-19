import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PersonaEditService, ValidationState, SaveState } from '../../services/persona-edit.service';
import { Subject, debounceTime, takeUntil } from 'rxjs';

/**
 * Modal para edição de persona
 * SAGA-008: Fase 2 - Funcionalidade Completa
 */
@Component({
  selector: 'app-persona-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./persona-edit-modal.component.scss'],
  template: `
    <div class="persona-edit-modal">
      <div class="modal-backdrop" *ngIf="isVisible" (click)="onBackdropClick($event)">
        <div class="modal-content" (click)="$event.stopPropagation()" role="dialog" aria-labelledby="modal-title" aria-describedby="modal-description">
          <div class="modal-header">
            <h4 id="modal-title">Editar Persona</h4>
            <button class="close-btn" (click)="close()" aria-label="Fechar modal">✕</button>
          </div>
          <div class="modal-body">
            <div class="editor-container">
              <div class="editor-tabs">
                <button 
                  class="tab" 
                  [class.active]="activeTab === 'edit'"
                  (click)="setActiveTab('edit')"
                  data-tab="edit"
                  [attr.aria-selected]="activeTab === 'edit'"
                  role="tab">
                  Editar
                </button>
                <button 
                  class="tab" 
                  [class.active]="activeTab === 'preview'"
                  (click)="setActiveTab('preview')"
                  data-tab="preview"
                  [attr.aria-selected]="activeTab === 'preview'"
                  role="tab">
                  Preview
                </button>
              </div>
              
              <div class="editor-content" role="tabpanel" [attr.aria-labelledby]="activeTab === 'edit' ? 'edit-tab' : 'preview-tab'">
                <textarea 
                  *ngIf="activeTab === 'edit'"
                  [(ngModel)]="personaText" 
                  (input)="onTextChange()"
                  placeholder="Digite a persona do agente..."
                  class="persona-textarea"
                  [maxlength]="maxLength"
                  [class.error]="validationState.errors.length > 0"
                  aria-label="Editor de persona"
                  aria-describedby="char-count validation-errors">
                </textarea>
                
                <div 
                  *ngIf="activeTab === 'preview'"
                  class="persona-preview"
                  [innerHTML]="getPreviewHtml()"
                  aria-label="Preview da persona">
                </div>
              </div>
              
              <div class="editor-footer">
                <div class="validation-info">
                  <span 
                    class="char-count" 
                    [class.warning]="personaText.length > maxLength * 0.8"
                    [class.error]="personaText.length > maxLength"
                    id="char-count">
                    {{ personaText.length }}/{{ maxLength }} caracteres
                  </span>
                  <span 
                    class="save-status" 
                    [class]="saveState.status"
                    *ngIf="saveState.status !== 'idle'">
                    {{ getSaveStatusText() }}
                  </span>
                </div>
                
                <div class="validation-errors" id="validation-errors" *ngIf="validationState.errors.length > 0" role="alert">
                  <div class="error-item" *ngFor="let error of validationState.errors">
                    {{ error }}
                  </div>
                </div>
                
                <div class="validation-warnings" *ngIf="validationState.warnings.length > 0" role="alert">
                  <div class="warning-item" *ngFor="let warning of validationState.warnings">
                    {{ warning }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="close()">Cancelar</button>
            <button 
              class="btn-save" 
              [class.btn-disabled]="!validationState.isValid || saveState.status === 'saving'"
              [class.btn-saving]="saveState.status === 'saving'"
              (click)="save()" 
              [disabled]="!validationState.isValid || saveState.status === 'saving'"
              [attr.aria-describedby]="validationState.errors.length > 0 ? 'validation-errors' : null">
              <span *ngIf="saveState.status === 'saving'">Salvando...</span>
              <span *ngIf="saveState.status !== 'saving'">Salvar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PersonaEditModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isVisible = false;
  @Input() instanceId: string | null = null;
  @Input() currentPersona: string = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() personaSaved = new EventEmitter<string>();

  personaText = '';
  activeTab: 'edit' | 'preview' = 'edit';
  maxLength = 10000; // 10KB aproximadamente
  validationState: ValidationState = { isValid: false, errors: [], warnings: [] };
  saveState: SaveState = { status: 'idle', message: '' };
  
  private textChangeSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private personaEditService: PersonaEditService,
    private cdr: ChangeDetectorRef
  ) {
    // Debounce para validação em tempo real
    this.textChangeSubject
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.validatePersona();
      });
  }

  ngOnInit(): void {
    this.loadPersona();
    this.validatePersona();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Recarrega a persona quando currentPersona ou instanceId mudam
    if (changes['currentPersona'] || changes['instanceId']) {
      this.loadPersona();
      this.validatePersona();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carrega a persona atual (editada ou original)
   */
  private loadPersona(): void {
    if (this.instanceId) {
      // Salva a persona original como backup se não existir
      if (this.currentPersona && !this.personaEditService.getOriginalPersona(this.instanceId)) {
        this.personaEditService.saveOriginalPersona(this.instanceId, this.currentPersona);
      }
      
      // Primeiro tenta carregar persona editada
      const editedPersona = this.personaEditService.loadPersona(this.instanceId);
      this.personaText = editedPersona || this.currentPersona;
    } else {
      this.personaText = this.currentPersona;
    }
  }

  /**
   * Manipula mudanças no texto da persona
   */
  onTextChange(): void {
    this.textChangeSubject.next(this.personaText);
    this.cdr.markForCheck();
  }

  /**
   * Valida a persona usando validação avançada
   */
  private validatePersona(): void {
    this.validationState = this.personaEditService.validatePersonaAdvanced(this.personaText);
    this.cdr.markForCheck();
  }

  /**
   * Valida se a persona é válida (método de compatibilidade)
   */
  isPersonaValid(): boolean {
    return this.validationState.isValid;
  }

  /**
   * Define a aba ativa
   */
  setActiveTab(tab: 'edit' | 'preview'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  /**
   * Gera HTML para preview markdown
   */
  getPreviewHtml(): string {
    if (!this.personaText) {
      return '<p style="color: #6b7280; font-style: italic;">Nenhum conteúdo para visualizar</p>';
    }

    // Conversão básica de markdown para HTML
    let html = this.personaText
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Lists
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>')
      // Blockquotes
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Line breaks
      .replace(/\n/g, '<br>');

    // Wrap list items in ul/ol
    html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
      if (match.includes('1.') || match.includes('2.') || match.includes('3.')) {
        return `<ol>${match}</ol>`;
      } else {
        return `<ul>${match}</ul>`;
      }
    });

    return html;
  }

  /**
   * Obtém texto do status de salvamento
   */
  getSaveStatusText(): string {
    switch (this.saveState.status) {
      case 'saving':
        return 'Salvando...';
      case 'saved':
        return `Salvo em ${this.saveState.timestamp?.toLocaleTimeString()}`;
      case 'error':
        return 'Erro ao salvar';
      default:
        return '';
    }
  }

  /**
   * Salva a persona editada
   */
  async save(): Promise<void> {
    if (!this.validationState.isValid || !this.instanceId) {
      console.warn('⚠️ [PersonaEditModal] Tentativa de salvar persona inválida');
      return;
    }

    this.saveState = { status: 'saving', message: 'Salvando...' };
    this.cdr.markForCheck();

    try {
      // 1. Salva no localStorage como backup (mantém compatibilidade)
      this.personaEditService.savePersonaWithHistory(this.instanceId, this.personaText);

      // 2. Salva no backend (MongoDB)
      this.personaEditService.savePersonaToBackend(this.instanceId, this.personaText).subscribe({
        next: (response) => {
          if (response.success === false) {
            // Falha na API, mas localStorage ainda funciona
            console.warn('⚠️ [PersonaEditModal] Falha ao salvar no backend, mas salvo no localStorage');
            this.saveState = {
              status: 'saved',
              message: 'Salvo localmente (backend offline)',
              timestamp: new Date()
            };
          } else {
            // Sucesso total!
            console.log('✅ [PersonaEditModal] Persona salva no backend e localStorage');
            this.saveState = {
              status: 'saved',
              message: 'Salvo com sucesso',
              timestamp: new Date()
            };
          }

          // Emite evento de salvamento
          this.personaSaved.emit(this.personaText);
          this.cdr.markForCheck();

          // Fecha o modal após um pequeno delay
          setTimeout(() => {
            this.close();
          }, 1000);
        },
        error: (error) => {
          // Erro na API, mas localStorage ainda funciona
          console.error('❌ [PersonaEditModal] Erro ao salvar no backend:', error);
          this.saveState = {
            status: 'saved',
            message: 'Salvo localmente (backend offline)',
            timestamp: new Date()
          };
          this.personaSaved.emit(this.personaText);
          this.cdr.markForCheck();

          setTimeout(() => {
            this.close();
          }, 1000);
        }
      });

    } catch (error) {
      this.saveState = {
        status: 'error',
        message: 'Erro ao salvar'
      };
      console.error('❌ [PersonaEditModal] Erro crítico ao salvar persona:', error);
      this.cdr.markForCheck();
    }
  }

  /**
   * Fecha o modal
   */
  close(): void {
    this.closeModal.emit();
  }

  /**
   * Manipula clique no backdrop
   */
  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}