import { Component, Inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProposalBlock, ProposalData } from '../blocks/proposal-block/proposal-block';

@Component({
  selector: 'app-proposal-modal',
  standalone: true,
  imports: [CommonModule, ProposalBlock],
  template: `
    <div class="modal-backdrop" (click)="close()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>✨ Editar Proposta</h3>
          <button class="close-btn" (click)="close()">×</button>
        </div>
        <div class="modal-body">
          <app-proposal-block
            [data]="proposalData"
            [editable]="true"
            (statusChange)="onStatusChange($event)">
          </app-proposal-block>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="close()">Cancelar</button>
          <button class="btn btn-primary" (click)="save()">Salvar no Documento</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    }

    .modal-body {
      padding: 20px;
    }

    .modal-footer {
      padding: 20px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }
  `]
})
export class ProposalModal {
  @Output() closeModal = new EventEmitter<void>();
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

  onStatusChange(status: 'accepted' | 'rejected'): void {
    console.log('Modal: Proposal status changed to', status);
  }

  close(): void {
    console.log('Closing modal');
    this.closeModal.emit();
  }

  save(): void {
    console.log('Saving to document');
    this.close();
  }
}