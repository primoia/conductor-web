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
      <!-- Input group com borda azul única -->
      <div class="chat-input-container">
        <div class="input-group-border">
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
          <!-- Linha inferior: Provider + Botões -->
          <div class="controls-row">
            <select
              id="provider-select"
              [(ngModel)]="selectedProvider"
              class="provider-dropdown"
              [disabled]="isLoading"
              title="Selecione o AI Provider para esta mensagem"
            >
              <option value="">Padrão</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="cursor-agent">Cursor Agent</option>
            </select>
            <!-- Send button -->
            <button
              class="icon-button send-button"
              (click)="sendMessage()"
              [disabled]="isLoading || !message.trim()"
              [title]="isLoading ? 'Enviando...' : 'Enviar mensagem'"
            >
              <span *ngIf="!isLoading">⬆️</span>
              <span *ngIf="isLoading">⏳</span>
            </button>
            <!-- Mic button -->
            <button
              class="icon-button mic-button"
              [class.recording]="isRecording"
              (click)="toggleRecording()"
              [disabled]="isLoading || !speechSupported"
              [title]="getMicTitle()"
            >
              {{ isRecording ? '🔴' : '🎤' }}
            </button>
            <!-- Mode toggle switch -->
            <button
              class="icon-button mode-toggle"
              [class.agent-mode]="selectedMode === 'agent'"
              (click)="toggleMode()"
              [disabled]="isLoading"
              [title]="selectedMode === 'ask' ? 'Modo Ask (consulta)' : 'Modo Agent (modificar)'"
            >
              {{ selectedMode === 'ask' ? '💬' : '🤖' }}
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

    .chat-input-container {
      padding: 12px 16px;
    }

    /* Div com borda azul única ao redor de tudo */
    .input-group-border {
      border: 2px solid #e1e4e8;
      border-radius: 12px;
      padding: 12px;
      transition: border-color 0.2s;
      background: white;
    }

    /* Borda azul fica visível quando textarea está em foco */
    .input-group-border:focus-within {
      border-color: #a8b9ff;
    }

    /* Textarea sem borda própria */
    .input-group-border textarea {
      width: 100%;
      padding: 8px;
      border: none;
      outline: none;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      resize: none;
      min-height: 144px;
      max-height: 200px;
      overflow-y: auto;
      background: transparent;
    }

    .input-group-border textarea:disabled {
      background: #f7fafc;
      cursor: not-allowed;
      opacity: 0.7;
    }

    /* Linha inferior: Provider + Botões (horizontal) */
    .controls-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
    }

    /* Provider dropdown - sem borda externa */
    .provider-dropdown {
      flex: 1;
      padding: 8px 12px;
      border: none;
      background-color: #f7fafc;
      color: #2d3748;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      outline: none;
      min-width: 100px;
    }

    .provider-dropdown:hover:not(:disabled) {
      background-color: #e2e8f0;
    }

    .provider-dropdown:focus {
      background-color: #e2e8f0;
    }

    .provider-dropdown:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .provider-dropdown option {
      padding: 8px;
      background: white;
      color: #2d3748;
    }

    /* Botões em linha horizontal */
    .icon-button {
      width: 36px;
      height: 36px;
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

    .mode-toggle {
      background: #e3f2fd;
      color: #1976d2;
      border: 1px solid #bbdefb;
    }

    .mode-toggle:hover:not(:disabled) {
      background: #bbdefb;
      border-color: #90caf9;
      transform: scale(1.1);
    }

    .mode-toggle.agent-mode {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: 1px solid #5a67d8;
    }

    .mode-toggle.agent-mode:hover:not(:disabled) {
      background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
      transform: scale(1.1);
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
      background: #ffffff;
      color: #667eea;
      border: 2px solid #667eea;
    }

    .send-button:hover:not(:disabled) {
      background: #f0f4ff;
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
  @Output() messageSent = new EventEmitter<{message: string, provider?: string}>();
  @Output() modeChanged = new EventEmitter<ChatMode>();

  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;

  message: string = '';
  selectedMode: ChatMode = 'ask';
  selectedProvider: string = ''; // '' = usar provider padrão do config.yaml
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
      console.log('🤖 Provider selecionado:', this.selectedProvider || 'Padrão (config.yaml)');
      // Emite objeto com mensagem e provider (se selecionado)
      this.messageSent.emit({
        message: this.message.trim(),
        provider: this.selectedProvider || undefined // undefined se vazio
      });
      this.message = '';
      // Nota: NÃO limpar selectedProvider - manter seleção para próxima mensagem
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
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 144), 200);
    textarea.style.height = `${newHeight}px`;
  }

  toggleRecording(): void {
    this.speechService.toggleRecording();
  }

  toggleMode(): void {
    this.selectedMode = this.selectedMode === 'ask' ? 'agent' : 'ask';
    this.modeChanged.emit(this.selectedMode);
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
