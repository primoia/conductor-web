import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SpeechRecognitionService } from '../../services/speech-recognition.service';
import { ChatMode } from '../../models/chat.models';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-input-wrapper">
      <!-- Mode selector -->
      <div class="mode-selector">
        <label for="chatMode">Modo:</label>
        <select
          id="chatMode"
          [(ngModel)]="selectedMode"
          (ngModelChange)="onModeChange($event)"
          [disabled]="isLoading"
        >
          <option value="ask">Ask - Apenas perguntas</option>
          <option value="agent">Agent - Pode modificar screenplay</option>
        </select>
        <span class="mode-info">
          {{ selectedMode === 'ask' ? '💬 Modo consulta' : '🤖 Modo agente' }}
        </span>
      </div>

      <!-- Input group -->
      <div class="chat-input-container">
        <div class="input-group">
          <input
            type="text"
            [(ngModel)]="message"
            (keypress)="onKeyPress($event)"
            placeholder="Digite ou fale sua mensagem..."
            [disabled]="isLoading"
            autocomplete="off"
          />
          <button
            class="mic-button"
            [class.recording]="isRecording"
            (click)="toggleRecording()"
            [disabled]="isLoading || !speechSupported"
            [title]="getMicTitle()"
          >
            {{ isRecording ? '🔴' : '🎤' }}
          </button>
          <button
            class="send-button"
            (click)="sendMessage()"
            [disabled]="isLoading || !message.trim()"
          >
            <span *ngIf="!isLoading">Enviar</span>
            <span *ngIf="isLoading" class="spinner">⏳</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-input-wrapper {
      border-top: 1px solid #e0e0e0;
      background: white;
    }

    .mode-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }

    .mode-selector label {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }

    .mode-selector select {
      padding: 6px 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
      background: white;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s;
    }

    .mode-selector select:hover:not(:disabled) {
      border-color: #667eea;
    }

    .mode-selector select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .mode-info {
      font-size: 13px;
      color: #666;
      font-weight: 500;
    }

    .chat-input-container {
      padding: 16px;
    }

    .input-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .input-group input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 24px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .input-group input:focus {
      border-color: #667eea;
    }

    .input-group input:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }

    .mic-button,
    .send-button {
      padding: 10px 16px;
      border: none;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;
    }

    .mic-button {
      background: #f0f0f0;
      color: #333;
      min-width: 44px;
    }

    .mic-button:hover:not(:disabled) {
      background: #e0e0e0;
      transform: scale(1.05);
    }

    .mic-button.recording {
      background: #ff4444;
      color: white;
      animation: pulse 1s infinite;
    }

    .send-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-width: 80px;
    }

    .send-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .mic-button:disabled,
    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .spinner {
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `]
})
export class ChatInputComponent implements OnInit, OnDestroy {
  @Input() isLoading: boolean = false;
  @Input() mode: ChatMode = 'ask';
  @Output() messageSent = new EventEmitter<string>();
  @Output() modeChanged = new EventEmitter<ChatMode>();

  message: string = '';
  selectedMode: ChatMode = 'ask';
  isRecording: boolean = false;
  speechSupported: boolean = false;

  private subscriptions = new Subscription();

  constructor(private speechService: SpeechRecognitionService) {}

  ngOnInit(): void {
    this.selectedMode = this.mode;
    this.speechSupported = this.speechService.isSupported;

    // Subscribe to recording state
    this.subscriptions.add(
      this.speechService.isRecording$.subscribe(recording => {
        this.isRecording = recording;
      })
    );

    // Subscribe to transcript
    this.subscriptions.add(
      this.speechService.transcript$.subscribe(transcript => {
        if (transcript) {
          this.message = transcript;
          this.speechService.clearTranscript();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  sendMessage(): void {
    if (this.message.trim() && !this.isLoading) {
      this.messageSent.emit(this.message.trim());
      this.message = '';
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  toggleRecording(): void {
    this.speechService.toggleRecording();
  }

  onModeChange(mode: ChatMode): void {
    this.modeChanged.emit(mode);
  }

  getMicTitle(): string {
    if (!this.speechSupported) {
      return 'Reconhecimento de voz não suportado';
    }
    return this.isRecording
      ? 'Gravando... Clique para parar'
      : 'Clique para falar';
  }
}
