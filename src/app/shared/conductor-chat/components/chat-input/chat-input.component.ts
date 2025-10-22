import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
          <textarea
            #messageInput
            [(ngModel)]="message"
            (keydown)="onKeyDown($event)"
            (input)="adjustTextareaHeight()"
            placeholder="Digite ou fale sua mensagem... (Shift+Enter para nova linha)"
            [disabled]="isLoading"
            autocomplete="off"
            rows="1"
          ></textarea>
          <div class="button-group">
            <button
              class="icon-button mic-button"
              [class.recording]="isRecording"
              (click)="toggleRecording()"
              [disabled]="isLoading || !speechSupported"
              [title]="getMicTitle()"
            >
              {{ isRecording ? '🔴' : '🎤' }}
            </button>
            <button
              class="icon-button send-button"
              (click)="sendMessage()"
              [disabled]="isLoading || !message.trim()"
              [title]="isLoading ? 'Enviando...' : 'Enviar mensagem'"
            >
              <span *ngIf="!isLoading">▶️</span>
              <span *ngIf="isLoading">⏳</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-input-wrapper {
      border-top: 1px solid #e1e4e8;
      background: white;
    }

    .mode-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #fafbfc;
      border-bottom: 1px solid #e1e4e8;
    }

    .mode-selector label {
      font-weight: 600;
      font-size: 14px;
      color: #4a5568;
    }

    .mode-selector select {
      padding: 6px 12px;
      border: 1px solid #cbd5e0;
      border-radius: 6px;
      font-size: 14px;
      background: white;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s;
    }

    .mode-selector select:hover:not(:disabled) {
      border-color: #a8b9ff;
    }

    .mode-selector select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .mode-info {
      font-size: 13px;
      color: #6b7280;
      font-weight: 500;
    }

    .chat-input-container {
      padding: 16px;
    }

    .input-group {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }

    .input-group textarea {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e1e4e8;
      border-radius: 12px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      outline: none;
      transition: border-color 0.2s;
      resize: none;
      min-height: 44px;
      max-height: 200px;
      overflow-y: auto;
    }

    .input-group textarea:focus {
      border-color: #a8b9ff;
    }

    .input-group textarea:disabled {
      background: #f7fafc;
      cursor: not-allowed;
    }

    .button-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-self: flex-end;
      margin-left: 4px;
    }

    .icon-button {
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: 50%;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .mic-button {
      background: #f0f0f0;
      color: #333;
    }

    .mic-button:hover:not(:disabled) {
      background: #e0e0e0;
      transform: scale(1.1);
    }

    .mic-button.recording {
      background: #ff4444;
      color: white;
      animation: pulse 1s infinite;
    }

    .send-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .send-button:hover:not(:disabled) {
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    }

    .icon-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }
  `]
})
export class ChatInputComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() isLoading: boolean = false;
  @Input() mode: ChatMode = 'ask';
  @Output() messageSent = new EventEmitter<string>();
  @Output() modeChanged = new EventEmitter<ChatMode>();

  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;

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

  ngAfterViewInit(): void {
    // Initial height adjustment
    setTimeout(() => {
      this.adjustTextareaHeight();
    }, 0);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  sendMessage(): void {
    if (this.message.trim() && !this.isLoading) {
      this.messageSent.emit(this.message.trim());
      this.message = '';
      // Reset textarea height after sending
      setTimeout(() => {
        this.adjustTextareaHeight();
      }, 0);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    // Enter without Shift = send message
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
    // Shift+Enter = new line (default behavior, no preventDefault needed)
  }

  adjustTextareaHeight(): void {
    if (!this.messageInput) return;

    const textarea = this.messageInput.nativeElement;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Set new height based on content, with min and max constraints
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 44), 200);
    textarea.style.height = `${newHeight}px`;
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
