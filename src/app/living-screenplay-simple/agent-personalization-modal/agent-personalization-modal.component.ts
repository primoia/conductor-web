import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentPersonalizationService, AgentProfile } from '../../services/agent-personalization.service';
import { AgentMetricsService } from '../../services/agent-metrics.service';
import { Subscription } from 'rxjs';
import { ModalHeaderComponent } from '../../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../../shared/modals/base/modal-footer.component';
import { BaseModalComponent } from '../../shared/modals/base/base-modal.component';

/**
 * Modal para gerenciar personalização de agentes (secretários).
 * Permite editar nome, cargo e emoji de cada agente detectado no sistema.
 *
 * @extends BaseModalComponent
 * Checklist de conformidade:
 * - [x] Estende BaseModalComponent
 * - [x] Usa override isVisible
 * - [x] Usa override closeModal
 * - [x] Implementa onClose() override
 * - [x] Implementa onBackdropClick(event) override
 * - [x] Remove @HostListener('document:keydown.escape')
 * - [x] Super() no constructor
 *
 * @example
 * ```html
 * <app-agent-personalization-modal
 *   [isVisible]="showModal"
 *   (closeModal)="handleClose()">
 * </app-agent-personalization-modal>
 * ```
 */
@Component({
  selector: 'app-agent-personalization-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './agent-personalization-modal.component.html',
  styleUrls: ['./agent-personalization-modal.component.scss']
})
export class AgentPersonalizationModalComponent extends BaseModalComponent implements OnInit, OnDestroy {
  @Input() override isVisible = false;
  @Output() override closeModal = new EventEmitter<void>();

  editableProfiles: AgentProfile[] = [];
  footerButtons: ModalButton[] = [];

  private metricsSub?: Subscription;

  constructor(
    private readonly personalization: AgentPersonalizationService,
    private readonly metrics: AgentMetricsService,
  ) {
    super();
    this.setupFooterButtons();
  }

  /**
   * Configura os botões do footer do modal.
   * @private
   */
  private setupFooterButtons(): void {
    this.footerButtons = [
      {
        label: 'Cancelar',
        type: 'secondary',
        action: 'cancel'
      },
      {
        label: 'Salvar',
        type: 'primary',
        action: 'save'
      }
    ];
  }

  ngOnInit(): void {
    this.metricsSub = this.metrics.metrics$.subscribe(map => {
      const ids = Array.from(map.keys());
      this.editableProfiles = ids.map(id => ({ ...this.personalization.getProfile(id) }));
    });
  }

  ngOnDestroy(): void {
    this.metricsSub?.unsubscribe();
  }

  // ============================================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ============================================================================

  /**
   * Fecha o modal emitindo o evento closeModal.
   * Sobrescreve o comportamento padrão do BaseModalComponent.
   */
  override onClose(): void {
    this.closeModal.emit();
    super.onClose();
  }

  /**
   * Manipula clique no backdrop (fundo do modal).
   * Fecha o modal se não houver restrições.
   * @param event - Evento de clique do mouse
   */
  public override onBackdropClick(event: Event): void {
    if (!this.preventBackdropClose()) {
      this.onClose();
    }
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS
  // ============================================================================

  /**
   * Salva as alterações de personalização dos agentes.
   */
  save(): void {
    this.personalization.upsertMany(this.editableProfiles);
    this.onClose();
  }

  /**
   * Manipula ações dos botões do footer.
   * @param action - Ação disparada pelo botão
   */
  handleFooterAction(action: string): void {
    switch (action) {
      case 'cancel':
        this.onClose();
        break;
      case 'save':
        this.save();
        break;
    }
  }

  /**
   * TrackBy function para otimizar renderização da lista de perfis.
   * @param _ - Índice (não utilizado)
   * @param p - Perfil do agente
   * @returns ID único do agente
   */
  trackById(_: number, p: AgentProfile): string {
    return p.agentId;
  }

  // ============================================================================
  // MÉTODOS PRIVADOS
  // ============================================================================

  /**
   * Determina se o fechamento via backdrop está bloqueado.
   * @override
   * @returns true se o fechamento via backdrop deve ser prevenido
   */
  protected override preventBackdropClose(): boolean {
    // Permite fechamento via backdrop em todos os casos
    return super.preventBackdropClose();
  }
}
