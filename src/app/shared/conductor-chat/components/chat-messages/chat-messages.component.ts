import { Component, Input, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Message } from '../../models/chat.models';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chat-messages" #messagesContainer>
      <div
        *ngFor="let message of messages"
        class="message"
        [class.user-message]="message.type === 'user'"
        [class.bot-message]="message.type === 'bot'"
        [class.system-message]="message.type === 'system'"
      >
        <div class="message-content">
          <strong *ngIf="message.type !== 'system'">{{ message.type === 'user' ? 'Você:' : 'Conductor:' }}</strong>
          <span
            *ngIf="shouldFormatAsHtml(message.content)"
            [innerHTML]="formatMessage(message.content)"
          ></span>
          <span *ngIf="!shouldFormatAsHtml(message.content)">
            {{ message.content }}
          </span>
        </div>
      </div>

      <!-- Progress message -->
      <div
        *ngIf="progressMessage"
        class="message bot-message progress-message"
      >
        <div class="message-content">
          <em>{{ progressMessage.content }}</em>
        </div>
      </div>

      <!-- Streaming message -->
      <div
        *ngIf="streamingMessage"
        class="message bot-message"
      >
        <div class="message-content">
          <strong>Conductor:</strong> {{ streamingMessage.content }}
        </div>
      </div>

      <!-- Typing indicator -->
      <div
        *ngIf="isLoading && !progressMessage"
        class="message bot-message"
      >
        <div class="message-content">
          <strong>Conductor:</strong>
          <span class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #fafbfc;
    }

    .message {
      padding: 12px 16px;
      border-radius: 8px;
      max-width: 85%;
      word-wrap: break-word;
      animation: fadeIn 0.3s ease;
      font-size: 13px;
    }

    .user-message {
      background: linear-gradient(135deg, #7c9ff6 0%, #9f7aea 100%);
      color: white;
      align-self: flex-end;
      margin-left: auto;
    }

    .bot-message {
      background: white;
      color: #2c3e50;
      align-self: flex-start;
      border: 1px solid #e1e4e8;
    }

    .system-message {
      background: #f0f3f7;
      color: #6b7280;
      align-self: center;
      border: 1px dashed #cbd5e0;
      font-size: 13px;
      text-align: center;
      max-width: 70%;
    }

    .system-message .message-content {
      font-style: italic;
    }

    .progress-message {
      font-style: italic;
      background: #fef3c7;
      border: 1px dashed #fbbf24;
    }

    .message-content {
      line-height: 1.5;
    }

    .message-content strong {
      display: block;
      margin-bottom: 4px;
      font-weight: 600;
    }

    .typing-indicator {
      display: inline-flex;
      gap: 4px;
      margin-left: 8px;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: #7c9ff6;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-10px);
      }
    }

    /* Scrollbar styling */
    .chat-messages::-webkit-scrollbar {
      width: 8px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: #f0f3f7;
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }
  `]
})
export class ChatMessagesComponent implements AfterViewChecked {
  @Input() messages: Message[] = [];
  @Input() isLoading: boolean = false;
  @Input() progressMessage: Message | null = null;
  @Input() streamingMessage: Message | null = null;
  @Input() autoScroll: boolean = true;

  @ViewChild('messagesContainer') messagesContainer?: ElementRef;

  private shouldScrollToBottom = false;

  constructor(private sanitizer: DomSanitizer) {}

  ngAfterViewChecked(): void {
    if (this.autoScroll && this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnChanges(): void {
    this.shouldScrollToBottom = true;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  shouldFormatAsHtml(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }
    return content.includes('<ul>') ||
           content.includes('<li>') ||
           content.includes('<code>') ||
           content.includes('<strong>') ||
           content.includes('<em>');
  }

  formatMessage(content: string): SafeHtml {
    return this.sanitizer.sanitize(1, content) || content;
  }
}
