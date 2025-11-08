import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProposalBlock, ProposalData } from '../blocks/proposal-block/proposal-block';
import { ModalHeaderComponent } from '../shared/modals/base/modal-header.component';
import { ModalFooterComponent, ModalButton } from '../shared/modals/base/modal-footer.component';
import { BaseModalComponent } from '../shared/modals/base/base-modal.component';

/**
 * Modal para edição de propostas de código.
 * Permite visualizar e editar propostas geradas por agentes.
 *
 * ✅ Normalizado seguindo especificação de modais padrão v1.0
 * ✅ Estende BaseModalComponent para comportamentos consistentes
 * ✅ Usa componentes base reutilizáveis (ModalHeader, ModalFooter)
 * ✅ Implementa acessibilidade (ARIA, keyboard navigation)
 *
 * @extends BaseModalComponent
 *
 * @example
 * ```html
 * <app-proposal-modal
 *   [isVisible]="showProposalModal"
 *   (closeModal)="handleClose()">
 * </app-proposal-modal>
 * ```
 */
@Component({
  selector: 'app-proposal-modal',
  standalone: true,
  imports: [CommonModule, ProposalBlock, ModalHeaderComponent, ModalFooterComponent],
  templateUrl: './proposal-modal.component.html',
  styleUrls: ['./proposal-modal.component.scss']
})
export class ProposalModal extends BaseModalComponent {
  @Input() override isVisible = false;
  @Output() override closeModal = new EventEmitter<void>();

  footerButtons: ModalButton[] = [];

  proposalData: ProposalData = {
    id: 'modal-proposal',
    title: 'Sistema de Autenticação JWT',
    description: 'Implementar autenticação segura com tokens JWT, refresh automático e interceptors HTTP.',
    codeContent: `export class AuthService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(\`\${this.baseUrl}/auth/login\`, credentials)
      .pipe(
        tap(response => this.setToken(response.token)),
        catchError(this.handleError)
      );
  }

  private setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }
}`,
    language: 'typescript',
    status: 'pending',
    agent: '@auth-agent',
    createdAt: new Date()
  };

  constructor() {
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
        label: 'Salvar no Documento',
        type: 'primary',
        action: 'save'
      }
    ];
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

  // ===========================================================================
  // OVERRIDES DO BASEMODALCOMPONENT
  // ===========================================================================

  /**
   * Fecha o modal
   * @override
   */
  override onClose(): void {
    this.closeModal.emit();
    super.onClose();
  }

  /**
   * Override do onBackdropClick para usar o método onClose customizado
   * @override
   */
  public override onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.preventBackdropClose()) {
      this.onClose();
    }
  }

  // ===========================================================================
  // MODAL-SPECIFIC METHODS
  // ===========================================================================

  /**
   * Manipula mudança de status da proposta.
   * @param status - Novo status da proposta
   */
  onStatusChange(status: 'accepted' | 'rejected'): void {
    console.log('Modal: Proposal status changed to', status);
  }

  /**
   * Salva a proposta no documento.
   */
  save(): void {
    console.log('Saving to document');
    this.onClose();
  }
}
