import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseModalComponent } from '../modals/base/base-modal.component';
import { PersonaEditService, ValidationState, SaveState } from '../../services/persona-edit.service';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { ModalHeaderComponent } from '../modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../modals/base/modal-footer.component';

/**
 * Modal para edição de persona
 *
 * ✅ Normalizado seguindo especificação de modais padrão v1.0
 * ✅ Estende BaseModalComponent para comportamentos consistentes
 * ✅ Usa componentes base reutilizáveis (ModalHeader, ModalFooter)
 * ✅ Implementa acessibilidade (ARIA, keyboard navigation)
 * ✅ SAGA-008: Fase 2 - Funcionalidade Completa
 *
 * @extends BaseModalComponent
 */
@Component({
  selector: 'app-persona-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './persona-edit-modal.component.html',
  styleUrls: ['./persona-edit-modal.component.scss']
})
export class PersonaEditModalComponent extends BaseModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() override isVisible = false;
  @Input() instanceId: string | null = null;
  @Input() agentId: string | null = null;  // ID do agente base (para salvar no banco)
  @Input() currentPersona: string = '';
  @Output() override closeModal = new EventEmitter<void>();
  @Output() personaSaved = new EventEmitter<string>();

  personaText = '';
  activeTab: 'edit' | 'preview' = 'edit';
  maxLength = 10000; // 10KB aproximadamente
  validationState: ValidationState = { isValid: false, errors: [], warnings: [] };
  saveState: SaveState = { status: 'idle', message: '' };
  saveToDatabase = false;  // Checkbox: salvar permanentemente no banco de dados
  
  private textChangeSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private personaEditService: PersonaEditService,
    private cdr: ChangeDetectorRef
  ) {
    super(); // Call parent constructor first

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
      if (this.saveToDatabase && this.agentId) {
        // Salvar permanentemente no banco de dados (collection agents)
        console.log('💾 [PersonaEditModal] Salvando permanentemente no banco de dados...');
        this.personaEditService.savePersonaToAgentsCollection(this.agentId, this.personaText).subscribe({
          next: (response) => {
            if (response.success === false) {
              console.error('❌ [PersonaEditModal] Falha ao salvar no banco:', response.error);
              this.saveState = {
                status: 'error',
                message: 'Erro ao salvar no banco de dados',
                timestamp: new Date()
              };
            } else {
              console.log('✅ [PersonaEditModal] Persona salva permanentemente no banco de dados');
              this.saveState = {
                status: 'saved',
                message: 'Salvo no banco de dados',
                timestamp: new Date()
              };
              // Limpa o localStorage para usar a versão do banco
              if (this.instanceId) {
                this.personaEditService.clearPersona(this.instanceId);
              }
              this.personaSaved.emit(this.personaText);
            }
            this.cdr.markForCheck();
            setTimeout(() => this.close(), 1000);
          },
          error: (error) => {
            console.error('❌ [PersonaEditModal] Erro ao salvar no banco:', error);
            this.saveState = {
              status: 'error',
              message: 'Erro ao salvar no banco de dados',
              timestamp: new Date()
            };
            this.cdr.markForCheck();
          }
        });
      } else {
        // Salvar apenas localmente (localStorage) - comportamento original
        console.log('💾 [PersonaEditModal] Salvando localmente no navegador...');
        this.personaEditService.savePersonaWithHistory(this.instanceId, this.personaText);

        this.saveState = {
          status: 'saved',
          message: 'Salvo localmente',
          timestamp: new Date()
        };
        this.personaSaved.emit(this.personaText);
        this.cdr.markForCheck();
        setTimeout(() => this.close(), 1000);
      }
    } catch (error) {
      this.saveState = {
        status: 'error',
        message: 'Erro ao salvar'
      };
      console.error('❌ [PersonaEditModal] Erro crítico ao salvar persona:', error);
      this.cdr.markForCheck();
    }
  }

  // ===========================================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ===========================================================================

  /**
   * Fecha o modal
   * @override
   */
  close(): void {
    this.closeModal.emit();
    super.onClose();
  }

  /**
   * Hook do BaseModalComponent: previne fechamento por ESC durante salvamento
   * @override
   */
  protected override preventEscapeClose(): boolean {
    return this.saveState.status === 'saving' || super.preventEscapeClose();
  }

  /**
   * Hook do BaseModalComponent: previne fechamento por backdrop durante salvamento
   * @override
   */
  protected override preventBackdropClose(): boolean {
    return this.saveState.status === 'saving' || super.preventBackdropClose();
  }

  /**
   * Override do onBackdropClick para usar o método close customizado
   * @override
   */
  public override onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.close();
    }
  }

  /**
   * Configura ações do footer (botões)
   */
  getFooterActions(): ModalButton[] {
    return [
      {
        label: 'Cancelar',
        type: 'secondary',
        action: 'cancel'
      },
      {
        label: this.saveState.status === 'saving' ? 'Salvando...' : 'Salvar',
        type: 'primary',
        action: 'save',
        disabled: !this.validationState.isValid || this.saveState.status === 'saving'
      }
    ];
  }

  /**
   * Handler de cliques em ações do footer
   */
  onFooterAction(action: string): void {
    if (action === 'save') {
      this.save();
    } else if (action === 'cancel') {
      this.close();
    }
  }
}