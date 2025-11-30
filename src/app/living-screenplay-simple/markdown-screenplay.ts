import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';
import { OverlayRendererComponent } from './overlay-renderer.component';
import { LayerDatabaseService } from './layer-database.service';
import { OverlayLayer, ViewConfiguration } from './overlay-system.types';

interface ActionButton {
  id: string;
  type: string;
  text: string;
  description: string;
}

interface ModalData {
  id: string;
  title: string;
  content: string;
  position: { x: number; y: number; };
  visible: boolean;
}

@Component({
  selector: 'app-markdown-screenplay',
  standalone: true,
  imports: [CommonModule, OverlayRendererComponent],
  template: `
    <div class="screenplay-container">
      <div class="control-panel">
        <h3>🎬 Roteiro Vivo (Markdown)</h3>

        <div class="file-info">
          <p>📄 <strong>screenplay.md</strong></p>
          <p>🔄 Auto-reload: {{ autoReload ? 'ON' : 'OFF' }}</p>
          <button (click)="toggleAutoReload()" class="toggle-btn">
            {{ autoReload ? '⏸️ Pausar' : '▶️ Ativar' }}
          </button>
        </div>

        <div class="view-controls">
          <button
            [class.active]="currentView === 'clean'"
            (click)="switchView('clean')">
            📝 Roteiro Limpo
          </button>
          <button
            [class.active]="currentView === 'agents'"
            (click)="switchView('agents')">
            🤖 Com Agentes
          </button>
          <button
            [class.active]="currentView === 'full'"
            (click)="switchView('full')">
            🌐 Visão Completa
          </button>
        </div>

        <div class="drag-controls">
          <h4>🎯 Controles de Posicionamento</h4>
          <button (click)="resetCirclePositions()" class="reset-btn">
            🔄 Resetar Posições
          </button>
          <p class="drag-help">💡 Arraste os círculos para posicioná-los perfeitamente</p>
        </div>

        <div class="actions-detected" *ngIf="detectedActions.length > 0">
          <h4>🎯 Ações Detectadas</h4>
          <div class="action-list">
            <div *ngFor="let action of detectedActions" class="action-item">
              <span class="action-icon">{{ getActionIcon(action.type) }}</span>
              <span class="action-name">{{ action.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="screenplay-canvas">
        <div class="canvas-header">
          <h2>📋 Living Screenplay</h2>
          <div class="view-info">
            Modo: <strong>{{ getViewName() }}</strong> |
            Ações: <strong>{{ detectedActions.length }}</strong> |
            Modais: <strong>{{ detectedModals.length }}</strong>
          </div>
        </div>

        <div class="base-content"
             #markdownContainer
             [innerHTML]="processedMarkdown">
        </div>

        <!-- Interactive overlay circles with drag & drop -->
        <div class="interactive-overlays"
             *ngIf="currentView !== 'clean'"
             (mousemove)="onMouseMove($event)"
             (mouseup)="onMouseUp($event)">

          <!-- Auth area circle overlays -->
          <div class="interactive-circle auth-circle draggable"
               [class.dragging]="dragState.isDragging && dragState.currentCircle === 'auth-1'"
               [style.top.px]="circlePositions['auth-1'].y"
               [style.left.px]="circlePositions['auth-1'].x"
               (mouseenter)="!dragState.isDragging && showIconPopup($event, 'auth-agent')"
               (mouseleave)="!dragState.isDragging && hideQuickPopup()"
               (mousedown)="onMouseDown($event, 'auth-1')"
               (click)="!dragState.isDragging && executeQuickAction('auth')"
               title="🤖 Sistema de Autenticação - Arraste para posicionar">
            🤖
          </div>

          <div class="interactive-circle auth-circle draggable"
               [class.dragging]="dragState.isDragging && dragState.currentCircle === 'auth-2'"
               [style.top.px]="circlePositions['auth-2'].y"
               [style.left.px]="circlePositions['auth-2'].x"
               (mouseenter)="!dragState.isDragging && showIconPopup($event, 'auth-secure')"
               (mouseleave)="!dragState.isDragging && hideQuickPopup()"
               (mousedown)="onMouseDown($event, 'auth-2')"
               (click)="!dragState.isDragging && executeQuickAction('auth')"
               title="🔐 Segurança JWT - Arraste para posicionar">
            🔐
          </div>

          <div class="interactive-circle auth-circle draggable"
               [class.dragging]="dragState.isDragging && dragState.currentCircle === 'auth-3'"
               [style.top.px]="circlePositions['auth-3'].y"
               [style.left.px]="circlePositions['auth-3'].x"
               (mouseenter)="!dragState.isDragging && showIconPopup($event, 'auth-ready')"
               (mouseleave)="!dragState.isDragging && hideQuickPopup()"
               (mousedown)="onMouseDown($event, 'auth-3')"
               (click)="!dragState.isDragging && executeQuickAction('auth')"
               title="⚡ Pronto - Arraste para posicionar">
            ⚡
          </div>

          <!-- Cart area circle overlays -->
          <div class="interactive-circle cart-circle draggable"
               [class.dragging]="dragState.isDragging && dragState.currentCircle === 'cart-1'"
               [style.top.px]="circlePositions['cart-1'].y"
               [style.left.px]="circlePositions['cart-1'].x"
               (mouseenter)="!dragState.isDragging && showIconPopup($event, 'cart-agent')"
               (mouseleave)="!dragState.isDragging && hideQuickPopup()"
               (mousedown)="onMouseDown($event, 'cart-1')"
               (click)="!dragState.isDragging && executeQuickAction('cart')"
               title="🛒 Carrinho - Arraste para posicionar">
            🛒
          </div>

          <div class="interactive-circle cart-circle draggable"
               [class.dragging]="dragState.isDragging && dragState.currentCircle === 'cart-2'"
               [style.top.px]="circlePositions['cart-2'].y"
               [style.left.px]="circlePositions['cart-2'].x"
               (mouseenter)="!dragState.isDragging && showIconPopup($event, 'cart-sync')"
               (mouseleave)="!dragState.isDragging && hideQuickPopup()"
               (mousedown)="onMouseDown($event, 'cart-2')"
               (click)="!dragState.isDragging && executeQuickAction('cart')"
               title="🔄 Sync - Arraste para posicionar">
            🔄
          </div>

          <div class="interactive-circle cart-circle draggable"
               [class.dragging]="dragState.isDragging && dragState.currentCircle === 'cart-3'"
               [style.top.px]="circlePositions['cart-3'].y"
               [style.left.px]="circlePositions['cart-3'].x"
               (mouseenter)="!dragState.isDragging && showIconPopup($event, 'cart-wait')"
               (mouseleave)="!dragState.isDragging && hideQuickPopup()"
               (mousedown)="onMouseDown($event, 'cart-3')"
               (click)="!dragState.isDragging && executeQuickAction('cart')"
               title="⏳ Aguardando - Arraste para posicionar">
            ⏳
          </div>

          <!-- Progress area overlay -->
          <div class="interactive-circle progress-circle draggable"
               [class.dragging]="dragState.isDragging && dragState.currentCircle === 'progress'"
               [style.top.px]="circlePositions['progress'].y"
               [style.left.px]="circlePositions['progress'].x"
               (mouseenter)="!dragState.isDragging && showIconPopup($event, 'progress')"
               (mouseleave)="!dragState.isDragging && hideQuickPopup()"
               (mousedown)="onMouseDown($event, 'progress')"
               (click)="!dragState.isDragging && executeQuickAction('progress')"
               title="🎯 Progresso - Arraste para posicionar">
            🎯
          </div>
        </div>

        <!-- Test button OUTSIDE icon zones -->
        <button
          style="position: absolute; top: 10px; right: 10px; z-index: 2000; background: red; color: white; padding: 10px; border: none; border-radius: 5px; cursor: pointer;"
          (click)="executeQuickAction('test')"
          title="Test Click">
          🧪 TESTE CLIQUE
        </button>

        <!-- Database-backed overlay system -->
        <app-overlay-renderer
          [documentId]="documentId"
          [viewConfig]="viewConfiguration"
          (layerAction)="handleLayerAction($event)">
        </app-overlay-renderer>

        <!-- Quick popup for hover -->
        <div class="quick-popup"
             *ngIf="quickPopup.visible"
             [style.left.px]="quickPopup.x"
             [style.top.px]="quickPopup.y">
          <div class="popup-header">
            {{ quickPopup.title }}
          </div>
          <div class="popup-content">
            {{ quickPopup.description }}
          </div>
          <div class="popup-actions">
            <button class="popup-btn" (click)="executeQuickAction(quickPopup.actionId)">
              {{ quickPopup.actionText }}
            </button>
          </div>
        </div>
      </div>

      <!-- Popup para hover -->
      <div class="action-popup"
           *ngIf="popupVisible"
           [style.left.px]="popupX"
           [style.top.px]="popupY">
        {{ popupText }}
        <div class="popup-arrow"></div>
      </div>

      <!-- Icon Modal -->
      <div *ngIf="iconModal.visible"
           class="icon-modal-overlay"
           (click)="closeIconModal()">
        <div class="icon-modal-content"
             (click)="$event.stopPropagation()">
          <div class="icon-modal-header">
            <h2>{{ iconModal.title }}</h2>
            <button class="icon-modal-close"
                    (click)="closeIconModal()">
              ✕
            </button>
          </div>
          <div class="icon-modal-body"
               [innerHTML]="iconModal.content">
          </div>
          <div class="icon-modal-footer">
            <button class="modal-btn primary"
                    (click)="executeModalAction()">
              🚀 Executar
            </button>
            <button class="modal-btn secondary"
                    (click)="closeIconModal()">
              Fechar
            </button>
          </div>
        </div>
      </div>

      <!-- Modais contextuais -->
      <div *ngFor="let modal of activeModals"
           class="contextual-modal"
           [style.left.px]="modal.position.x"
           [style.top.px]="modal.position.y">
        <div class="modal-header">
          <h4>{{ modal.title }}</h4>
          <button (click)="closeModal(modal.id)" class="close-modal">✕</button>
        </div>
        <div class="modal-content" [innerHTML]="modal.content"></div>
      </div>
    </div>
  `,
  styles: [`
    .screenplay-container {
      display: flex;
      height: 100vh;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      color: #ffffff;
      font-family: 'Inter', sans-serif;
    }

    .control-panel {
      width: 300px;
      background: rgba(0, 0, 0, 0.8);
      /* REMOVIDO: backdrop-filter: blur(10px); - performance issue */
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      padding: 20px;
      overflow-y: auto;
      box-shadow: 2px 0 20px rgba(0, 0, 0, 0.5);
    }

    .control-panel h3 {
      margin: 0 0 20px 0;
      color: white;
      font-size: 18px;
      font-weight: 700;
    }

    .file-info {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }

    .file-info p {
      margin: 5px 0;
      font-size: 13px;
    }

    .toggle-btn {
      width: 100%;
      padding: 8px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-top: 10px;
    }

    .reset-btn {
      width: 100%;
      padding: 8px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-top: 10px;
      transition: all 0.3s ease;
    }

    .reset-btn:hover {
      background: #c82333;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
    }

    .view-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }

    .view-controls button {
      padding: 12px;
      border: none;
      border-radius: 6px;
      background: #495057;
      color: white;
      cursor: pointer;
      font-weight: bold;
      transition: all 0.3s ease;
    }

    .view-controls button:hover {
      background: #6c757d;
    }

    .view-controls button.active {
      background: #007bff;
    }

    .actions-detected {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 15px;
    }

    .actions-detected h4 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #ffffff;
    }

    .action-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .action-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      font-size: 12px;
    }

    .action-icon {
      font-size: 14px;
    }

    .action-name {
      color: rgba(255, 255, 255, 0.9);
    }

    .screenplay-canvas {
      flex: 1;
      background: #ffffff;
      position: relative;
      overflow: auto;
    }

    .canvas-header {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      padding: 20px;
      border-bottom: 2px solid #dee2e6;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .canvas-header h2 {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 24px;
      font-weight: 700;
    }

    .view-info {
      color: #666;
      font-size: 14px;
    }

    .view-info strong {
      color: #333;
    }

    .base-content {
      padding: 40px;
      line-height: 1.8;
      font-size: 16px;
      color: #333;
      min-height: calc(100vh - 120px);
      position: relative;
    }

    .base-content h1, .base-content h2, .base-content h3 {
      color: #2c3e50;
      margin: 30px 0 20px 0;
      font-weight: 700;
    }

    .base-content h1 { font-size: 32px; }
    .base-content h2 { font-size: 24px; }
    .base-content h3 { font-size: 20px; }

    .base-content p, .base-content li {
      margin-bottom: 12px;
    }

    .base-content ul, .base-content ol {
      margin: 16px 0;
      padding-left: 20px;
    }

    .base-content blockquote {
      border-left: 4px solid #007bff;
      padding-left: 16px;
      margin: 20px 0;
      color: #666;
      font-style: italic;
    }

    .base-content code {
      background: #f8f9fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 14px;
      color: #e83e8c;
    }

    .overlay-elements {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 5;
    }

    .element {
      position: absolute;
      pointer-events: auto;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      transform-origin: top left;
      max-width: 300px;
      z-index: 10;
    }

    .agent-element {
      background: linear-gradient(135deg, #6f42c1 0%, #8b5cf6 100%);
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(111, 66, 193, 0.3);
    }

    .requirement-element {
      background: linear-gradient(135deg, #ffc107 0%, #ffb300 100%);
      color: #333;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(255, 193, 7, 0.3);
    }

    .code-element {
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(40, 167, 69, 0.3);
    }

    .element-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      font-weight: 600;
      font-size: 13px;
    }

    .element-header button {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
      margin-left: auto;
    }

    .element-header button:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .element-content {
      padding: 12px 15px;
      font-size: 12px;
      line-height: 1.4;
      opacity: 0.9;
    }

    /* Botões inline dinâmicos */
    :global(.inline-action) {
      display: inline-block;
      margin-left: 8px;
      padding: 4px 8px;
      background: rgba(0, 123, 255, 0.1);
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.3s ease;
      position: relative;
      top: -2px;
      text-decoration: none;
    }

    :global(.inline-action:hover) {
      background: rgba(0, 123, 255, 0.2);
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
    }

    :global(.inline-action:active) {
      transform: scale(0.95);
    }

    /* Popup de hover */
    .action-popup {
      position: fixed;
      background: #333;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      opacity: 0.95;
      max-width: 200px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: fadeInPopup 0.2s ease;
    }

    .popup-arrow {
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #333;
    }

    @keyframes fadeInPopup {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 0.95; transform: translateY(0); }
    }

    /* Modais contextuais */
    .contextual-modal {
      position: fixed;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(0, 0, 0, 0.1);
      max-width: 400px;
      min-width: 300px;
      z-index: 1001;
      animation: modalFadeIn 0.3s ease;
      /* REMOVIDO: backdrop-filter: blur(10px); - performance issue */
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 12px 12px 0 0;
    }

    .modal-header h4 {
      margin: 0;
      color: #333;
      font-size: 16px;
      font-weight: 600;
    }

    .close-modal {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .close-modal:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }

    .modal-content {
      padding: 20px;
      color: #333;
      font-size: 14px;
      line-height: 1.6;
    }

    .modal-content h1, .modal-content h2, .modal-content h3 {
      color: #2c3e50;
      margin: 16px 0 12px 0;
    }

    .modal-content h1 { font-size: 20px; }
    .modal-content h2 { font-size: 18px; }
    .modal-content h3 { font-size: 16px; }

    .modal-content p, .modal-content li {
      margin-bottom: 8px;
    }

    .modal-content ul, .modal-content ol {
      margin: 12px 0;
      padding-left: 20px;
    }

    .modal-content code {
      background: #f8f9fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      color: #e83e8c;
    }

    /* Indicadores de modal no texto */
    :global(.modal-trigger) {
      display: inline-block;
      margin-left: 4px;
      padding: 2px 6px;
      background: rgba(255, 193, 7, 0.1);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.3s ease;
      position: relative;
      top: -1px;
      color: #856404;
      text-decoration: none;
    }

    :global(.modal-trigger:hover) {
      background: rgba(255, 193, 7, 0.2);
      transform: scale(1.05);
    }

    @keyframes modalFadeIn {
      from {
        opacity: 0;
        transform: translateY(-10px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Interactive overlay circles positioned over markdown */
    .interactive-overlays {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 9999;
    }

    .interactive-circle {
      position: absolute;
      width: 35px;
      height: 35px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      cursor: pointer;
      pointer-events: auto;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10000;
      user-select: none;

      /* Base styling */
      background: rgba(0, 123, 255, 0.8);
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
      /* REMOVIDO: backdrop-filter: blur(8px); - performance issue */
    }

    .interactive-circle:hover {
      transform: scale(1.4);
      background: rgba(0, 123, 255, 0.95);
      border: 3px solid rgba(255, 255, 255, 1);
      box-shadow: 0 6px 20px rgba(0, 123, 255, 0.6);
      z-index: 10001;
    }

    .interactive-circle:active {
      transform: scale(1.6);
      background: rgba(0, 255, 0, 0.9);
      border: 3px solid rgba(255, 255, 255, 1);
      box-shadow: 0 8px 25px rgba(0, 255, 0, 0.7);
    }

    /* Themed styling for different categories */
    .auth-circle {
      background: rgba(111, 66, 193, 0.8);
      box-shadow: 0 4px 12px rgba(111, 66, 193, 0.4);
    }

    .auth-circle:hover {
      background: rgba(111, 66, 193, 0.95);
      box-shadow: 0 6px 20px rgba(111, 66, 193, 0.6);
    }

    .cart-circle {
      background: rgba(40, 167, 69, 0.8);
      box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
    }

    .cart-circle:hover {
      background: rgba(40, 167, 69, 0.95);
      box-shadow: 0 6px 20px rgba(40, 167, 69, 0.6);
    }

    .progress-circle {
      background: rgba(255, 193, 7, 0.8);
      box-shadow: 0 4px 12px rgba(255, 193, 7, 0.4);
    }

    .progress-circle:hover {
      background: rgba(255, 193, 7, 0.95);
      box-shadow: 0 6px 20px rgba(255, 193, 7, 0.6);
    }

    /* Drag & Drop states */
    .draggable {
      cursor: grab;
    }

    .draggable:active,
    .draggable.dragging {
      cursor: grabbing !important;
      transform: scale(1.2) !important;
      z-index: 10002 !important;
      filter: brightness(1.2);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
    }

    .interactive-overlays.dragging {
      user-select: none;
    }

    /* Responsive behavior */
    @media (max-width: 768px) {
      .interactive-circle {
        width: 30px;
        height: 30px;
        font-size: 16px;
      }
    }

    @media (min-width: 1200px) {
      .interactive-circle {
        width: 40px;
        height: 40px;
        font-size: 20px;
      }
    }

    /* Quick popup styles */
    .quick-popup {
      position: fixed;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(0, 0, 0, 0.1);
      min-width: 280px;
      max-width: 350px;
      z-index: 2000;
      animation: quickPopupFadeIn 0.2s ease;
      pointer-events: auto;
    }

    .popup-header {
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      font-weight: 600;
      font-size: 14px;
      color: #333;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 12px 12px 0 0;
    }

    .popup-content {
      padding: 12px 16px;
      font-size: 13px;
      color: #666;
      line-height: 1.4;
    }

    .popup-actions {
      padding: 8px 16px 12px;
      display: flex;
      justify-content: flex-end;
    }

    .popup-btn {
      background: #007bff;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .popup-btn:hover {
      background: #0056b3;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
    }

    @keyframes quickPopupFadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Icon Modal Styles */
    .icon-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: modalFadeIn 0.3s ease;
    }

    .icon-modal-content {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      animation: modalSlideIn 0.3s ease;
    }

    .icon-modal-header {
      padding: 24px 32px 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 16px 16px 0 0;
    }

    .icon-modal-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .icon-modal-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      color: white;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .icon-modal-close:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .icon-modal-body {
      padding: 32px;
      line-height: 1.6;
    }

    .icon-modal-footer {
      padding: 20px 32px 32px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .modal-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .modal-btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .modal-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }

    .modal-btn.secondary {
      background: #f8f9fa;
      color: #6c757d;
      border: 1px solid #dee2e6;
    }

    .modal-btn.secondary:hover {
      background: #e9ecef;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-50px) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `]
})
export class MarkdownScreenplay implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('markdownContainer', { static: false }) markdownContainer!: ElementRef;

  currentView: 'clean' | 'agents' | 'full' = 'agents';
  autoReload = false;
  reloadInterval: any;

  // Markdown content
  rawMarkdown = '';
  processedMarkdown = '';
  detectedActions: ActionButton[] = [];
  detectedModals: ModalData[] = [];

  // Popup state
  popupVisible = false;
  popupX = 0;
  popupY = 0;
  popupText = '';

  // Modal state
  activeModals: ModalData[] = [];

  // Overlay system
  documentId = 'screenplay-main';
  viewConfiguration: ViewConfiguration;

  // Quick popup for hover
  quickPopup = {
    visible: false,
    x: 0,
    y: 0,
    title: '',
    description: '',
    actionText: '',
    actionId: ''
  };

  // Modal system
  iconModal = {
    visible: false,
    iconId: '',
    title: '',
    content: '',
    type: ''
  };

  // Drag & Drop system for interactive circles
  circlePositions: { [key: string]: { x: number; y: number } } = {
    'auth-1': { x: 760, y: 195 },
    'auth-2': { x: 790, y: 195 },
    'auth-3': { x: 820, y: 195 },
    'cart-1': { x: 680, y: 435 },
    'cart-2': { x: 710, y: 435 },
    'cart-3': { x: 740, y: 435 },
    'progress': { x: 142, y: 1730 }
  };

  dragState = {
    isDragging: false,
    currentCircle: '',
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  };

  constructor(
    private http: HttpClient,
    private layerDb: LayerDatabaseService
  ) {
    this.viewConfiguration = this.createViewConfiguration();
    this.loadCirclePositions();
  }

  ngOnInit(): void {
    this.loadMarkdown();
    this.syncMarkdownWithDatabase();
  }

  ngAfterViewInit(): void {
    // Setup event listeners after view is initialized
    setTimeout(() => this.setupActionListeners(), 100);
  }

  loadMarkdown(): void {
    this.http.get('/screenplay.md', { responseType: 'text' })
      .subscribe({
        next: (markdown) => {
          this.rawMarkdown = markdown;
          this.processMarkdown();
        },
        error: (error) => {
          console.error('Error loading markdown:', error);
          this.processedMarkdown = '<p>❌ Erro ao carregar screenplay.md</p>';
        }
      });
  }

  processMarkdown(): void {
    // Detectar ações e modais no markdown usando regex
    this.detectActions();
    this.detectModals();

    // Processar markdown para HTML
    let html = marked(this.rawMarkdown) as string;

    // Injetar botões nas linhas que têm @action
    html = this.injectActionButtons(html);

    // Injetar ícones clicáveis nos emojis primeiro
    html = this.injectClickableEmojis(html);

    // Injetar triggers de modal (desativado temporariamente para debug)
    // html = this.injectModalTriggers(html);

    this.processedMarkdown = html;

    // Setup listeners after DOM is updated
    setTimeout(() => this.setupActionListeners(), 100);
  }

  detectActions(): void {
    const actionRegex = /<!--\s*@action:(\w+)\s*-->/g;
    const matches = [...this.rawMarkdown.matchAll(actionRegex)];

    this.detectedActions = matches.map(match => ({
      id: match[1],
      type: match[1],
      text: this.getActionText(match[1]),
      description: this.getActionDescription(match[1])
    }));
  }

  detectModals(): void {
    const modalRegex = /<!--\s*@modal:(\w+(?:-\w+)*)\s*-->/g;
    const matches = [...this.rawMarkdown.matchAll(modalRegex)];

    this.detectedModals = matches.map(match => ({
      id: match[1],
      title: this.getModalTitle(match[1]),
      content: this.getModalContent(match[1]),
      position: { x: 100, y: 100 },
      visible: false
    }));
  }

  injectActionButtons(html: string): string {
    // Substituir comentários @action por botões
    return html.replace(
      /<!--\s*@action:(\w+)\s*-->/g,
      (match, actionId) => {
        const icon = this.getActionIcon(actionId);
        const description = this.getActionDescription(actionId);

        return `<span class="inline-action"
                      data-action="${actionId}"
                      title="${description}">
                  ${icon}
                </span>`;
      }
    );
  }

  injectModalTriggers(html: string): string {
    // Substituir comentários @modal por triggers clicáveis
    return html.replace(
      /<!--\s*@modal:(\w+(?:-\w+)*)\s*-->/g,
      (match, modalId) => {
        return `<span class="modal-trigger"
                      data-modal="${modalId}"
                      title="Clique para ver detalhes">
                  📋
                </span>`;
      }
    );
  }

  injectClickableEmojis(html: string): string {
    // Substituir emojis específicos por versões clicáveis
    let processedHtml = html;

    // Padrões mais simples que funcionam com qualquer HTML
    // Auth emojis (🤖 🔐 ⚡)
    processedHtml = processedHtml.replace(/🤖/g,
      '<span class="clickable-emoji auth-emoji" data-action="auth" data-icon="auth-agent">🤖</span>'
    );
    processedHtml = processedHtml.replace(/🔐/g,
      '<span class="clickable-emoji auth-emoji" data-action="auth" data-icon="auth-secure">🔐</span>'
    );
    processedHtml = processedHtml.replace(/⚡/g,
      '<span class="clickable-emoji auth-emoji" data-action="auth" data-icon="auth-ready">⚡</span>'
    );

    // Cart emojis (🛒 🔄 ⏳)
    processedHtml = processedHtml.replace(/🛒/g,
      '<span class="clickable-emoji cart-emoji" data-action="cart" data-icon="cart-agent">🛒</span>'
    );
    processedHtml = processedHtml.replace(/🔄/g,
      '<span class="clickable-emoji cart-emoji" data-action="cart" data-icon="cart-sync">🔄</span>'
    );
    processedHtml = processedHtml.replace(/⏳/g,
      '<span class="clickable-emoji cart-emoji" data-action="cart" data-icon="cart-wait">⏳</span>'
    );

    // Progress emoji (🎯)
    processedHtml = processedHtml.replace(/🎯/g,
      '<span class="clickable-emoji progress-emoji" data-action="progress" data-icon="progress">🎯</span>'
    );

    return processedHtml;
  }

  setupActionListeners(): void {
    if (!this.markdownContainer) return;

    const container = this.markdownContainer.nativeElement;

    // Setup action buttons
    const actionButtons = container.querySelectorAll('.inline-action');
    actionButtons.forEach((button: Element) => {
      const htmlButton = button as HTMLElement;

      // Remove existing listeners
      htmlButton.removeEventListener('click', this.handleActionClick);
      htmlButton.removeEventListener('mouseenter', this.handleActionHover);
      htmlButton.removeEventListener('mouseleave', this.handleActionLeave);

      // Add new listeners
      htmlButton.addEventListener('click', this.handleActionClick.bind(this));
      htmlButton.addEventListener('mouseenter', this.handleActionHover.bind(this));
      htmlButton.addEventListener('mouseleave', this.handleActionLeave.bind(this));
    });

    // Setup modal triggers
    const modalTriggers = container.querySelectorAll('.modal-trigger');
    modalTriggers.forEach((trigger: Element) => {
      const htmlTrigger = trigger as HTMLElement;

      // Remove existing listeners
      htmlTrigger.removeEventListener('click', this.handleModalClick);
      htmlTrigger.removeEventListener('mouseenter', this.handleModalHover);
      htmlTrigger.removeEventListener('mouseleave', this.handleActionLeave);

      // Add new listeners
      htmlTrigger.addEventListener('click', this.handleModalClick.bind(this));
      htmlTrigger.addEventListener('mouseenter', this.handleModalHover.bind(this));
      htmlTrigger.addEventListener('mouseleave', this.handleActionLeave.bind(this));
    });

    // Setup clickable emojis
    const emojiTriggers = container.querySelectorAll('.clickable-emoji');
    console.log('🎯 Encontrados', emojiTriggers.length, 'emojis clicáveis');

    emojiTriggers.forEach((emoji: Element) => {
      const htmlEmoji = emoji as HTMLElement;
      console.log('📝 Configurando emoji:', htmlEmoji.textContent, 'data-icon:', htmlEmoji.getAttribute('data-icon'));

      // Remove existing listeners
      htmlEmoji.removeEventListener('click', this.handleEmojiClick);
      htmlEmoji.removeEventListener('mouseenter', this.handleEmojiHover);
      htmlEmoji.removeEventListener('mouseleave', this.handleActionLeave);

      // Add new listeners
      htmlEmoji.addEventListener('click', this.handleEmojiClick.bind(this));
      htmlEmoji.addEventListener('mouseenter', this.handleEmojiHover.bind(this));
      htmlEmoji.addEventListener('mouseleave', this.handleActionLeave.bind(this));
    });
  }

  handleActionClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const actionId = target.getAttribute('data-action');
    if (actionId) {
      this.executeAction(actionId);
    }
  }

  handleActionHover = (event: Event): void => {
    const target = event.target as HTMLElement;
    const actionId = target.getAttribute('data-action');
    if (actionId) {
      const description = this.getActionDescription(actionId);
      this.showPopup(event as MouseEvent, description);
    }
  }

  handleActionLeave = (): void => {
    this.hidePopup();
  }

  handleModalClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const modalId = target.getAttribute('data-modal');
    if (modalId) {
      this.openModal(modalId, event as MouseEvent);
    }
  }

  handleModalHover = (event: Event): void => {
    const target = event.target as HTMLElement;
    const modalId = target.getAttribute('data-modal');
    if (modalId) {
      const title = this.getModalTitle(modalId);
      this.showPopup(event as MouseEvent, `Ver detalhes: ${title}`);
    }
  }

  handleEmojiClick = (event: Event): void => {
    console.log('🖱️ Emoji clicado!');
    const target = event.target as HTMLElement;
    const actionId = target.getAttribute('data-action');
    console.log('📋 Action ID:', actionId);
    if (actionId) {
      this.executeQuickAction(actionId);
    }
  }

  handleEmojiHover = (event: Event): void => {
    console.log('🔍 Emoji hover detectado!');
    const target = event.target as HTMLElement;
    const iconId = target.getAttribute('data-icon');
    console.log('🎯 Icon ID:', iconId);
    if (iconId) {
      this.showIconPopup(event as MouseEvent, iconId);
    }
  }

  executeAction(actionId: string): void {
    console.log(`🚀 Executando ação do markdown: ${actionId}`);

    const messages = {
      'auth': '🔐 Iniciando agente de autenticação JWT do markdown...',
      'cart': '🛒 Gerando API REST para carrinho do markdown...',
      'payment': '💳 Configurando gateway de pagamento do markdown...'
    };

    const message = (messages as any)[actionId] || `Executando ação ${actionId} do markdown...`;
    alert(message);
  }

  getActionIcon(actionId: string): string {
    const icons = {
      'auth': '🔐',
      'cart': '🛒',
      'payment': '💳'
    };
    return (icons as any)[actionId] || '▶️';
  }

  getActionText(actionId: string): string {
    const texts = {
      'auth': 'Autenticação',
      'cart': 'Carrinho',
      'payment': 'Pagamento'
    };
    return (texts as any)[actionId] || actionId;
  }

  getActionDescription(actionId: string): string {
    const descriptions = {
      'auth': 'Executar agente de autenticação JWT',
      'cart': 'Gerar API REST para carrinho',
      'payment': 'Integrar gateway de pagamento'
    };
    return (descriptions as any)[actionId] || `Executar ação ${actionId}`;
  }

  switchView(view: 'clean' | 'agents' | 'full'): void {
    this.currentView = view;
    this.updateViewConfiguration();
  }

  getOpacity(elementType: string): number {
    if (this.currentView === 'clean') return 0;
    if (this.currentView === 'agents') {
      return elementType === 'agent' ? 0.9 : 0.3;
    }
    return 1.0;
  }

  getViewName(): string {
    const names = {
      'clean': 'Roteiro Limpo',
      'agents': 'Com Agentes',
      'full': 'Visão Completa'
    };
    return names[this.currentView];
  }

  toggleAutoReload(): void {
    this.autoReload = !this.autoReload;

    if (this.autoReload) {
      this.reloadInterval = setInterval(() => {
        this.loadMarkdown();
      }, 2000); // Reload every 2 seconds
    } else {
      if (this.reloadInterval) {
        clearInterval(this.reloadInterval);
      }
    }
  }

  showPopup(event: MouseEvent, text: string): void {
    this.popupX = event.clientX - 100;
    this.popupY = event.clientY - 50;
    this.popupText = text;
    this.popupVisible = true;
  }

  hidePopup(): void {
    this.popupVisible = false;
  }

  openModal(modalId: string, event: MouseEvent): void {
    // Encontrar o modal nos dados detectados
    const modalData = this.detectedModals.find(m => m.id === modalId);
    if (!modalData) return;

    // Verificar se já está aberto
    const existingModal = this.activeModals.find(m => m.id === modalId);
    if (existingModal) return;

    // Calcular posição próxima ao clique
    const newModal: ModalData = {
      ...modalData,
      position: {
        x: Math.min(event.clientX + 10, window.innerWidth - 420),
        y: Math.min(event.clientY + 10, window.innerHeight - 200)
      },
      visible: true
    };

    this.activeModals.push(newModal);
  }

  closeModal(modalId: string): void {
    this.activeModals = this.activeModals.filter(m => m.id !== modalId);
  }

  getModalTitle(modalId: string): string {
    const titles: { [key: string]: string } = {
      'auth-details': 'Detalhes da Autenticação',
      'auth-requirements': 'Requisitos de Autenticação',
      'auth-implementation': 'Implementação da Autenticação',
      'cart-details': 'Detalhes do Carrinho',
      'cart-features': 'Funcionalidades do Carrinho',
      'cart-apis': 'APIs do Carrinho',
      'payment-details': 'Detalhes do Pagamento',
      'payment-gateways': 'Gateways de Pagamento',
      'payment-flow': 'Fluxo de Pagamento',
      'payment-security': 'Segurança do Pagamento',
      'project-status': 'Status do Projeto'
    };
    return titles[modalId] || 'Detalhes';
  }

  getModalContent(modalId: string): string {
    const contents: { [key: string]: string } = {
      'auth-details': `
        <h3>🔐 Sistema de Autenticação</h3>
        <p>Sistema completo de autenticação JWT com:</p>
        <ul>
          <li><strong>JWT Tokens</strong> - Autenticação stateless</li>
          <li><strong>Refresh Tokens</strong> - Renovação automática</li>
          <li><strong>OAuth2</strong> - Integração com redes sociais</li>
          <li><strong>Guards Angular</strong> - Proteção de rotas</li>
        </ul>
        <p><strong>Status:</strong> ⚡ Em desenvolvimento</p>
      `,
      'auth-requirements': `
        <h3>📋 Requisitos Técnicos</h3>
        <ul>
          <li><code>Access Token</code>: 15 minutos</li>
          <li><code>Refresh Token</code>: 7 dias</li>
          <li><code>OAuth2</code>: Google, Facebook, GitHub</li>
          <li><code>Encryption</code>: RS256</li>
          <li><code>Storage</code>: HttpOnly cookies</li>
        </ul>
        <p><strong>Compliance:</strong> GDPR, LGPD</p>
      `,
      'cart-details': `
        <h3>🛒 Sistema de Carrinho</h3>
        <p>Carrinho de compras com persistência e sincronização:</p>
        <ul>
          <li><strong>LocalStorage</strong> - Persistência offline</li>
          <li><strong>API Sync</strong> - Sincronização quando logado</li>
          <li><strong>Real-time</strong> - Atualizações em tempo real</li>
          <li><strong>Cálculos</strong> - Totais, impostos, frete</li>
        </ul>
      `,
      'payment-details': `
        <h3>💳 Sistema de Pagamento</h3>
        <p>Gateway de pagamento seguro multi-provider:</p>
        <ul>
          <li><strong>Stripe</strong> - Cartões internacionais</li>
          <li><strong>PagSeguro</strong> - Mercado brasileiro</li>
          <li><strong>PIX</strong> - Pagamentos instantâneos</li>
          <li><strong>Webhook</strong> - Confirmações automáticas</li>
        </ul>
        <p><strong>Segurança:</strong> PCI DSS Level 1</p>
      `
    };
    return contents[modalId] || '<p>Conteúdo não encontrado</p>';
  }

  private createViewConfiguration(): ViewConfiguration {
    return {
      userId: 'current-user',
      documentId: this.documentId,
      mode: 'agents',
      visibleTypes: ['agent', 'requirement', 'code', 'test', 'note'],
      opacity: {
        agent: 0.9,
        requirement: 0.8,
        code: 0.8,
        test: 0.7,
        note: 0.6,
        modal: 1.0
      },
      showOnlyMyLayers: false,
      filters: {
        status: ['active', 'ready', 'approved'],
        priority: ['high', 'critical', 'medium'],
        tags: [],
        assignedTo: []
      }
    };
  }

  private updateViewConfiguration(): void {
    this.viewConfiguration = {
      ...this.viewConfiguration,
      mode: this.currentView,
      visibleTypes: this.getVisibleTypesForMode(this.currentView)
    };
  }

  private getVisibleTypesForMode(mode: string): OverlayLayer['type'][] {
    switch (mode) {
      case 'clean': return [];
      case 'agents': return ['agent', 'note'];
      case 'full': return ['agent', 'requirement', 'code', 'test', 'note'];
      default: return ['agent', 'requirement', 'code'];
    }
  }

  private async syncMarkdownWithDatabase(): Promise<void> {
    try {
      await this.layerDb.syncWithDisk('/screenplay.md');
      console.log('✅ Markdown synced with database');
    } catch (error) {
      console.error('❌ Error syncing markdown with database:', error);
    }
  }

  handleLayerAction(event: {action: string, layer: OverlayLayer, data?: any}): void {
    console.log('🎬 Layer action:', event);

    switch (event.action) {
      case 'execute-agent':
        this.executeAgentFromLayer(event.layer, event.data);
        break;
      case 'edit-agent':
        this.editAgentFromLayer(event.layer, event.data);
        break;
      case 'open-layer-details':
        this.openLayerDetailsModal(event.layer);
        break;
      case 'update-file':
        this.updateFileFromLayer(event.layer, event.data);
        break;
      default:
        console.log(`Unhandled layer action: ${event.action}`);
    }
  }

  private executeAgentFromLayer(layer: OverlayLayer, data: any): void {
    if (layer.type === 'agent') {
      const agentLayer = layer as any;
      const agentType = agentLayer.data.content.agentType;
      const prompt = agentLayer.data.content.prompt;

      console.log(`🤖 Executing agent: ${agentType}`);
      console.log(`📝 Prompt: ${prompt}`);

      // Update layer status to running
      this.layerDb.updateLayer(layer.id, {
        data: {
          ...layer.data,
          status: 'running'
        }
      });

      // Simulate agent execution
      setTimeout(() => {
        this.layerDb.updateLayer(layer.id, {
          data: {
            ...layer.data,
            status: 'completed'
          }
        });

        alert(`✅ Agente ${layer.data.title} executado com sucesso!`);
      }, 2000);
    }
  }

  private editAgentFromLayer(layer: OverlayLayer, data: any): void {
    console.log('✏️ Edit agent:', layer);
    alert(`Abrir editor para agente: ${layer.data.title}`);
  }

  private openLayerDetailsModal(layer: OverlayLayer): void {
    console.log('📋 Open layer details:', layer);

    const modalContent = this.generateLayerDetailsContent(layer);
    const newModal: ModalData = {
      id: `layer-details-${layer.id}`,
      title: `Detalhes: ${layer.data.title}`,
      content: modalContent,
      position: { x: layer.position.x + 50, y: layer.position.y + 50 },
      visible: true
    };

    const existingModal = this.activeModals.find(m => m.id === newModal.id);
    if (!existingModal) {
      this.activeModals.push(newModal);
    }
  }

  private updateFileFromLayer(layer: OverlayLayer, data: any): void {
    console.log('💾 Update file from layer:', layer, data);
    alert(`Arquivo será atualizado com base no layer: ${layer.data.title}`);
  }

  private generateLayerDetailsContent(layer: OverlayLayer): string {
    const statusIcon = this.getStatusIcon(layer.data.status);
    const priorityIcon = this.getPriorityIcon(layer.data.priority);

    let content = `
      <div class="layer-details">
        <div class="layer-meta">
          <p><strong>Tipo:</strong> ${this.getTypeDisplayName(layer.type)}</p>
          <p><strong>Status:</strong> ${statusIcon} ${layer.data.status}</p>
          <p><strong>Prioridade:</strong> ${priorityIcon} ${layer.data.priority}</p>
          <p><strong>Criado por:</strong> ${layer.metadata.createdBy}</p>
          <p><strong>Criado em:</strong> ${new Date(layer.metadata.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>

        <div class="layer-description">
          <h4>📝 Descrição</h4>
          <p>${layer.data.description}</p>
        </div>
    `;

    if (layer.type === 'agent') {
      const agentLayer = layer as any;
      content += `
        <div class="agent-specific">
          <h4>🤖 Configuração do Agente</h4>
          <p><strong>Tipo:</strong> ${agentLayer.data.content.agentType}</p>
          <p><strong>Prompt:</strong></p>
          <pre><code>${agentLayer.data.content.prompt}</code></pre>
        </div>
      `;
    }

    if (layer.metadata.tags.length > 0) {
      content += `
        <div class="layer-tags">
          <h4>🏷️ Tags</h4>
          <p>${layer.metadata.tags.join(', ')}</p>
        </div>
      `;
    }

    content += '</div>';
    return content;
  }

  private getTypeDisplayName(type: string): string {
    const names = {
      agent: '🤖 Agente',
      requirement: '📋 Requisito',
      code: '💻 Código',
      test: '🧪 Teste',
      note: '📝 Nota',
      modal: '🔗 Modal'
    };
    return (names as any)[type] || type;
  }

  private getStatusIcon(status: string): string {
    const icons = {
      ready: '⚡',
      running: '⏳',
      completed: '✅',
      error: '❌',
      draft: '📝',
      approved: '✅',
      implemented: '🚀',
      tested: '🧪'
    };
    return (icons as any)[status] || '❓';
  }

  private getPriorityIcon(priority: string): string {
    const icons = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };
    return (icons as any)[priority] || '❓';
  }

  // Quick popup methods
  showQuickPopup(event: MouseEvent, actionId: string): void {
    const popupData = this.getQuickPopupData(actionId);

    this.quickPopup = {
      visible: true,
      x: event.clientX + 15,
      y: event.clientY - 60,
      title: popupData.title,
      description: popupData.description,
      actionText: popupData.actionText,
      actionId: actionId
    };
  }

  hideQuickPopup(): void {
    console.log('👻 Hiding popup');
    this.quickPopup.visible = false;
  }

  executeQuickAction(actionId: string): void {
    console.log(`🚀 Quick action clicked: ${actionId}`);

    // Add visual feedback immediately
    const iconZone = document.querySelector(`.${actionId}-icon-1, .${actionId}-zone, .progress-zone`) as HTMLElement;
    if (iconZone) {
      iconZone.style.background = 'rgba(0, 255, 0, 0.3)';
      iconZone.style.transform = 'scale(1.5)';
      setTimeout(() => {
        iconZone.style.background = '';
        iconZone.style.transform = '';
      }, 300);
    }

    // Open modal instead of alert
    this.openIconModal(actionId);
    this.hideQuickPopup();
  }

  openIconModal(iconId: string): void {
    console.log(`🎭 Opening modal for: ${iconId}`);

    const modalData = this.getModalData(iconId);
    this.iconModal = {
      visible: true,
      iconId: iconId,
      title: modalData.title,
      content: modalData.content,
      type: modalData.type
    };
  }

  closeIconModal(): void {
    this.iconModal.visible = false;
  }

  executeModalAction(): void {
    console.log(`🚀 Executing modal action for: ${this.iconModal.iconId}`);

    // Simulate execution based on icon type
    const execMessages = {
      'auth': 'Executando agente de autenticação...\n\n✅ Gerando arquivos JWT\n✅ Criando middleware\n✅ Configurando rotas',
      'cart': 'Gerando APIs do carrinho...\n\n✅ Criando endpoints REST\n✅ Configurando banco de dados\n✅ Implementando validações',
      'payment': 'Configurando pagamentos...\n\n✅ Integrando Stripe\n✅ Configurando PagSeguro\n✅ Implementando PIX',
      'progress': 'Atualizando métricas...\n\n✅ Calculando progresso\n✅ Gerando relatórios\n✅ Sincronizando dados'
    };

    const message = (execMessages as any)[this.iconModal.iconId] || 'Executando ação...';
    alert(message);

    this.closeIconModal();
  }

  showIconPopup(event: MouseEvent, iconId: string): void {
    console.log(`🔍 Icon hover detected: ${iconId}`);
    const popupData = this.getIconPopupData(iconId);

    this.quickPopup = {
      visible: true,
      x: event.clientX + 10,
      y: event.clientY - 50,
      title: popupData.title,
      description: popupData.description,
      actionText: popupData.actionText,
      actionId: popupData.actionId
    };
  }


  private getQuickPopupData(actionId: string): any {
    const data = {
      'auth': {
        title: '🤖 Agente de Autenticação',
        description: 'Gerar sistema JWT completo com tokens e refresh',
        actionText: '▶️ Executar Agente'
      },
      'cart': {
        title: '🛒 Agente do Carrinho',
        description: 'Criar APIs REST para carrinho com persistência',
        actionText: '▶️ Gerar APIs'
      },
      'payment': {
        title: '💳 Agente de Pagamento',
        description: 'Integrar gateways Stripe, PagSeguro e PIX',
        actionText: '▶️ Configurar Pagamentos'
      }
    };
    return (data as any)[actionId] || { title: 'Ação', description: 'Descrição', actionText: 'Executar' };
  }

  private getIconPopupData(iconId: string): any {
    const data = {
      'auth-agent': {
        title: '🤖 Agente de Autenticação',
        description: 'IA especializada em gerar sistemas de autenticação JWT',
        actionText: '▶️ Executar',
        actionId: 'auth'
      },
      'auth-secure': {
        title: '🔐 Segurança JWT',
        description: 'Tokens seguros com expiração automática',
        actionText: '🔍 Ver Detalhes',
        actionId: 'auth'
      },
      'auth-ready': {
        title: '⚡ Pronto para Execução',
        description: 'Sistema configurado e pronto para gerar código',
        actionText: '🚀 Iniciar',
        actionId: 'auth'
      },
      'cart-agent': {
        title: '🛒 Agente do Carrinho',
        description: 'IA para gerar APIs REST de e-commerce',
        actionText: '▶️ Executar',
        actionId: 'cart'
      },
      'cart-sync': {
        title: '🔄 Sincronização',
        description: 'LocalStorage + Backend automático',
        actionText: '🔄 Configurar',
        actionId: 'cart'
      },
      'cart-wait': {
        title: '⏳ Aguardando Implementação',
        description: 'Dependências: JWT deve ser implementado primeiro',
        actionText: '📋 Ver Requisitos',
        actionId: 'cart'
      },
      'progress': {
        title: '🎯 Dashboard de Progresso',
        description: 'Visualizar métricas e status do projeto',
        actionText: '📊 Abrir Dashboard',
        actionId: 'progress'
      }
    };
    return (data as any)[iconId] || { title: 'Ícone', description: 'Descrição', actionText: 'Clique', actionId: 'default' };
  }

  private getModalData(iconId: string): any {
    const modalData = {
      'auth': {
        title: '🔐 Sistema de Autenticação JWT',
        type: 'agent',
        content: `
          <div class="modal-section">
            <h3>🤖 Agente de Código</h3>
            <p><strong>Tipo:</strong> Code Generator</p>
            <p><strong>Status:</strong> <span class="status ready">Pronto para execução</span></p>

            <h4>📋 Tarefas do Agente:</h4>
            <ul>
              <li>✅ Gerar middleware de autenticação JWT</li>
              <li>✅ Criar rotas protegidas</li>
              <li>✅ Implementar refresh tokens</li>
              <li>✅ Configurar expiração (15min)</li>
              <li>✅ Integrar com OAuth2</li>
            </ul>

            <h4>⚙️ Parâmetros:</h4>
            <div class="param-grid">
              <div class="param-item">
                <span class="param-key">Framework:</span>
                <span class="param-value">Express.js</span>
              </div>
              <div class="param-item">
                <span class="param-key">Database:</span>
                <span class="param-value">MongoDB</span>
              </div>
              <div class="param-item">
                <span class="param-key">Token Expiry:</span>
                <span class="param-value">15 minutos</span>
              </div>
              <div class="param-item">
                <span class="param-key">Refresh Token:</span>
                <span class="param-value">7 dias</span>
              </div>
            </div>

            <h4>🧪 Testes Incluídos:</h4>
            <ul>
              <li>Token generation e validation</li>
              <li>Middleware protection</li>
              <li>Refresh token flow</li>
              <li>OAuth2 integration</li>
            </ul>
          </div>
        `
      },
      'cart': {
        title: '🛒 API do Carrinho de Compras',
        type: 'agent',
        content: `
          <div class="modal-section">
            <h3>🤖 Agente de API</h3>
            <p><strong>Tipo:</strong> REST API Generator</p>
            <p><strong>Status:</strong> <span class="status waiting">Aguardando Auth</span></p>

            <h4>📋 Endpoints a Gerar:</h4>
            <ul>
              <li><span class="http-method post">POST</span> /api/cart/add</li>
              <li><span class="http-method get">GET</span> /api/cart</li>
              <li><span class="http-method put">PUT</span> /api/cart/update</li>
              <li><span class="http-method delete">DELETE</span> /api/cart/remove</li>
            </ul>

            <h4>💾 Persistência:</h4>
            <ul>
              <li>🗄️ LocalStorage para usuários anônimos</li>
              <li>🔄 Sincronização automática ao login</li>
              <li>☁️ Backup em MongoDB</li>
              <li>⚡ Cache em Redis</li>
            </ul>

            <h4>🔗 Dependências:</h4>
            <div class="dependency-item blocked">
              <span class="dep-icon">🔐</span>
              <span class="dep-text">Sistema de Autenticação JWT</span>
              <span class="dep-status">Pendente</span>
            </div>
          </div>
        `
      },
      'payment': {
        title: '💳 Gateways de Pagamento',
        type: 'integration',
        content: `
          <div class="modal-section">
            <h3>💰 Integrações de Pagamento</h3>

            <h4>🌍 Gateways Suportados:</h4>
            <div class="gateway-grid">
              <div class="gateway-item">
                <span class="gateway-icon">💳</span>
                <span class="gateway-name">Stripe</span>
                <span class="gateway-region">Internacional</span>
              </div>
              <div class="gateway-item">
                <span class="gateway-icon">🇧🇷</span>
                <span class="gateway-name">PagSeguro</span>
                <span class="gateway-region">Brasil</span>
              </div>
              <div class="gateway-item">
                <span class="gateway-icon">⚡</span>
                <span class="gateway-name">PIX</span>
                <span class="gateway-region">Instantâneo</span>
              </div>
            </div>

            <h4>🔒 Segurança:</h4>
            <ul>
              <li>🔐 Tokenização de cartão</li>
              <li>🛡️ Compliance PCI DSS</li>
              <li>🔒 Criptografia end-to-end</li>
              <li>📊 Logs de auditoria</li>
            </ul>

            <h4>⚠️ Alertas Críticos:</h4>
            <div class="alert critical">
              <span class="alert-icon">🚨</span>
              <span class="alert-text">Implementar tokenização antes do deploy</span>
            </div>
          </div>
        `
      },
      'progress': {
        title: '📊 Dashboard de Progresso',
        type: 'analytics',
        content: `
          <div class="modal-section">
            <h3>📈 Métricas do Projeto</h3>

            <div class="metrics-grid">
              <div class="metric-card">
                <span class="metric-icon">🤖</span>
                <span class="metric-value">3</span>
                <span class="metric-label">Agentes Ativos</span>
              </div>
              <div class="metric-card">
                <span class="metric-icon">📋</span>
                <span class="metric-value">5</span>
                <span class="metric-label">Requisitos</span>
              </div>
              <div class="metric-card">
                <span class="metric-icon">💻</span>
                <span class="metric-value">1.2k</span>
                <span class="metric-label">Linhas</span>
              </div>
              <div class="metric-card">
                <span class="metric-icon">🧪</span>
                <span class="metric-value">95%</span>
                <span class="metric-label">Coverage</span>
              </div>
            </div>

            <h4>🎯 Progresso por Fase:</h4>
            <div class="progress-bars">
              <div class="progress-item">
                <span class="progress-label">Autenticação</span>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 85%"></div>
                </div>
                <span class="progress-percent">85%</span>
              </div>
              <div class="progress-item">
                <span class="progress-label">Carrinho</span>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 20%"></div>
                </div>
                <span class="progress-percent">20%</span>
              </div>
              <div class="progress-item">
                <span class="progress-label">Pagamento</span>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 0%"></div>
                </div>
                <span class="progress-percent">0%</span>
              </div>
            </div>
          </div>
        `
      }
    };

    return (modalData as any)[iconId] || {
      title: 'Modal Detalhada',
      type: 'info',
      content: `<p>Conteúdo detalhado para ${iconId}</p>`
    };
  }


  // Drag & Drop methods
  onMouseDown(event: MouseEvent, circleId: string): void {
    event.preventDefault();
    event.stopPropagation();

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.dragState = {
      isDragging: true,
      currentCircle: circleId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };

    console.log(`🎯 Iniciando drag de ${circleId}`);
    document.body.style.cursor = 'grabbing';
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.dragState.isDragging || !this.dragState.currentCircle) return;

    event.preventDefault();
    const container = document.querySelector('.screenplay-canvas');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Calcular nova posição relativa ao container
    const newX = event.clientX - containerRect.left - this.dragState.offsetX;
    const newY = event.clientY - containerRect.top - this.dragState.offsetY;

    // Atualizar posição
    this.circlePositions[this.dragState.currentCircle] = {
      x: Math.max(0, Math.min(newX, containerRect.width - 40)),
      y: Math.max(0, Math.min(newY, containerRect.height - 40))
    };
  }

  onMouseUp(event: MouseEvent): void {
    if (!this.dragState.isDragging) return;

    console.log(`✅ Finalizando drag de ${this.dragState.currentCircle}`,
                `Nova posição:`, this.circlePositions[this.dragState.currentCircle]);

    // Salvar posições no localStorage
    this.saveCirclePositions();

    // Reset drag state
    this.dragState = {
      isDragging: false,
      currentCircle: '',
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0
    };

    document.body.style.cursor = 'default';
  }

  loadCirclePositions(): void {
    const saved = localStorage.getItem('screenplay-circle-positions');
    if (saved) {
      try {
        this.circlePositions = { ...this.circlePositions, ...JSON.parse(saved) };
        console.log('🔄 Posições carregadas do localStorage');
      } catch (e) {
        console.warn('❌ Erro ao carregar posições salvas');
      }
    }
  }

  saveCirclePositions(): void {
    localStorage.setItem('screenplay-circle-positions', JSON.stringify(this.circlePositions));
    console.log('💾 Posições salvas no localStorage');
  }

  resetCirclePositions(): void {
    this.circlePositions = {
      'auth-1': { x: 760, y: 195 },
      'auth-2': { x: 790, y: 195 },
      'auth-3': { x: 820, y: 195 },
      'cart-1': { x: 680, y: 435 },
      'cart-2': { x: 710, y: 435 },
      'cart-3': { x: 740, y: 435 },
      'progress': { x: 142, y: 1730 }
    };
    this.saveCirclePositions();
    console.log('🔄 Posições resetadas para padrão');
  }



  ngOnDestroy(): void {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }
  }
}