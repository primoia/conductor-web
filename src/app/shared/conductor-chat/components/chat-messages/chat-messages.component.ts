import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Message } from '../../models/chat.models';
import { marked } from 'marked';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-messages" #messagesContainer>
      <div
        *ngFor="let message of messages"
        class="message"
        [class.user-message]="message.type === 'user'"
        [class.bot-message]="message.type === 'bot'"
        [class.system-message]="message.type === 'system'"
        [class.disabled]="message.isDeleted"
      >
        <!-- User and System Messages -->
        <div *ngIf="message.type !== 'bot'" class="message-content">
          <strong *ngIf="message.type !== 'system'">Você:</strong>
          <span>{{ message.content }}</span>
        </div>

        <!-- Bot Messages with Markdown and Copy Button -->
        <div *ngIf="message.type === 'bot'" class="message-content bot-content-wrapper">
          <div class="message-actions">
            <label
              class="toggle-btn"
              *ngIf="message.id"
              [title]="message.isDeleted ? 'Habilitar iteração no prompt' : 'Desabilitar iteração no prompt'">
              <input
                type="checkbox"
                [checked]="!message.isDeleted"
                (change)="toggleMessage(message)"
              />
              <span class="toggle-slider"></span>
            </label>
            <button class="copy-btn" (click)="copyToClipboard(message)" title="Copiar mensagem">
              <span *ngIf="copiedMessageId !== message.id">📋</span>
              <span *ngIf="copiedMessageId === message.id">✅</span>
            </button>
            <button
              class="hide-btn"
              *ngIf="message.id"
              (click)="hideMessage(message)"
              title="Ocultar permanentemente (não aparece mais no chat)">
              🗑️
            </button>
          </div>
          <strong>Conductor:</strong>
          <div class="markdown-content" [innerHTML]="formatMessage(message.content)"></div>
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
          <strong>Conductor:</strong>
          <div class="markdown-content" [innerHTML]="formatMessage(streamingMessage.content)"></div>
        </div>
      </div>

      <!-- Typing indicator -->
      <div
        *ngIf="isLoading && !progressMessage && !streamingMessage"
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
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #fafbfc;
    }

    .message {
      padding: 10px 12px;
      border-radius: 8px;
      max-width: 95%;
      word-wrap: break-word;
      animation: fadeIn 0.3s ease;
      font-size: 13px;
      position: relative; /* For copy button positioning */
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

    .bot-message:hover .message-actions {
      opacity: 1;
    }

    /* Disabled state (isDeleted = true) - subtle styling */
    .bot-message.disabled {
      opacity: 0.65;
      border-left: 3px solid #e5e7eb;
    }

    .user-message.disabled {
      opacity: 0.65;
    }

    .message.disabled .markdown-content {
      color: #6b7280;
    }

    .system-message {
      background: #f0f3f7;
      color: #6b7280;
      align-self: center;
      border: 1px dashed #cbd5e0;
      font-size: 13px;
      text-align: center;
      max-width: 90%;
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

    .message-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      opacity: 1;
      transition: opacity 0.2s ease;
      z-index: 10;
    }

    .copy-btn {
      background: #f0f3f7;
      border: 1px solid #e1e4e8;
      color: #6b7280;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .copy-btn:hover {
      background: #e1e4e8;
      transform: scale(1.1);
    }

    .hide-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 14px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      opacity: 0.5;
    }

    .hide-btn:hover {
      color: #ef4444;
      opacity: 1;
      transform: scale(1.1);
    }

    /* Toggle switch styles */
    .toggle-btn {
      position: relative;
      display: inline-block;
      width: 32px;
      height: 18px;
      cursor: pointer;
    }

    .toggle-btn input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #cbd5e0;
      transition: 0.3s;
      border-radius: 18px;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 12px;
      width: 12px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.3s;
      border-radius: 50%;
    }

    .toggle-btn input:checked + .toggle-slider {
      background-color: #10b981;
    }

    .toggle-btn input:checked + .toggle-slider:before {
      transform: translateX(14px);
    }

    .toggle-btn:hover .toggle-slider {
      box-shadow: 0 0 4px rgba(0,0,0,0.2);
    }

    .markdown-content ::ng-deep pre {
      background-color: #f3f4f6;
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
    }

    .markdown-content ::ng-deep code {
      background-color: #f3f4f6;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
    }

    .markdown-content ::ng-deep p {
      margin-top: 0;
      margin-bottom: 8px;
    }

    .markdown-content ::ng-deep ul, .markdown-content ::ng-deep ol {
      padding-left: 20px;
      margin-bottom: 8px;
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
export class ChatMessagesComponent implements AfterViewChecked, OnChanges {
  @Input() messages: Message[] = [];
  @Input() isLoading: boolean = false;
  @Input() progressMessage: Message | null = null;
  @Input() streamingMessage: Message | null = null;
  @Input() autoScroll: boolean = true;

  @Output() messageToggled = new EventEmitter<Message>();
  @Output() messageHidden = new EventEmitter<Message>();

  @ViewChild('messagesContainer') messagesContainer?: ElementRef;

  private shouldScrollToBottom = false;
  private previousMessageCount = 0;
  private previousStreamingContent = '';
  copiedMessageId: string | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngAfterViewChecked(): void {
    if (this.autoScroll && this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only scroll to bottom when:
    // 1. New messages are added (count increased)
    // 2. Streaming message content changed
    // 3. Loading started (typing indicator)
    // Do NOT scroll when user toggles/hides messages

    if (changes['messages']) {
      const newCount = this.messages?.length || 0;
      if (newCount > this.previousMessageCount) {
        // New message added - scroll to bottom
        this.shouldScrollToBottom = true;
      }
      this.previousMessageCount = newCount;
    }

    if (changes['streamingMessage']) {
      const newContent = this.streamingMessage?.content || '';
      if (newContent !== this.previousStreamingContent) {
        // Streaming content changed - scroll to bottom
        this.shouldScrollToBottom = true;
      }
      this.previousStreamingContent = newContent;
    }

    if (changes['isLoading'] && this.isLoading) {
      // Loading started - scroll to show typing indicator
      this.shouldScrollToBottom = true;
    }

    if (changes['progressMessage'] && this.progressMessage) {
      // Progress message appeared - scroll to show it
      this.shouldScrollToBottom = true;
    }
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  formatMessage(content: string): SafeHtml {
    if (!content || typeof content !== 'string') {
      return '';
    }
    // Use marked to parse markdown content
    const rawHtml = marked(content) as string;
    // Sanitize the HTML before rendering
    return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }

  copyToClipboard(message: Message): void {
    if (!message || !message.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      this.copiedMessageId = message.id;
      setTimeout(() => {
        this.copiedMessageId = null;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  /**
   * Toggle message enabled/disabled state.
   * When disabled (isDeleted=true), message won't be included in prompt.
   */
  toggleMessage(message: Message): void {
    if (!message || !message.id) {
      console.warn('Cannot toggle message without id');
      return;
    }
    this.messageToggled.emit(message);
  }

  /**
   * Hide message permanently.
   * When hidden (isHidden=true), message won't appear in chat or prompt.
   * Only reversible via MongoDB directly.
   */
  hideMessage(message: Message): void {
    if (!message || !message.id) {
      console.warn('Cannot hide message without id');
      return;
    }
    // Confirmation before hiding
    if (confirm('Ocultar esta iteração permanentemente?\n\nEsta ação só pode ser desfeita via banco de dados.')) {
      this.messageHidden.emit(message);
    }
  }
}
