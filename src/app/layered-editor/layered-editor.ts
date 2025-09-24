import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InteractiveEditor } from '../interactive-editor/interactive-editor';
import {
  LayerDefinition,
  LayerContent,
  DocumentLayer,
  LAYER_DEFINITIONS,
  ZOOM_PRESETS,
  LayerService
} from './layer-types';
import { loadSoftwareExample } from './software-example';

@Component({
  selector: 'app-layered-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, InteractiveEditor],
  template: `
    <div class="layered-editor">
      <!-- Layer Controls -->
      <div class="layer-controls">
        <div class="example-loader">
          <h4>📁 Exemplos</h4>
          <button class="load-example-btn" (click)="loadSoftwareExample()">
            🛒 Carregar Exemplo: E-commerce Cart
          </button>
        </div>

        <div class="zoom-presets">
          <h4>🔍 Zoom Presets</h4>
          <div class="preset-buttons">
            <button
              *ngFor="let preset of zoomPresets"
              class="preset-btn"
              [class.active]="isPresetActive(preset.layers)"
              (click)="applyZoomPreset(preset.layers)"
              [title]="preset.description">
              {{ preset.icon }} {{ preset.name }}
            </button>
          </div>
        </div>

        <div class="layer-toggles">
          <h4>📚 Camadas Disponíveis</h4>
          <div class="layer-list">
            <div
              *ngFor="let layer of layerDefinitions"
              class="layer-item"
              [style.border-left-color]="layer.color">

              <label class="layer-checkbox">
                <input
                  type="checkbox"
                  [checked]="document.activeLayers.has(layer.id)"
                  (change)="toggleLayer(layer.id, $event)"
                  [disabled]="!canToggleLayer(layer.id)">

                <span class="layer-info">
                  <span class="layer-icon">{{ layer.icon }}</span>
                  <span class="layer-name">{{ layer.name }}</span>
                  <span class="layer-desc">{{ layer.description }}</span>
                </span>
              </label>

              <div *ngIf="getLayerContent(layer.id).length > 0" class="layer-stats">
                {{ getLayerContent(layer.id).length }} items
              </div>
            </div>
          </div>
        </div>

        <div class="layer-errors" *ngIf="layerErrors.length > 0">
          <h4>⚠️ Dependências</h4>
          <ul>
            <li *ngFor="let error of layerErrors">{{ error }}</li>
          </ul>
        </div>
      </div>

      <!-- Main Editor Area -->
      <div class="editor-area">
        <!-- Layer Indicator -->
        <div class="active-layers-indicator">
          <span class="indicator-title">Camadas Ativas:</span>
          <span
            *ngFor="let layerId of getActiveLayers()"
            class="layer-badge"
            [style.background-color]="getLayerColor(layerId)">
            {{ getLayerIcon(layerId) }} {{ getLayerName(layerId) }}
          </span>
        </div>

        <!-- Rendered Content -->
        <div class="layered-content">
          <!-- Base markdown sempre visível -->
          <div class="layer-content base-layer">
            <app-interactive-editor
              [content]="getRenderedContent()"
              [placeholder]="'Digite o markdown base...'"
              (contentChange)="onContentChange($event)">
            </app-interactive-editor>
          </div>

          <!-- Overlay layers -->
          <div
            *ngFor="let layerId of getActiveLayers()"
            class="layer-overlay"
            [attr.data-layer]="layerId"
            [style.z-index]="getLayerZIndex(layerId)">

            <div
              *ngFor="let content of getLayerContent(layerId)"
              class="layer-block"
              [style.border-left-color]="getLayerColor(layerId)">

              <div class="layer-block-header">
                <span class="layer-icon">{{ getLayerIcon(layerId) }}</span>
                <span class="layer-type">{{ getLayerName(layerId) }}</span>
                <button class="edit-btn" (click)="editLayerContent(content)">✏️</button>
              </div>

              <div class="layer-block-content" [innerHTML]="content.content"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Layer Content Editor Modal -->
      <div class="modal-backdrop" *ngIf="editingContent" (click)="closeEditor()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>✏️ Editar Conteúdo da Camada</h3>
            <button class="close-btn" (click)="closeEditor()">×</button>
          </div>

          <div class="modal-body">
            <div class="editor-meta">
              <label>Camada:</label>
              <select [(ngModel)]="editingContent.layerId">
                <option *ngFor="let layer of layerDefinitions" [value]="layer.id">
                  {{ layer.icon }} {{ layer.name }}
                </option>
              </select>
            </div>

            <div class="editor-meta">
              <label>Posição:</label>
              <select [(ngModel)]="editingContent.position">
                <option value="inline">Inline</option>
                <option value="sidebar">Sidebar</option>
                <option value="overlay">Overlay</option>
                <option value="expandable">Expandable</option>
              </select>
            </div>

            <textarea
              [(ngModel)]="editingContent.content"
              class="content-editor"
              rows="10"
              placeholder="Conteúdo da camada (HTML/Markdown)">
            </textarea>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeEditor()">Cancelar</button>
            <button class="btn btn-primary" (click)="saveLayerContent()">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./layered-editor.scss']
})
export class LayeredEditor implements OnInit {
  document: DocumentLayer = {
    baseContent: this.getSampleContent(),
    layers: new Map(),
    activeLayers: new Set(['base', 'structure'])
  };

  layerDefinitions = LAYER_DEFINITIONS;
  zoomPresets = ZOOM_PRESETS;
  layerService = new LayerService();
  layerErrors: string[] = [];
  editingContent: LayerContent | null = null;

  ngOnInit(): void {
    this.initializeSampleLayers();
    this.validateLayers();
  }

  private getSampleContent(): string {
    return `# Sistema de Autenticação

## Visão Geral
Implementar um sistema robusto de autenticação para a aplicação web.

## Objetivos
- Segurança robusta
- Experiência fluida do usuário
- Escalabilidade

## Próximos Passos
- Definir arquitetura
- Implementar backend
- Criar interface`;
  }

  private initializeSampleLayers(): void {
    // Camada de Estrutura
    this.document.layers.set('structure', [
      {
        layerId: 'structure',
        blockId: 'auth-flow',
        content: `
          <div class="structure-block">
            <h4>🏗️ Fluxo de Autenticação</h4>
            <ol>
              <li>Login → JWT Token</li>
              <li>Token → Local Storage</li>
              <li>Interceptor → Headers</li>
              <li>Refresh → Renovação</li>
            </ol>
          </div>
        `,
        position: 'inline'
      }
    ]);

    // Camada de Requisitos
    this.document.layers.set('requirements', [
      {
        layerId: 'requirements',
        blockId: 'auth-requirements',
        content: `
          <div class="requirements-block">
            <h4>📋 Requisitos Funcionais</h4>
            <ul>
              <li><strong>RF01:</strong> Sistema deve validar credenciais</li>
              <li><strong>RF02:</strong> Token deve expirar em 1h</li>
              <li><strong>RF03:</strong> Refresh automático antes da expiração</li>
              <li><strong>RN01:</strong> Máximo 3 tentativas de login</li>
            </ul>
          </div>
        `,
        position: 'expandable'
      }
    ]);

    // Camada de Agentes
    this.document.layers.set('agents', [
      {
        layerId: 'agents',
        blockId: 'auth-agent',
        content: `
          <div class="agent-block">
            <h4>🤖 Agente: @auth-specialist</h4>
            <p><strong>Prompt:</strong> "Gere implementação de AuthService em Angular com JWT"</p>
            <button class="agent-btn">🚀 Executar Agente</button>
          </div>
        `,
        position: 'sidebar'
      }
    ]);

    // Camada de Código
    this.document.layers.set('code', [
      {
        layerId: 'code',
        blockId: 'auth-service',
        content: `
          <div class="code-block">
            <h4>💻 AuthService Implementation</h4>
            <pre><code class="typescript">
export class AuthService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  login(credentials: LoginCredentials): Observable&lt;AuthResponse&gt; {
    return this.http.post&lt;AuthResponse&gt;(\`\${this.baseUrl}/auth/login\`, credentials)
      .pipe(
        tap(response => this.setToken(response.token)),
        catchError(this.handleError)
      );
  }
}
            </code></pre>
          </div>
        `,
        position: 'expandable'
      }
    ]);
  }

  toggleLayer(layerId: string, event: any): void {
    if (event.target.checked) {
      this.document.activeLayers.add(layerId);
    } else {
      this.document.activeLayers.delete(layerId);
    }
    this.validateLayers();
  }

  canToggleLayer(layerId: string): boolean {
    if (layerId === 'base') return false; // Base sempre ativa

    const layer = this.layerService.getLayerDefinition(layerId);
    if (!layer?.dependencies) return true;

    return layer.dependencies.every(dep => this.document.activeLayers.has(dep));
  }

  applyZoomPreset(layers: string[]): void {
    this.document.activeLayers.clear();
    layers.forEach(layer => this.document.activeLayers.add(layer));
    this.validateLayers();
  }

  isPresetActive(layers: string[]): boolean {
    if (layers.length !== this.document.activeLayers.size) return false;
    return layers.every(layer => this.document.activeLayers.has(layer));
  }

  validateLayers(): void {
    this.layerErrors = this.layerService.validateLayerDependencies(this.document.activeLayers);
  }

  getActiveLayers(): string[] {
    return Array.from(this.document.activeLayers)
      .filter(id => id !== 'base')
      .sort((a, b) => {
        const layerA = this.layerService.getLayerDefinition(a);
        const layerB = this.layerService.getLayerDefinition(b);
        return (layerA?.zIndex || 0) - (layerB?.zIndex || 0);
      });
  }

  getLayerContent(layerId: string): LayerContent[] {
    return this.document.layers.get(layerId) || [];
  }

  getLayerDefinition(layerId: string): LayerDefinition | undefined {
    return this.layerService.getLayerDefinition(layerId);
  }

  getLayerColor(layerId: string): string {
    return this.getLayerDefinition(layerId)?.color || '#666';
  }

  getLayerIcon(layerId: string): string {
    return this.getLayerDefinition(layerId)?.icon || '📄';
  }

  getLayerName(layerId: string): string {
    return this.getLayerDefinition(layerId)?.name || layerId;
  }

  getLayerZIndex(layerId: string): number {
    return this.getLayerDefinition(layerId)?.zIndex || 0;
  }

  getRenderedContent(): string {
    // TODO: Processar markdown base com filtros de camadas ativas
    return this.document.baseContent;
  }

  onContentChange(content: string): void {
    this.document.baseContent = content;
  }

  editLayerContent(content: LayerContent): void {
    this.editingContent = { ...content };
  }

  saveLayerContent(): void {
    if (!this.editingContent) return;

    const layerContents = this.document.layers.get(this.editingContent.layerId) || [];
    const index = layerContents.findIndex(c => c.blockId === this.editingContent!.blockId);

    if (index >= 0) {
      layerContents[index] = { ...this.editingContent };
    } else {
      layerContents.push({ ...this.editingContent });
    }

    this.document.layers.set(this.editingContent.layerId, layerContents);
    this.closeEditor();
  }

  closeEditor(): void {
    this.editingContent = null;
  }

  loadSoftwareExample(): void {
    const example = loadSoftwareExample();

    // Carregar conteúdo base
    this.document.baseContent = example.baseContent;

    // Carregar todas as camadas
    this.document.layers.clear();

    Object.keys(example.layers).forEach(layerId => {
      const layerContents = example.layers[layerId].map((content: any) => ({
        layerId,
        blockId: content.id,
        content: content.content,
        position: 'expandable'
      }));
      this.document.layers.set(layerId, layerContents);
    });

    // Ativar camadas iniciais (Visão Arquitetural)
    this.document.activeLayers.clear();
    ['base', 'structure', 'requirements'].forEach(layer => {
      this.document.activeLayers.add(layer);
    });

    this.validateLayers();
  }
}