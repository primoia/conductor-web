import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status">
      <span
        class="status-indicator"
        [class.connected]="isConnected && !isLoading"
        [class.loading]="isLoading"
        [class.disconnected]="!isConnected && !isLoading"
      ></span>
      <span class="status-text">{{ getStatusText() }}</span>
    </div>
  `,
  styles: [`
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      transition: background-color 0.3s ease;
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

    .status-text {
      color: #4a5568;
      font-weight: 500;
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
