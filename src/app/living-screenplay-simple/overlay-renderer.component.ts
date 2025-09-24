import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  OverlayLayer,
  AgentLayer,
  RequirementLayer,
  CodeLayer,
  ModalConfirmation,
  ViewConfiguration
} from './overlay-system.types';
import { LayerDatabaseService } from './layer-database.service';

@Component({
  selector: 'app-overlay-renderer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overlay-container" [style.pointer-events]="'none'">
      <!-- Agent Layers -->
      <div
        *ngFor="let layer of visibleLayers"
        class="overlay-element"
        [ngClass]="'overlay-' + layer.type"
        [style.left.px]="layer.position.x"
        [style.top.px]="layer.position.y"
        [style.opacity]="getLayerOpacity(layer)"
        [style.transform]="getLayerTransform(layer)"
        [style.pointer-events]="'auto'"
        (click)="handleLayerClick(layer)"
        (mouseenter)="handleLayerHover(layer, true)"
        (mouseleave)="handleLayerHover(layer, false)">

        <!-- Agent Layer Template -->
        <div *ngIf="layer.type === 'agent'" class="agent-layer">
          <div class="layer-header">
            <span class="layer-icon">🤖</span>
            <strong>{{ layer.data.title }}</strong>
            <div class="layer-actions">
              <button
                class="action-btn execute-btn"
                [disabled]="getAgentLayer(layer).data.status === 'running'"
                (click)="executeAgent(getAgentLayer(layer)); $event.stopPropagation()">
                {{ getAgentLayer(layer).data.status === 'running' ? '⏳' : '▶️' }}
              </button>
            </div>
          </div>
          <div class="layer-content">
            <div class="layer-description">{{ layer.data.description }}</div>
            <div class="agent-details">
              <div class="agent-type">{{ getAgentLayer(layer).data.content.agentType }}</div>
              <div class="agent-status" [ngClass]="'status-' + getAgentLayer(layer).data.status">
                {{ getAgentLayer(layer).data.status }}
              </div>
            </div>
          </div>
        </div>

        <!-- Requirement Layer Template -->
        <div *ngIf="layer.type === 'requirement'" class="requirement-layer">
          <div class="layer-header">
            <span class="layer-icon">📋</span>
            <strong>{{ layer.data.title }}</strong>
            <div class="layer-actions">
              <button class="action-btn edit-btn" (click)="editRequirement(getRequirementLayer(layer)); $event.stopPropagation()">
                ✏️
              </button>
            </div>
          </div>
          <div class="layer-content">
            <div class="layer-description">{{ layer.data.description }}</div>
            <div class="requirement-status" [ngClass]="'status-' + layer.data.status">
              {{ layer.data.status }}
            </div>
          </div>
        </div>

        <!-- Code Layer Template -->
        <div *ngIf="layer.type === 'code'" class="code-layer">
          <div class="layer-header">
            <span class="layer-icon">💻</span>
            <strong>{{ layer.data.title }}</strong>
            <div class="layer-actions">
              <button class="action-btn view-btn" (click)="viewCode(getCodeLayer(layer)); $event.stopPropagation()">
                👁️
              </button>
            </div>
          </div>
          <div class="layer-content">
            <div class="layer-description">{{ layer.data.description }}</div>
            <div class="code-info">
              <code>{{ getCodeLayer(layer).data.content.filePath }}</code>
            </div>
          </div>
        </div>

        <!-- Test Layer Template -->
        <div *ngIf="layer.type === 'test'" class="test-layer">
          <div class="layer-header">
            <span class="layer-icon">🧪</span>
            <strong>{{ layer.data.title }}</strong>
            <div class="layer-actions">
              <button class="action-btn test-btn" (click)="runTests(layer); $event.stopPropagation()">
                ▶️
              </button>
            </div>
          </div>
          <div class="layer-content">
            <div class="layer-description">{{ layer.data.description }}</div>
            <div class="test-info">
              <div class="test-coverage">Coverage: {{ layer.data.content.coverage }}</div>
              <div class="test-status" [ngClass]="'status-' + layer.data.content.status">
                {{ layer.data.content.status }}
              </div>
            </div>
          </div>
        </div>

        <!-- Note Layer Template -->
        <div *ngIf="layer.type === 'note'" class="note-layer">
          <div class="layer-header">
            <span class="layer-icon">📝</span>
            <strong>{{ layer.data.title }}</strong>
            <div class="layer-actions">
              <button class="action-btn note-btn" (click)="openNote(layer); $event.stopPropagation()">
                👁️
              </button>
              <button
                *ngIf="layer.data.content.urgent"
                class="action-btn urgent-btn"
                (click)="markResolved(layer); $event.stopPropagation()">
                ✅
              </button>
            </div>
          </div>
          <div class="layer-content">
            <div class="layer-description">{{ layer.data.description }}</div>
            <div class="note-preview">{{ getNotePrev(layer.data.content.text) }}</div>
            <div *ngIf="layer.data.content.urgent" class="urgent-badge">🚨 URGENTE</div>
          </div>
        </div>

        <!-- Generic Layer Templates for other types -->
        <div *ngIf="!['agent', 'requirement', 'code', 'test', 'note'].includes(layer.type)" class="generic-layer">
          <div class="layer-header">
            <span class="layer-icon">📄</span>
            <strong>{{ layer.data.title }}</strong>
          </div>
          <div class="layer-content">
            <div class="layer-description">{{ layer.data.description }}</div>
          </div>
        </div>

        <!-- Layer Priority Indicator -->
        <div class="priority-indicator" [ngClass]="'priority-' + layer.data.priority"></div>
      </div>

      <!-- Tooltip -->
      <div
        *ngIf="tooltip.visible"
        class="layer-tooltip"
        [style.left.px]="tooltip.x"
        [style.top.px]="tooltip.y">
        {{ tooltip.text }}
      </div>
    </div>

    <!-- Modal Confirmation -->
    <div *ngIf="modalConfirmation" class="modal-overlay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>{{ modalConfirmation.title }}</h3>
          <button class="modal-close" (click)="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <p>{{ modalConfirmation.message }}</p>
        </div>
        <div class="modal-actions">
          <button
            class="modal-btn confirm-btn"
            (click)="confirmModalAction()">
            {{ modalConfirmation.actions.confirm.label }}
          </button>
          <button
            class="modal-btn cancel-btn"
            (click)="closeModal()">
            {{ modalConfirmation.actions.cancel.label }}
          </button>
          <button
            *ngIf="modalConfirmation.actions.alternative"
            class="modal-btn alternative-btn"
            (click)="alternativeModalAction()">
            {{ modalConfirmation.actions.alternative.label }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
    }

    .overlay-element {
      position: absolute;
      max-width: 300px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .overlay-element:hover {
      transform: scale(1.02);
      box-shadow: 0 6px 30px rgba(0,0,0,0.2);
    }

    .overlay-agent {
      border-left: 4px solid #6f42c1;
    }

    .overlay-requirement {
      border-left: 4px solid #ffc107;
    }

    .overlay-code {
      border-left: 4px solid #28a745;
    }

    .overlay-test {
      border-left: 4px solid #17a2b8;
    }

    .overlay-test {
      border-left: 4px solid #17a2b8;
    }

    .overlay-note {
      border-left: 4px solid #fd7e14;
    }

    .layer-header {
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 600;
    }

    .layer-icon {
      margin-right: 8px;
      font-size: 16px;
    }

    .layer-actions {
      display: flex;
      gap: 4px;
    }

    .action-btn {
      background: rgba(0,0,0,0.1);
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s ease;
    }

    .action-btn:hover {
      background: rgba(0,0,0,0.2);
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .layer-content {
      padding: 12px 16px;
      font-size: 12px;
      line-height: 1.4;
      color: #666;
    }

    .layer-description {
      margin-bottom: 8px;
    }

    .agent-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }

    .agent-type {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }

    .agent-status,
    .requirement-status {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: bold;
    }

    .status-ready { background: #d4edda; color: #155724; }
    .status-running { background: #fff3cd; color: #856404; }
    .status-completed { background: #d1ecf1; color: #0c5460; }
    .status-error { background: #f8d7da; color: #721c24; }
    .status-draft { background: #e2e3e5; color: #383d41; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-implemented { background: #d1ecf1; color: #0c5460; }
    .status-tested { background: #c3e6cb; color: #155724; }

    .code-info code {
      background: #f8f9fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', monospace;
      font-size: 10px;
    }

    .priority-indicator {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .priority-low { background: #28a745; }
    .priority-medium { background: #ffc107; }
    .priority-high { background: #fd7e14; }
    .priority-critical { background: #dc3545; }

    .layer-tooltip {
      position: fixed;
      background: #333;
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 11px;
      z-index: 1000;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }

    .modal-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      color: #333;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-body {
      padding: 20px 24px;
    }

    .modal-actions {
      padding: 16px 24px 20px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .modal-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .confirm-btn {
      background: #007bff;
      color: white;
    }

    .confirm-btn:hover {
      background: #0056b3;
    }

    .cancel-btn {
      background: #6c757d;
      color: white;
    }

    .cancel-btn:hover {
      background: #545b62;
    }

    .alternative-btn {
      background: #28a745;
      color: white;
    }

    .alternative-btn:hover {
      background: #1e7e34;
    }

    /* Specific layer styles */
    .test-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      font-size: 11px;
    }

    .test-coverage {
      color: #666;
      font-weight: bold;
    }

    .status-passing {
      background: #d4edda;
      color: #155724;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
    }

    .status-failing {
      background: #f8d7da;
      color: #721c24;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
    }

    .note-preview {
      font-size: 11px;
      color: #666;
      margin: 8px 0;
      font-style: italic;
      max-height: 40px;
      overflow: hidden;
      line-height: 1.3;
    }

    .urgent-badge {
      background: #dc3545;
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      margin-top: 6px;
      animation: urgentPulse 2s infinite;
    }

    @keyframes urgentPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .test-btn {
      background: #17a2b8;
      color: white;
    }

    .test-btn:hover {
      background: #138496;
    }

    .note-btn {
      background: #fd7e14;
      color: white;
    }

    .note-btn:hover {
      background: #e8690b;
    }

    .urgent-btn {
      background: #28a745;
      color: white;
      margin-left: 4px;
    }

    .urgent-btn:hover {
      background: #1e7e34;
    }
  `]
})
export class OverlayRendererComponent implements OnInit, OnDestroy {
  @Input() documentId: string = '';
  @Input() viewConfig: ViewConfiguration | null = null;
  @Output() layerAction = new EventEmitter<{action: string, layer: OverlayLayer, data?: any}>();

  visibleLayers: OverlayLayer[] = [];
  modalConfirmation: ModalConfirmation | null = null;
  tooltip = { visible: false, x: 0, y: 0, text: '' };

  private subscription = new Subscription();

  constructor(private layerDb: LayerDatabaseService) {}

  ngOnInit(): void {
    this.loadLayers();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private async loadLayers(): Promise<void> {
    try {
      const allLayers = await this.layerDb.getLayers(this.documentId);
      this.visibleLayers = this.filterVisibleLayers(allLayers);
    } catch (error) {
      console.error('Error loading layers:', error);
    }
  }

  private filterVisibleLayers(layers: OverlayLayer[]): OverlayLayer[] {
    if (!this.viewConfig) return layers;

    return layers.filter(layer => {
      if (!this.viewConfig!.visibleTypes.includes(layer.type)) return false;

      const mode = this.viewConfig!.mode;
      switch (mode) {
        case 'clean':
          return layer.visibility.showInCleanMode;
        case 'agents':
          return layer.visibility.showInAgentMode;
        case 'full':
          return layer.visibility.showInFullMode;
        default:
          return true;
      }
    });
  }

  getLayerOpacity(layer: OverlayLayer): number {
    if (!this.viewConfig) return 1;
    return this.viewConfig.opacity[layer.type] || 1;
  }

  getLayerTransform(layer: OverlayLayer): string {
    const scale = this.getLayerOpacity(layer);
    return `scale(${Math.max(0.8, scale)})`;
  }

  handleLayerClick(layer: OverlayLayer): void {
    const action = layer.interactions.clickAction;
    if (action) {
      this.layerAction.emit({ action, layer });

      if (action === 'execute-agent' && layer.type === 'agent') {
        this.showAgentConfirmation(layer as AgentLayer);
      } else if (action === 'open-modal') {
        this.showLayerModal(layer);
      }
    }
  }

  handleLayerHover(layer: OverlayLayer, isEntering: boolean): void {
    if (isEntering && layer.interactions.hoverTooltip) {
      this.tooltip = {
        visible: true,
        x: layer.position.x + 150,
        y: layer.position.y - 30,
        text: layer.interactions.hoverTooltip
      };
    } else {
      this.tooltip.visible = false;
    }
  }

  executeAgent(layer: AgentLayer): void {
    this.showAgentConfirmation(layer);
  }

  editRequirement(layer: RequirementLayer): void {
    this.showLayerModal(layer);
  }

  viewCode(layer: CodeLayer): void {
    this.showLayerModal(layer);
  }

  private showAgentConfirmation(layer: AgentLayer): void {
    this.modalConfirmation = {
      id: `confirm-${layer.id}`,
      type: 'agent-execution',
      title: `Executar ${layer.data.title}`,
      message: `Deseja executar o agente "${layer.data.title}"? Esta ação irá gerar código baseado no prompt configurado.`,
      data: layer,
      actions: {
        confirm: {
          label: 'Executar Agente',
          action: 'execute-agent',
          parameters: { layerId: layer.id }
        },
        cancel: {
          label: 'Cancelar'
        },
        alternative: {
          label: 'Editar Prompt',
          action: 'edit-agent',
          parameters: { layerId: layer.id }
        }
      },
      position: { x: layer.position.x, y: layer.position.y }
    };
  }

  private showLayerModal(layer: OverlayLayer): void {
    this.layerAction.emit({ action: 'open-layer-details', layer });
  }

  confirmModalAction(): void {
    if (this.modalConfirmation) {
      const action = this.modalConfirmation.actions.confirm;
      this.layerAction.emit({
        action: action.action,
        layer: this.modalConfirmation.data,
        data: action.parameters
      });
    }
    this.closeModal();
  }

  alternativeModalAction(): void {
    if (this.modalConfirmation?.actions.alternative) {
      const action = this.modalConfirmation.actions.alternative;
      this.layerAction.emit({
        action: action.action,
        layer: this.modalConfirmation.data,
        data: action.parameters
      });
    }
    this.closeModal();
  }

  closeModal(): void {
    this.modalConfirmation = null;
  }

  getAgentLayer(layer: OverlayLayer): AgentLayer {
    return layer as AgentLayer;
  }

  getRequirementLayer(layer: OverlayLayer): RequirementLayer {
    return layer as RequirementLayer;
  }

  getCodeLayer(layer: OverlayLayer): CodeLayer {
    return layer as CodeLayer;
  }

  runTests(layer: OverlayLayer): void {
    console.log('🧪 Running tests:', layer);
    this.layerAction.emit({ action: 'run-tests', layer });

    // Simulate test execution
    alert(`🧪 Executando testes: ${layer.data.title}\n\nArquivo: ${layer.data.content.testFile}\nCoverage: ${layer.data.content.coverage}`);
  }

  openNote(layer: OverlayLayer): void {
    console.log('📝 Opening note:', layer);
    this.showLayerModal(layer);
  }

  markResolved(layer: OverlayLayer): void {
    console.log('✅ Marking as resolved:', layer);
    this.layerAction.emit({ action: 'mark-resolved', layer });

    alert(`✅ Nota marcada como resolvida: ${layer.data.title}`);
  }

  getNotePrev(text: string): string {
    return text.length > 80 ? text.substring(0, 80) + '...' : text;
  }

  // Force recompilation
}