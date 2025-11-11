import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

export interface BottomSheetOption {
  icon: string;
  label: string;
  action: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-bottom-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bottom-sheet.component.html',
  styleUrls: ['./bottom-sheet.component.css'],
  animations: [
    trigger('slideUp', [
      state('void', style({
        transform: 'translateY(100%)',
        opacity: 0
      })),
      state('*', style({
        transform: 'translateY(0)',
        opacity: 1
      })),
      transition('void => *', animate('300ms cubic-bezier(0.25, 0.8, 0.25, 1)')),
      transition('* => void', animate('200ms cubic-bezier(0.25, 0.8, 0.25, 1)'))
    ]),
    trigger('fadeIn', [
      state('void', style({ opacity: 0 })),
      state('*', style({ opacity: 1 })),
      transition('void => *', animate('200ms ease-in')),
      transition('* => void', animate('150ms ease-out'))
    ])
  ]
})
export class BottomSheetComponent {
  @Input() isVisible = false;
  @Input() title = '';
  @Input() options: BottomSheetOption[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() optionSelected = new EventEmitter<string>();

  onBackdropClick(): void {
    this.close.emit();
  }

  onOptionClick(action: string, disabled?: boolean): void {
    if (disabled) return;
    this.optionSelected.emit(action);
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isVisible) {
      this.close.emit();
    }
  }
}
