import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InteractiveEditor } from '../interactive-editor/interactive-editor';
import { ProposalModal } from '../modal/proposal-modal.component';
import { InteractiveSidebar } from '../sidebar/interactive-sidebar';
import { ClickablePlaceholder } from '../placeholder/clickable-placeholder';

@Component({
  selector: 'app-editor-examples',
  standalone: true,
  imports: [
    CommonModule,
    InteractiveEditor,
    ProposalModal,
    InteractiveSidebar,
    ClickablePlaceholder
  ],
  template: `
    <div class="examples-container">
      <h2>🧪 Exemplos de Integração de Blocos</h2>

      <!-- Tabs para diferentes abordagens -->
      <div class="tabs">
        <button
          *ngFor="let tab of tabs; let i = index"
          class="tab"
          [class.active]="activeTab === i"
          (click)="activeTab = i">
          {{ tab.name }}
        </button>
      </div>

      <!-- Abordagem 1: Modal/Overlay -->
      <div *ngIf="activeTab === 0" class="example-section">
        <h3>1. 🔹 Modal/Overlay Flutuante</h3>
        <p>Clique no botão para abrir um modal com o componente completo.</p>

        <div class="demo-area">
          <button class="demo-btn" (click)="showModal = true">
            ✨ Abrir Proposta em Modal
          </button>

          <div class="code-preview">
            <strong>No markdown seria inserido:</strong>
            <code>[🔸 Proposta: Sistema de Auth (clique para editar)]</code>
          </div>
        </div>

        <!-- Modal -->
        <app-proposal-modal *ngIf="showModal" (close)="showModal = false">
        </app-proposal-modal>
      </div>

      <!-- Abordagem 2: Sidebar -->
      <div *ngIf="activeTab === 1" class="example-section">
        <h3>2. 🔹 Sidebar Interativo (Notion-like)</h3>
        <p>Editor + sidebar que abre ao lado com os componentes.</p>

        <div class="demo-area with-sidebar">
          <div class="editor-area">
            <app-interactive-editor
              [content]="sidebarContent"
              [placeholder]="'Digite aqui... Use /proposta para testar'"
              (contentChange)="onContentChange($event)"
              (blockCommand)="onBlockCommand($event)">
            </app-interactive-editor>
          </div>

          <app-interactive-sidebar
            [isOpen]="sidebarOpen"
            (blockSaved)="onBlockSaved($event)">
          </app-interactive-sidebar>
        </div>

        <button class="demo-btn" (click)="toggleSidebar()">
          {{ sidebarOpen ? 'Fechar' : 'Abrir' }} Sidebar
        </button>
      </div>

      <!-- Abordagem 3: Placeholders Clicáveis -->
      <div *ngIf="activeTab === 2" class="example-section">
        <h3>3. 🔹 Placeholders Clicáveis + Modal</h3>
        <p>Placeholders limpos no markdown que abrem componentes ao clicar.</p>

        <div class="demo-area">
          <div class="placeholder-examples">
            <app-clickable-placeholder
              blockType="proposal"
              [data]="sampleProposal"
              (blockClicked)="onPlaceholderClick($event)">
            </app-clickable-placeholder>

            <app-clickable-placeholder
              blockType="execution"
              [data]="sampleExecution"
              (blockClicked)="onPlaceholderClick($event)">
            </app-clickable-placeholder>

            <app-clickable-placeholder
              blockType="include"
              [data]="sampleInclude"
              (blockClicked)="onPlaceholderClick($event)">
            </app-clickable-placeholder>
          </div>

          <div class="integration-info">
            <strong>💡 Como integrar no editor:</strong>
            <ol>
              <li>Inserir placeholder simples no markdown</li>
              <li>Detectar cliques nos placeholders</li>
              <li>Abrir modal/sidebar com componente completo</li>
              <li>Salvar alterações de volta no placeholder</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Abordagem 4: Node Views (Conceitual) -->
      <div *ngIf="activeTab === 3" class="example-section">
        <h3>4. 🔹 Node Views do TipTap (Avançado)</h3>
        <p>Componentes Angular reais renderizados dentro do editor.</p>

        <div class="demo-area">
          <div class="concept-explanation">
            <h4>Conceito:</h4>
            <ul>
              <li>✅ Componentes totalmente funcionais dentro do markdown</li>
              <li>✅ Edição inline real (como Notion)</li>
              <li>❌ Complexo de implementar</li>
              <li>❌ Requer extensões customizadas do TipTap</li>
            </ul>

            <h4>Implementação necessária:</h4>
            <pre><code>{{ nodeViewExample }}</code></pre>

            <div class="status-indicator">
              <span class="status-complex">⚠️ Implementação Complexa</span>
              <span class="status-time">~3-5 dias de desenvolvimento</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Resultado do placeholder clicado -->
      <div *ngIf="clickedBlock" class="clicked-result">
        <h4>🎯 Bloco Clicado:</h4>
        <pre>{{ clickedBlock | json }}</pre>
        <button (click)="clickedBlock = null">Fechar</button>
      </div>
    </div>
  `,
  styles: [`
    .examples-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .tabs {
      display: flex;
      margin-bottom: 30px;
      border-bottom: 2px solid #eee;
    }

    .tab {
      padding: 12px 24px;
      border: none;
      background: none;
      cursor: pointer;
      font-weight: bold;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
    }

    .tab:hover {
      background: #f8f9fa;
    }

    .tab.active {
      color: #007bff;
      border-bottom-color: #007bff;
    }

    .example-section {
      margin-bottom: 40px;
    }

    .demo-area {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }

    .demo-area.with-sidebar {
      display: flex;
      gap: 20px;
      position: relative;
      min-height: 400px;
    }

    .editor-area {
      flex: 1;
      background: white;
      border-radius: 8px;
      padding: 15px;
    }

    .demo-btn {
      background: #007bff;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      margin: 10px 0;
    }

    .code-preview {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      margin-top: 15px;
      font-family: monospace;
    }

    .placeholder-examples {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .integration-info {
      background: #e7f3ff;
      border-left: 4px solid #007bff;
      padding: 15px;
      border-radius: 4px;
    }

    .concept-explanation {
      background: white;
      border-radius: 8px;
      padding: 20px;
    }

    .concept-explanation pre {
      background: #f1f3f4;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
    }

    .status-indicator {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }

    .status-complex {
      background: #fff3cd;
      color: #856404;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }

    .status-time {
      background: #d4edda;
      color: #155724;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }

    .clicked-result {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
    }

    .clicked-result pre {
      background: white;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
    }
  `]
})
export class EditorExamples {
  activeTab = 0;
  showModal = false;
  sidebarOpen = false;
  clickedBlock: any = null;

