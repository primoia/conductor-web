import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AgentGameComponent } from '../agent-game/agent-game.component';

@Component({
  selector: 'app-agent-game-fullscreen',
  standalone: true,
  imports: [CommonModule, RouterModule, AgentGameComponent],
  template: `
    <div class="fullscreen-container">
      <div class="fullscreen-header">
        <a routerLink="/screenplay" class="back-link">
          ← Voltar ao Roteiro
        </a>
        <h1>🎮 Agentes Instanciados</h1>
      </div>
      <div class="fullscreen-content">
        <app-agent-game></app-agent-game>
      </div>
    </div>
  `,
  styles: [`
    .fullscreen-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      background: #f8f9fa;
    }

    .fullscreen-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      flex-shrink: 0;
    }

    .fullscreen-header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .back-link {
      color: white;
      text-decoration: none;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      font-size: 13px;
      transition: background 0.2s;
    }

    .back-link:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .fullscreen-content {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .fullscreen-content ::ng-deep app-agent-game {
      display: block;
      height: 100%;
    }

    .fullscreen-content ::ng-deep .agent-game-container {
      height: 100%;
    }
  `]
})
export class AgentGameFullscreenComponent implements AfterViewInit {
  ngAfterViewInit(): void {
    // Trigger resize event after component is fully rendered
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);

    // Second resize after longer delay to ensure full rendering
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 500);
  }
}
