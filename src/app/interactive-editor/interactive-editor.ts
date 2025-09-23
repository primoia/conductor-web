import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { createLowlight } from 'lowlight';

@Component({
  selector: 'app-interactive-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './interactive-editor.html',
  styleUrls: ['./interactive-editor.scss']
})
export class InteractiveEditor implements OnInit, OnDestroy {
  @ViewChild('editorRef', { static: true }) editorRef!: ElementRef;
  @Input() content: string = '';
  @Input() placeholder: string = 'Digite / para comandos ou comece a escrever...';
  @Output() contentChange = new EventEmitter<string>();
  @Output() blockCommand = new EventEmitter<string>();

  private editor!: Editor;
  isSlashMenuOpen = false;
  slashMenuItems = [
    { id: 'h1', label: '📝 Título 1', description: 'Título principal', shortcut: '/h1' },
    { id: 'h2', label: '📝 Título 2', description: 'Subtítulo', shortcut: '/h2' },
    { id: 'h3', label: '📝 Título 3', description: 'Título menor', shortcut: '/h3' },
    { id: 'paragraph', label: '📄 Parágrafo', description: 'Texto normal', shortcut: '/p' },
    { id: 'code', label: '💻 Bloco de Código', description: 'Código com sintaxe', shortcut: '/code' },
    { id: 'bullet-list', label: '• Lista', description: 'Lista com marcadores', shortcut: '/ul' },
    { id: 'ordered-list', label: '1. Lista Numerada', description: 'Lista ordenada', shortcut: '/ol' },
    { id: 'task-list', label: '☑️ Lista de Tarefas', description: 'Checklist interativo', shortcut: '/task' },
    { id: 'blockquote', label: '💬 Citação', description: 'Destacar texto', shortcut: '/quote' },
    { id: 'proposta', label: '✨ Proposta', description: 'Bloco de proposta do Roteiro Vivo', shortcut: '/proposta' },
    { id: 'gatilho', label: '▶️ Gatilho', description: 'Gatilho de execução', shortcut: '/gatilho' },
    { id: 'include', label: '📦 Include', description: 'Incluir sub-roteiro', shortcut: '/include' }
  ];
  filteredSlashItems = [...this.slashMenuItems];
  slashMenuPosition = { x: 0, y: 0 };

  ngOnInit(): void {
    this.initializeEditor();
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.destroy();
    }
  }

  private initializeEditor(): void {
    const lowlight = createLowlight();

    this.editor = new Editor({
      element: this.editorRef.nativeElement,
      extensions: [
        StarterKit.configure({
          codeBlock: false, // We'll use CodeBlockLowlight instead
        }),
        Placeholder.configure({
          placeholder: this.placeholder,
        }),
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: 'typescript',
        }),
        TaskList.configure({
          HTMLAttributes: {
            class: 'task-list',
          },
        }),
        TaskItem.configure({
          nested: true,
          HTMLAttributes: {
            class: 'task-item',
          },
        }),
      ],
      content: this.content,
      editorProps: {
        attributes: {
          class: 'interactive-editor-content',
        },
        handleKeyDown: (view, event) => {
          return this.handleKeyDown(event);
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        this.contentChange.emit(html);
      },
    });

    // Set initial content if provided
    if (this.content) {
      this.editor.commands.setContent(this.content);
    }
  }

  private handleKeyDown(event: KeyboardEvent): boolean {
    // Handle slash command
    if (event.key === '/') {
      setTimeout(() => {
        this.openSlashMenu();
      }, 0);
      return false;
    }

    // Handle escape to close slash menu
    if (event.key === 'Escape' && this.isSlashMenuOpen) {
      this.closeSlashMenu();
      return true;
    }

    // Handle arrow keys in slash menu
    if (this.isSlashMenuOpen && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      // TODO: Implement arrow key navigation in slash menu
      return true;
    }

    // Handle enter in slash menu
    if (this.isSlashMenuOpen && event.key === 'Enter') {
      // TODO: Execute selected slash command
      return true;
    }

    return false;
  }

  private openSlashMenu(): void {
    this.isSlashMenuOpen = true;
    this.filteredSlashItems = [...this.slashMenuItems];
    this.updateSlashMenuPosition();
  }

  private closeSlashMenu(): void {
    this.isSlashMenuOpen = false;
  }

  private updateSlashMenuPosition(): void {
    if (!this.editor) return;

    const { selection } = this.editor.state;
    const { from } = selection;
    const start = this.editor.view.coordsAtPos(from);

    this.slashMenuPosition = {
      x: start.left,
      y: start.bottom + 5
    };
  }

  executeSlashCommand(item: any): void {
    if (!this.editor) return;

    const { from, to } = this.editor.state.selection;

    // Remove the "/" character
    this.editor.commands.deleteRange({ from: from - 1, to });

    switch (item.id) {
      case 'h1':
        this.editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        this.editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'h3':
        this.editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'paragraph':
        this.editor.chain().focus().setParagraph().run();
        break;
      case 'code':
        this.editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'bullet-list':
        this.editor.chain().focus().toggleBulletList().run();
        break;
      case 'ordered-list':
        this.editor.chain().focus().toggleOrderedList().run();
        break;
      case 'task-list':
        this.editor.chain().focus().toggleTaskList().run();
        break;
      case 'blockquote':
        this.editor.chain().focus().toggleBlockquote().run();
        break;
      case 'proposta':
        this.insertCustomBlock('proposta');
        break;
      case 'gatilho':
        this.insertCustomBlock('gatilho');
        break;
      case 'include':
        this.insertCustomBlock('include');
        break;
    }

    this.closeSlashMenu();
  }

  private insertCustomBlock(type: string): void {
    // Emit to parent component to handle custom block insertion
    this.blockCommand.emit(type);

    // Insert placeholder content for now
    const placeholders = {
      proposta: '<div class="custom-block proposta-block">✨ Bloco de Proposta - Digite o conteúdo...</div>',
      gatilho: '<div class="custom-block gatilho-block">▶️ Gatilho de Execução - Digite o comando...</div>',
      include: '<div class="custom-block include-block">📦 Include - Digite o caminho do arquivo...</div>'
    };

    this.editor.commands.insertContent(placeholders[type as keyof typeof placeholders] || '');
  }

  filterSlashItems(query: string): void {
    const lowercaseQuery = query.toLowerCase();
    this.filteredSlashItems = this.slashMenuItems.filter(item =>
      item.label.toLowerCase().includes(lowercaseQuery) ||
      item.description.toLowerCase().includes(lowercaseQuery) ||
      item.shortcut.toLowerCase().includes(lowercaseQuery)
    );
  }

  // Public methods for external control
  focus(): void {
    if (this.editor) {
      this.editor.commands.focus();
    }
  }

  setContent(content: string): void {
    if (this.editor) {
      this.editor.commands.setContent(content);
    }
  }

  getHTML(): string {
    return this.editor ? this.editor.getHTML() : '';
  }

  getJSON(): any {
    return this.editor ? this.editor.getJSON() : null;
  }

  insertContent(content: string): void {
    if (this.editor) {
      this.editor.commands.insertContent(content);
    }
  }
}