import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewChecked, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Message } from '../../models/chat.models';
import { marked } from 'marked';
import { ToolCallTimelineComponent } from '../tool-call-timeline/tool-call-timeline.component';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolCallTimelineComponent],
  template: `
    <div class="chat-messages" #messagesContainer>
      <div
        *ngFor="let message of messages"
        class="message"
        [class.user-message]="message.type === 'user'"
        [class.bot-message]="message.type === 'bot'"
        [class.system-message]="message.type === 'system'"
        [class.delegation-message]="message.type === 'delegation'"
        [class.progress-message]="message.status === 'pending'"
        [class.disabled]="message.isDeleted"
      >
        <!-- Delegation Messages (agent chain handoff) -->
        <div *ngIf="message.type === 'delegation'" class="message-content">
          <div class="markdown-content" [innerHTML]="formatMessage(message.content)"></div>
        </div>

        <!-- User and System Messages -->
        <div *ngIf="message.type !== 'bot' && message.type !== 'delegation'" class="message-content">
          <strong *ngIf="message.type !== 'system'">Você:</strong>
          <span>{{ message.content }}</span>
        </div>

        <!-- Bot Messages: pending (yellow placeholder) -->
        <div *ngIf="message.type === 'bot' && message.status === 'pending'" class="message-content">
          <em>Aguardando processamento...</em>
        </div>

        <!-- Bot Messages: completed/normal (with Markdown and Copy Button) -->
        <div *ngIf="message.type === 'bot' && message.status !== 'pending'" class="message-content bot-content-wrapper" (dblclick)="onReadMode(message)">
          <div class="message-actions">
            <button class="msg-gear-btn" (click)="toggleMessageMenu(message.id, $event)">⚙️</button>
            <div class="msg-menu" *ngIf="activeMenuMessageId === message.id">
              <div class="msg-menu-backdrop" (click)="activeMenuMessageId = null"></div>
              <div class="msg-menu-list">
                <button class="msg-menu-item" (click)="activeMenuMessageId = null; copyToClipboard(message)">
                  {{ copiedMessageId === message.id ? '✅' : '📋' }} Copiar
                </button>
                <button class="msg-menu-item" *ngIf="message.id" (click)="activeMenuMessageId = null; toggleMessage(message)">
                  {{ message.isDeleted ? '🔘' : '✅' }} {{ message.isDeleted ? 'Habilitar no prompt' : 'Desabilitar no prompt' }}
                </button>
                <button class="msg-menu-item danger" *ngIf="message.id" (click)="activeMenuMessageId = null; hideMessage(message)">
                  🗑️ Ocultar
                </button>
              </div>
            </div>
          </div>
          <strong>{{ message.agent ? (message.agent.emoji || '🤖') + ' ' + message.agent.name : 'Conductor' }}:</strong>
          <div class="markdown-content" [innerHTML]="formatMessage(message.content)"></div>
        </div>
      </div>

      <!-- Progress message with tool call timeline -->
      <div
        *ngIf="progressMessage"
        class="message bot-message progress-message"
      >
        <div class="message-content">
          <em>{{ progressMessage.content }}</em>
          <app-tool-call-timeline
            [instanceId]="activeInstanceId"
            [conversationId]="activeConversationId"
            [isActive]="true"
          ></app-tool-call-timeline>
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
      white-space: pre-wrap; /* Preserve line breaks */
    }

    .bot-message {
      background: white;
      color: #2c3e50;
      align-self: flex-start;
      border: 1px solid #e1e4e8;
      width: 95%;
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

    .delegation-message {
      background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
      color: #1e40af;
      align-self: center;
      border: 1px solid #93c5fd;
      border-left: 3px solid #3b82f6;
      font-size: 12px;
      max-width: 90%;
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

    .msg-gear-btn {
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

    .msg-gear-btn:hover {
      background: #e1e4e8;
      transform: scale(1.1);
    }

    .msg-menu {
      position: relative;
    }

    .msg-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99;
    }

    .msg-menu-list {
      position: absolute;
      top: 4px;
      right: 0;
      background: #fff;
      border-radius: 10px;
      min-width: 200px;
      padding: 4px 0;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
      z-index: 100;
    }

    .msg-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: none;
      font-size: 14px;
      color: #1e293b;
      cursor: pointer;
      text-align: left;
      transition: background 0.15s;
    }

    .msg-menu-item:hover {
      background: #f1f5f9;
    }

    .msg-menu-item.danger {
      color: #ef4444;
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
  @Input() activeInstanceId: string = '';
  @Input() activeConversationId: string = '';

  @Output() messageToggled = new EventEmitter<Message>();
  @Output() messageHidden = new EventEmitter<Message>();
  @Output() messageReadMode = new EventEmitter<Message>();

  @ViewChild('messagesContainer') messagesContainer?: ElementRef;

  private shouldScrollToBottom = false;
  private previousMessageCount = 0;
  private previousStreamingContent = '';
  copiedMessageId: string | null = null;
  activeMenuMessageId: string | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  onReadMode(message: Message): void {
    if (message && message.content) {
      this.messageReadMode.emit(message);
    }
  }

  toggleMessageMenu(messageId: string | undefined, event: Event): void {
    event.stopPropagation();
    this.activeMenuMessageId = this.activeMenuMessageId === messageId ? null : (messageId || null);
  }

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

    const onSuccess = () => {
      this.copiedMessageId = message.id;
      setTimeout(() => {
        this.copiedMessageId = null;
      }, 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(message.content).then(onSuccess).catch(() => {
        this.fallbackCopy(message.content, onSuccess);
      });
    } else {
      this.fallbackCopy(message.content, onSuccess);
    }
  }

  private fallbackCopy(text: string, onSuccess: () => void): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      onSuccess();
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
    document.body.removeChild(textarea);
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
