import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { lowlight } from 'lowlight/lib/common';
import TurndownService from 'turndown';

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chat-input-wrapper">
      <!-- Editor TipTap - APENAS o editor, sem controls -->
      <div
        #editorContainer
        class="tiptap-editor-container"
      ></div>
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

    /* ============================================ */
    /* EDITOR CONTAINER - Ocupa 100% do wrapper */
    /* ============================================ */
    /* CRITICAL: flex: 1 - cresce para preencher todo o wrapper */
    /* CRITICAL: min-height: 0 - permite scroll funcionar no flex */
    /* CRITICAL: overflow-y: auto - scroll quando conteúdo excede altura */
    .tiptap-editor-container {
      width: 100%;
      flex: 1; /* Cresce para preencher 100% do wrapper */
      min-height: 0; /* CRÍTICO: Permite scroll dentro do flex container */
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

    /* Remove ALL possible borders from any child element */
    .tiptap-editor-container :deep(*) {
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
    }

    /* TipTap Editor Styles - Ultra Clean, NO BORDERS, NO fixed heights that cause growth */
    /* CRITICAL: NO height/min-height that makes it grow - let container handle scrolling */
    .tiptap-editor-container :deep(.ProseMirror) {
      padding: 0;
      outline: none !important;
      border: none !important;
      box-shadow: none !important;
      background: transparent !important;
      font-size: 13px;
      line-height: 1.5;
      /* NO min-height or height here - it would make content push controls down */
      color: #2c3e50;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Force remove any TipTap default borders */
    .tiptap-editor-container :deep(.ProseMirror-focused) {
      outline: none !important;
      border: none !important;
      box-shadow: none !important;
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

  `]
})
export class ChatInputComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() isLoading: boolean = false;
  @Output() messageContentChanged = new EventEmitter<string>();

  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;

  editor!: Editor;
  private turndownService: TurndownService;

  constructor() {
    // Initialize Turndown for HTML to Markdown conversion
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });
  }

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
        StarterKit.configure({
          codeBlock: false, // We'll use CodeBlockLowlight instead
        }),
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: 'plaintext',
        }),
        Placeholder.configure({
          placeholder: 'Digite ou fale sua mensagem... (Shift+Enter para nova linha)',
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
      ],
      editorProps: {
        attributes: {
          class: 'ProseMirror',
        },
        // Handle paste - convert HTML to Markdown
        handlePaste: (view, event) => {
          const html = event.clipboardData?.getData('text/html');
          if (html) {
            try {
              const markdown = this.turndownService.turndown(html);
              // Insert as plain text to preserve Markdown
              const { state } = view;
              const { selection } = state;
              const transaction = state.tr.insertText(markdown, selection.from, selection.to);
              view.dispatch(transaction);
              return true; // Prevent default paste
            } catch (e) {
              console.warn('Failed to convert HTML to Markdown:', e);
            }
          }
          return false; // Use default paste
        },
      },
      onUpdate: ({ editor }) => {
        // Emit content changes to parent (conductor-chat component)
        const html = editor.getHTML();
        const markdown = this.turndownService.turndown(html);
        this.messageContentChanged.emit(markdown.trim());
      },
    });

    // Note: Enter handling is now managed by parent component (conductor-chat)
    // Shift+Enter for new lines works by default in TipTap

    // Set editor editable state based on loading
    this.updateEditorState();
  }

  private updateEditorState(): void {
    if (this.editor) {
      this.editor.setEditable(!this.isLoading);
    }
  }

  /**
   * Clear editor content (called from parent after sending message)
   */
  clearEditor(): void {
    if (this.editor) {
      this.editor.commands.clearContent();
      this.editor.commands.focus();
    }
  }

  /**
   * Check if editor is empty
   */
  isEmpty(): boolean {
    return !this.editor || this.editor.isEmpty;
  }
}
