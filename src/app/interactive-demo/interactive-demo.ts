import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InteractiveEditor } from '../interactive-editor/interactive-editor';
import { ProposalBlock, ProposalData } from '../blocks/proposal-block/proposal-block';
import { ExecutionTrigger, ExecutionTriggerData } from '../blocks/execution-trigger/execution-trigger';

@Component({
  selector: 'app-interactive-demo',
  standalone: true,
  imports: [CommonModule, InteractiveEditor, ProposalBlock, ExecutionTrigger],
  templateUrl: './interactive-demo.html',
  styleUrls: ['./interactive-demo.scss']
})
export class InteractiveDemo {
  editorContent = `
    <h1>🚀 Editor de Blocos Interativos - Roteiro Vivo</h1>

    <p>Este é o novo <strong>Editor de Blocos Interativos</strong> inspirado no Notion! Aqui você pode:</p>

    <ul>
      <li>✏️ <strong>Editar diretamente</strong> - Clique e digite como no Word</li>
      <li>⚡ <strong>Atalhos Markdown</strong> - Digite # para títulos, ** para negrito</li>
      <li>🔥 <strong>Comando /</strong> - Digite / para abrir o menu de blocos</li>
      <li>🧩 <strong>Blocos Customizados</strong> - Propostas e Gatilhos interativos</li>
    </ul>

    <h2>🎯 Experimente agora:</h2>

    <ol>
      <li>Digite <code>/</code> para ver o menu de comandos</li>
      <li>Tente <code>/proposta</code> para inserir um bloco de proposta</li>
      <li>Tente <code>/gatilho</code> para inserir um gatilho de execução</li>
      <li>Use <code>#</code> no início de uma linha para criar títulos</li>
      <li>Use <code>**texto**</code> para deixar o texto em negrito</li>
    </ol>

    <blockquote>
      <p>💡 <strong>Dica:</strong> Esta é a base do "Roteiro Vivo" - um documento que se torna uma aplicação interativa!</p>
    </blockquote>
  `;

  // Demo data for standalone blocks
  sampleProposal: ProposalData = {
    id: 'demo-proposal-1',
    title: 'Implementar Sistema de Autenticação',
    description: 'Criar um sistema robusto de autenticação usando JWT tokens para garantir a segurança da aplicação.',
    codeContent: `// AuthService implementation
export class AuthService {
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

  private handleError(error: any): Observable<never> {
    console.error('Authentication error:', error);
    return throwError(() => error);
  }
}`,
    language: 'typescript',
    status: 'pending',
    agent: '@auth-agent',
    createdAt: new Date()
  };

  sampleTrigger: ExecutionTriggerData = {
    id: 'demo-trigger-1',
    title: 'Executar Testes Unitários',
    description: 'Roda todos os testes unitários do projeto para garantir que não há regressões.',
    command: 'npm test -- --coverage --watchAll=false',
    status: 'idle',
    type: 'test',
    createdAt: new Date(),
    output: 'Test Suites: 5 passed, 5 total\nTests:       42 passed, 42 total\nSnapshots:   0 total\nTime:        3.245 s\nRan all test suites.'
  };

  onEditorContentChange(content: string): void {
    this.editorContent = content;
    console.log('Editor content changed:', content);
  }

  onBlockCommand(command: string): void {
    console.log('Block command triggered:', command);
    // In a real implementation, this would integrate with the roadmap service
    // to create actual interactive blocks within the editor
  }

  onProposalStatusChange(status: 'accepted' | 'rejected'): void {
    console.log('Proposal status changed:', status);
    // Simulate execution trigger creation when proposal is accepted
    if (status === 'accepted') {
      this.simulateProposalAcceptance();
    }
  }

  onTriggerExecute(trigger: ExecutionTriggerData): void {
    console.log('Executing trigger:', trigger);
    this.simulateCommandExecution(trigger);
  }

  private simulateProposalAcceptance(): void {
    // Show a notification or update UI to indicate proposal was accepted
    console.log('✅ Proposta aceita! Criando gatilho de execução...');
  }

  private simulateCommandExecution(trigger: ExecutionTriggerData): void {
    // Simulate command execution with realistic timing
    trigger.status = 'running';
    trigger.lastExecuted = new Date();

    setTimeout(() => {
      // Randomly succeed or fail for demo purposes
      const success = Math.random() > 0.3;

      if (success) {
        trigger.status = 'success';
        trigger.output = `✅ Comando executado com sucesso!\n\n${trigger.command}\n\nSaída:\nTest Suites: 5 passed, 5 total\nTests: 42 passed, 42 total\nTime: ${(Math.random() * 5 + 1).toFixed(2)}s`;
      } else {
        trigger.status = 'failed';
        trigger.error = `❌ Erro na execução do comando:\n\n${trigger.command}\n\nErro:\nTest suite failed to run\nModule not found: 'some-module'\nPlease install dependencies: npm install`;
      }
    }, 2000 + Math.random() * 3000); // 2-5 seconds
  }
}