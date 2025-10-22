import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status" [title]="getStatusText()">
      <span
        class="status-indicator"
        [class.connected]="isConnected && !isLoading"
        [class.loading]="isLoading"
        [class.disconnected]="!isConnected && !isLoading"
      ></span>
    </div>
  `,
  styles: [`
    .status {
      display: flex;
      align-items: center;
      cursor: help;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    .status:hover .status-indicator {
      transform: scale(1.3);
    }

    .status-indicator.connected {
      background-color: #4caf50;
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
    }

    .status-indicator.loading {
      background-color: #ff9800;
      box-shadow: 0 0 8px rgba(255, 152, 0, 0.6);
      animation: pulse 1s infinite;
    }

    .status-indicator.disconnected {
      background-color: #f44336;
      box-shadow: 0 0 8px rgba(244, 67, 54, 0.6);
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `]
})
export class StatusIndicatorComponent {
  @Input() isConnected: boolean = false;
  @Input() isLoading: boolean = false;

  getStatusText(): string {
    if (this.isLoading) return 'Enviando...';
    if (this.isConnected) return 'Conectado';
    return 'Desconectado';
  }
}