  tabs = [
    { name: '1. Modal/Overlay' },
    { name: '2. Sidebar' },
    { name: '3. Placeholders' },
    { name: '4. Node Views' }
  ];

  sidebarContent = `
    <h2>Editor com Sidebar</h2>
    <p>Este editor funciona junto com o sidebar interativo.</p>
    <p>Digite <code>/proposta</code> para testar!</p>
  `;

  sampleProposal = {
    id: 'example-1',
    title: 'Sistema de Autenticação JWT',
    description: 'Implementar autenticação segura com tokens JWT...',
    status: 'pending'
  };

  sampleExecution = {
    id: 'example-2',
    title: 'Executar Testes',
    command: 'npm test -- --coverage',
    status: 'idle'
  };

  sampleInclude = {
    id: 'example-3',
    title: 'Config Database',
    path: 'roteiros/database/postgres.md'
  };

  nodeViewExample = `// Extensão TipTap com Node Views
import { NodeViewRenderer } from '@tiptap/core'

const ProposalExtension = Node.create({
  name: 'proposalBlock',

  addNodeView() {
    return NodeViewRenderer(ProposalBlockComponent)
  },

  parseHTML() {
    return [{ tag: 'proposal-block' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['proposal-block', HTMLAttributes]
  }
})`;

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  onContentChange(content: string): void {
    console.log('Content changed:', content);
  }

  onBlockCommand(command: string): void {
    console.log('Block command:', command);
    if (command === 'proposta') {
      this.sidebarOpen = true;
    }
  }

  onBlockSaved(block: any): void {
    console.log('Block saved:', block);
  }

  onPlaceholderClick(event: {type: string, data: any}): void {
    this.clickedBlock = event;
    console.log('Placeholder clicked:', event);
  }
}