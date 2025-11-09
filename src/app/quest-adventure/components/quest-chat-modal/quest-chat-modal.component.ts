import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { NPC, DialogueOption } from '../../models/quest.models';

interface ChatMessage {
  sender: 'npc' | 'player';
  text: string;
  timestamp: number;
}

@Component({
  selector: 'app-quest-chat-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="quest-chat-overlay" (click)="handleOverlayClick($event)" [@fadeIn]>
      <div class="quest-chat-modal" #modalContent [@slideUp]>
        <!-- Header do Pergaminho -->
        <div class="chat-header">
          <div class="npc-info">
            <span class="npc-emoji">{{ npc.emoji }}</span>
            <div class="npc-details">
              <h3 class="npc-name">{{ npc.name }}</h3>
              <span class="npc-title">{{ npc.title }}</span>
            </div>
          </div>
          <button class="close-btn" (click)="onClose.emit()">
            <span>×</span>
          </button>
        </div>

        <!-- Área de Mensagens -->
        <div class="chat-messages" #messagesContainer>
          <div *ngFor="let msg of messages"
               class="message"
               [class.npc]="msg.sender === 'npc'"
               [class.player]="msg.sender === 'player'"
               [@messageAnimation]>
            <div class="message-bubble">
              <span class="speaker">
                {{ msg.sender === 'npc' ? npc.name : 'Você' }}:
              </span>
              <span class="text" [innerHTML]="msg.text"></span>
            </div>
          </div>

          <!-- Indicador de Digitação -->
          <div class="typing-indicator" *ngIf="isTyping" [@fadeIn]>
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>

        <!-- Opções de Resposta -->
        <div class="chat-options" *ngIf="currentOptions.length > 0 && !isTyping">
          <button *ngFor="let option of currentOptions; let i = index"
                  class="option-button"
                  (click)="selectOption(option)"
                  [@optionAnimation]="{value: '', params: {delay: i * 100}}">
            <span class="option-arrow">▶</span>
            <span class="option-text">{{ option.text }}</span>
            <span class="option-xp" *ngIf="option.xp">
              +{{ option.xp }} XP
            </span>
          </button>
        </div>

        <!-- Botão Continuar (quando não há opções) -->
        <div class="chat-continue" *ngIf="showContinue && !isTyping">
          <button class="continue-button" (click)="continueDialogue()">
            Continuar
            <span class="continue-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./quest-chat-modal.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(100%)' }),
        animate('300ms ease-out', style({ transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(100%)' }))
      ])
    ]),
    trigger('messageAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('optionAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('200ms {{delay}}ms', style({ opacity: 1, transform: 'translateX(0)' })),
      ], { params: { delay: 0 } })
    ])
  ]
})
export class QuestChatModalComponent implements OnInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  @Input() npc!: NPC;
  @Input() message = '';
  @Input() options: DialogueOption[] = [];
  @Input() isTyping = false;

  @Output() onOptionSelect = new EventEmitter<DialogueOption>();
  @Output() onClose = new EventEmitter<void>();

  messages: ChatMessage[] = [];
  currentOptions: DialogueOption[] = [];
  showContinue = false;
  typingSpeed = 50; // ms por caractere

  ngOnInit() {
    this.startDialogue();
  }

  private startDialogue() {
    // Mensagem inicial do NPC
    if (this.message) {
      this.addNpcMessage(this.message);
    }

    // Mostra opções após delay
    if (this.options.length > 0) {
      setTimeout(() => {
        this.currentOptions = this.options;
      }, 1500);
    } else {
      // Se não há opções, mostra botão continuar
      setTimeout(() => {
        this.showContinue = true;
      }, 1500);
    }
  }

  selectOption(option: DialogueOption) {
    // Adiciona mensagem do player
    this.addPlayerMessage(option.text);

    // Limpa opções
    this.currentOptions = [];
    this.showContinue = false;

    // Simula NPC pensando
    this.isTyping = true;

    // Emite seleção após pequeno delay
    setTimeout(() => {
      this.onOptionSelect.emit(option);
    }, 1000);
  }

  continueDialogue() {
    // Usado quando não há opções, apenas para fechar ou avançar
    this.onClose.emit();
  }

  private async addNpcMessage(text: string) {
    const message: ChatMessage = {
      sender: 'npc',
      text: '',
      timestamp: Date.now()
    };

    this.messages.push(message);

    // Efeito de digitação
    await this.typeMessage(message, text);

    this.scrollToBottom();
  }

  private addPlayerMessage(text: string) {
    this.messages.push({
      sender: 'player',
      text: text,
      timestamp: Date.now()
    });

    this.scrollToBottom();
  }

  private async typeMessage(message: ChatMessage, fullText: string) {
    // Efeito de digitação letra por letra
    for (let i = 0; i <= fullText.length; i++) {
      message.text = fullText.slice(0, i);

      // Adiciona cursor piscando
      if (i < fullText.length) {
        message.text += '|';
      }

      await this.delay(this.typingSpeed);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  handleOverlayClick(event: MouseEvent) {
    // Se clicou fora do modal, fecha
    if (event.target === event.currentTarget) {
      this.onClose.emit();
    }
  }

  // Método público para adicionar novas mensagens durante o diálogo
  public addMessage(text: string, sender: 'npc' | 'player') {
    if (sender === 'npc') {
      this.addNpcMessage(text);
    } else {
      this.addPlayerMessage(text);
    }
  }

  // Método para atualizar opções
  public updateOptions(newOptions: DialogueOption[]) {
    this.currentOptions = [];
    this.showContinue = false;

    setTimeout(() => {
      if (newOptions.length > 0) {
        this.currentOptions = newOptions;
      } else {
        this.showContinue = true;
      }
    }, 500);
  }
}