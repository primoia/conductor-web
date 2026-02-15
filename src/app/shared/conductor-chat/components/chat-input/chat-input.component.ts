import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chat-input-wrapper">
      <!-- Hidden input to force keyboard on stylus -->
      <input #penHelper class="pen-keyboard-helper" type="text" inputmode="text" aria-hidden="true" tabindex="-1">
      <div class="editor-row">
        <!-- Editor TipTap -->
        <div
          #editorContainer
          class="tiptap-editor-container"
          (click)="focusEditor()"
          (pointerup)="onPointerUp($event)"
        ></div>
        <!-- Keyboard trigger button -->
        <button class="keyboard-btn" (click)="focusEditorWithKeyboard()" title="Abrir teclado">⌨️</button>
      </div>
    </div>
  `,
  styles: [`
    /* ============================================ */
    /* ESTRUTURA SIMPLIFICADA - APENAS EDITOR */
    /* ============================================ */
    /* Este componente agora contém APENAS o editor TipTap */
    /* Os controls foram movidos para o conductor-chat.component.ts */
    /* O wrapper preenche 100% da altura do chat-input-area (pai) */

    .chat-input-wrapper {
      background: white;
      padding: 0;
      width: 100%;
      height: 100%; /* CRITICAL: Must be 100% of parent (chat-input-area) */
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      overflow: hidden; /* Prevent any overflow */
      position: relative;
    }

    .pen-keyboard-helper {
      position: absolute;
      opacity: 0;
      height: 0;
      width: 0;
      padding: 0;
      border: 0;
      pointer-events: none;
    }

    .editor-row {
      display: flex;
      align-items: stretch;
      flex: 1;
      min-height: 0;
      width: 100%;
      height: 100%;
    }

    .keyboard-btn {
      width: 36px;
      flex-shrink: 0;
      border: none;
      background: #f0f3f7;
      border-left: 1px solid #e2e8f0;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .keyboard-btn:hover {
      background: #e2e8f0;
    }

    .keyboard-btn:active {
      background: #cbd5e0;
    }

    /* ============================================ */
    /* EDITOR CONTAINER - Ocupa 100% do wrapper */
    /* ============================================ */
    /* CRITICAL: flex: 1 - cresce para preencher todo o wrapper */
    /* CRITICAL: min-height para garantir 5 linhas visíveis */
    /* CRITICAL: overflow-y: auto - scroll quando conteúdo excede altura */
    .tiptap-editor-container {
      flex: 1;
      min-width: 0;
      height: 100%; /* CRITICAL: Ocupa 100% da altura do wrapper */
      overflow-y: auto; /* Scroll quando conteúdo excede altura */
      overflow-x: hidden;
      position: relative;
      background: transparent;
      border: none !important;
      padding: 12px;
      box-sizing: border-box;
    }

    /* Scrollbar styling */
    .tiptap-editor-container::-webkit-scrollbar {
      width: 6px;
    }

    .tiptap-editor-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .tiptap-editor-container::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 3px;
    }

    .tiptap-editor-container::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }

    /* Remove borders from child elements (except ProseMirror itself) */
    .tiptap-editor-container :deep(p),
    .tiptap-editor-container :deep(h1),
    .tiptap-editor-container :deep(h2),
    .tiptap-editor-container :deep(h3),
    .tiptap-editor-container :deep(ul),
    .tiptap-editor-container :deep(ol),
    .tiptap-editor-container :deep(li) {
      border: none !important;
      outline: none !important;
    }

    /* TipTap Editor Styles - Ultra Clean, Área clicável completa */
    /* CRITICAL: height: 100% + min-height para preencher container */
    .tiptap-editor-container :deep(.ProseMirror) {
      padding: 12px;
      outline: none !important;
      border: 2px solid transparent !important; /* Transparent border for spacing */
      border-radius: 6px;
      box-shadow: none !important;
      background: #fafbfc !important;
      font-size: 13px;
      line-height: 1.5;
      min-height: 100%; /* CRITICAL: Preenche 100% do container (160px - 24px padding = 136px) */
      height: auto; /* Cresce com o conteúdo, mas nunca menor que min-height */
      color: #2c3e50;
      word-wrap: break-word;
      overflow-wrap: break-word;
      transition: border-color 0.2s ease, background-color 0.2s ease;
      box-sizing: border-box;
    }

    /* Borda azul quando focado */
    .tiptap-editor-container :deep(.ProseMirror:focus),
    .tiptap-editor-container :deep(.ProseMirror-focused) {
      outline: none !important;
      border: 2px solid #667eea !important; /* Borda azul ao clicar */
      background: #ffffff !important;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important; /* Sombra azul suave */
    }

    .tiptap-editor-container :deep(.ProseMirror p.is-editor-empty:first-child::before) {
      color: #cbd5e0;
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
      font-size: 13px;
    }

    .tiptap-editor-container :deep(.ProseMirror:focus),
    .tiptap-editor-container :deep(.ProseMirror:focus-visible) {
      outline: none !important;
      border: none !important;
      box-shadow: none !important;
      background: transparent !important;
    }

    /* Preserve pasted formatting */
    .tiptap-editor-container :deep(.ProseMirror strong) {
      font-weight: 600;
    }

    .tiptap-editor-container :deep(.ProseMirror em) {
      font-style: italic;
    }

    .tiptap-editor-container :deep(.ProseMirror code) {
      background: #f3f4f6;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
    }

    .tiptap-editor-container :deep(.ProseMirror pre) {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 3px 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
    }

    .tiptap-editor-container :deep(.ProseMirror pre code) {
      background: transparent;
      padding: 0;
    }

    .tiptap-editor-container :deep(.ProseMirror ul),
    .tiptap-editor-container :deep(.ProseMirror ol) {
      padding-left: 20px;
      margin-bottom: 8px;
    }

    .tiptap-editor-container :deep(.ProseMirror ul[data-type="taskList"]) {
      list-style: none;
      padding-left: 0;
    }

    .tiptap-editor-container :deep(.ProseMirror ul[data-type="taskList"] li) {
      display: flex;
      align-items: flex-start;
      gap: 5px;
    }

    .tiptap-editor-container :deep(.ProseMirror ul[data-type="taskList"] li input[type="checkbox"]) {
      margin-top: 3px;
    }

    .tiptap-editor-container :deep(.ProseMirror p) {
      margin-top: 0;
      margin-bottom: 8px;
    }

    .tiptap-editor-container :deep(.ProseMirror h1),
    .tiptap-editor-container :deep(.ProseMirror h2),
    .tiptap-editor-container :deep(.ProseMirror h3) {
      font-weight: 600;
      margin: 3px 0;
      color: #1a202c;
    }

    /* Disable link styling - keep all text as plain text */
    .tiptap-editor-container :deep(.ProseMirror a),
    .tiptap-editor-container :deep(.ProseMirror a:visited),
    .tiptap-editor-container :deep(.ProseMirror a:hover),
    .tiptap-editor-container :deep(.ProseMirror a:active) {
      color: inherit !important;
      text-decoration: none !important;
      cursor: text !important;
    }

  `]
})
export class ChatInputComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() isLoading: boolean = false;
  @Output() messageContentChanged = new EventEmitter<string>();
  @Output() enterPressed = new EventEmitter<void>(); // Enter envia mensagem
  @Output() contentHeightChanged = new EventEmitter<number>(); // 🔥 NOVO: Emite altura do conteúdo

  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('penHelper') penHelper!: ElementRef<HTMLInputElement>;

  editor!: Editor;

  ngOnInit(): void {
    // Component simplified - only editor logic here
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update editor state when isLoading changes
    if (changes['isLoading'] && this.editor) {
      this.updateEditorState();
    }
  }

  ngAfterViewInit(): void {
    // Initialize TipTap Editor
    setTimeout(() => {
      this.initializeEditor();
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.destroy();
    }
  }

  private initializeEditor(): void {
    if (!this.editorContainer) {
      console.error('Editor container not found');
      return;
    }

    this.editor = new Editor({
      element: this.editorContainer.nativeElement,
      extensions: [
        // Minimal extensions - plain text only, no formatting/links
        Document,
        Paragraph,
        Text,
        HardBreak,
        History,
        Placeholder.configure({
          placeholder: 'Digite ou fale sua mensagem... (Shift+Enter para nova linha)',
        }),
      ],
      editorProps: {
        attributes: {
          class: 'ProseMirror',
        },
        // Handle paste - always use plain text to preserve exact formatting
        handlePaste: (view, event) => {
          const plainText = event.clipboardData?.getData('text/plain');
          if (plainText) {
            const { state } = view;
            const { selection } = state;
            const transaction = state.tr.insertText(plainText, selection.from, selection.to);
            view.dispatch(transaction);
            return true; // Prevent default paste
          }
          return false; // Use default paste
        },
      },
      onUpdate: ({ editor }) => {
        // Emit content changes to parent - use getText to preserve line breaks exactly
        const text = editor.getText({ blockSeparator: '\n' });
        this.messageContentChanged.emit(text.trim());

        // 🔥 NOVO: Calcular altura do conteúdo e emitir
        this.updateContentHeight();
      },
    });

    // Add custom keyboard shortcuts
    this.editor.setOptions({
      editorProps: {
        ...this.editor.options.editorProps,
        handleKeyDown: (view, event) => {
          // Enter without Shift = send message
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.enterPressed.emit(); // Notify parent to send
            return true;
          }
          // Shift+Enter = new line (default behavior)
          return false;
        },
      },
    });

    // Set editor editable state based on loading
    this.updateEditorState();
  }

  private updateEditorState(): void {
    if (this.editor) {
      this.editor.setEditable(!this.isLoading);
    }
  }

  /**
   * 🔥 NOVO: Calcula altura necessária do conteúdo e emite evento
   */
  private updateContentHeight(): void {
    if (!this.editorContainer) return;

    // Aguardar próximo frame para garantir que o DOM foi atualizado
    setTimeout(() => {
      const proseMirrorElement = this.editorContainer.nativeElement.querySelector('.ProseMirror');
      if (proseMirrorElement) {
        // Altura do conteúdo + padding do container (24px)
        const contentHeight = proseMirrorElement.scrollHeight;
        const totalHeight = contentHeight + 24; // 12px top + 12px bottom padding

        // Limites: min 80px (2-3 linhas), max 400px
        const constrainedHeight = Math.min(Math.max(totalHeight, 80), 400);

        this.contentHeightChanged.emit(constrainedHeight);
      }
    }, 0);
  }

  /**
   * Clear editor content (called from parent after sending message)
   */
  clearEditor(): void {
    if (this.editor) {
      this.editor.commands.clearContent();
      this.editor.commands.focus();

      // 🔥 NOVO: Resetar altura ao limpar
      this.contentHeightChanged.emit(80); // Voltar ao tamanho mínimo
    }
  }

  /**
   * Check if editor is empty
   */
  isEmpty(): boolean {
    return !this.editor || this.editor.isEmpty;
  }

  /**
   * Handle stylus/pen pointer events - force virtual keyboard
   */
  onPointerUp(event: PointerEvent): void {
    if (event.pointerType === 'pen') {
      event.preventDefault();
      this.focusEditorWithKeyboard();
    }
  }

  /**
   * Focus editor when clicking anywhere in the input area
   */
  focusEditor(): void {
    if (this.editor && !this.isLoading) {
      this.editor.commands.focus('end');
    }
  }

  /**
   * Force virtual keyboard by focusing a real input first, then redirecting to editor
   */
  focusEditorWithKeyboard(): void {
    if (!this.editor || this.isLoading) return;
    const helper = this.penHelper?.nativeElement;
    if (helper) {
      // Focus a real <input> to trigger the OS virtual keyboard
      helper.style.pointerEvents = 'auto';
      helper.focus();
      // Then redirect focus to the editor
      setTimeout(() => {
        helper.style.pointerEvents = 'none';
        this.editor.commands.focus('end');
      }, 50);
    }
  }

  /**
   * Insert text at current cursor position
   */
  insertText(text: string): void {
    if (this.editor && text) {
      this.editor.commands.insertContent(text);
      this.editor.commands.focus('end');
    }
  }
}
