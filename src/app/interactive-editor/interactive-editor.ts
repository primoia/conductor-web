import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
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
export class InteractiveEditor implements OnInit, OnDestroy, OnChanges {
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] && this.editor && !changes['content'].isFirstChange()) {
      const newContent = changes['content'].currentValue;

      // Only update if the content actually changed to avoid change detection loops
      if (newContent && newContent !== this._lastProcessedContent) {
        this._lastProcessedContent = newContent;
        const processedContent = this.processMarkdownContent(newContent);
        this.editor.commands.setContent(processedContent);
      }
    }
  }

  private _lastProcessedContent: string = '';

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
          // Configure paragraph handling for better line break preservation
          paragraph: {
            HTMLAttributes: {
              class: 'editor-paragraph',
            },
          },
          // Ensure hardBreak handles line breaks properly
          hardBreak: {
            keepMarks: true,
          },
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
        // Emit markdown instead of HTML to preserve formatting when parent saves
        const markdown = this.getMarkdown();
        this.contentChange.emit(markdown);
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

    // Insert rich demo content that looks more realistic
    const placeholders = {
      proposta: `
        <div class="custom-block proposta-block" style="border: 2px solid #e3f2fd; border-radius: 12px; padding: 20px; margin: 16px 0; background: linear-gradient(135deg, #f8fffe 0%, #f0f9ff 100%); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="font-size: 24px;">✨</span>
            <strong style="color: #1976d2; font-size: 18px;">Proposta de IA</strong>
            <span style="background: #ffa726; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">PENDENTE</span>
          </div>
          <h4 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">Implementar Sistema de Autenticação JWT</h4>
          <p style="margin: 0 0 12px 0; color: #666; line-height: 1.5;">Criar service Angular para autenticação segura usando JWT tokens com refresh automático e interceptors HTTP.</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 12px; margin: 12px 0; font-family: 'Courier New', monospace; font-size: 13px; border-left: 4px solid #1976d2;">
            <div style="color: #888; margin-bottom: 4px;">// AuthService Preview</div>
            <div style="color: #d73a49;">export class</div> <div style="color: #6f42c1;">AuthService</div> {<br/>
            &nbsp;&nbsp;<div style="color: #d73a49;">login</div>(<div style="color: #e36209;">credentials</div>): <div style="color: #6f42c1;">Observable</div>&lt;<div style="color: #6f42c1;">AuthResponse</div>&gt;<br/>
            }
          </div>
          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">✅ Aceitar</button>
            <button style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">❌ Rejeitar</button>
            <button style="background: #2196f3; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">👁️ Ver Código</button>
          </div>
        </div>
      `,
      gatilho: `
        <div class="custom-block gatilho-block" style="border: 2px solid #e8f5e8; border-radius: 12px; padding: 20px; margin: 16px 0; background: linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="font-size: 24px;">▶️</span>
            <strong style="color: #388e3c; font-size: 18px;">Gatilho de Execução</strong>
            <span style="background: #66bb6a; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">PRONTO</span>
          </div>
          <h4 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">Executar Testes Unitários</h4>
          <p style="margin: 0 0 12px 0; color: #666; line-height: 1.5;">Roda todos os testes do projeto com coverage para verificar integridade do código.</p>
          <div style="background: #2d2d2d; border-radius: 8px; padding: 12px; margin: 12px 0; font-family: 'Courier New', monospace; font-size: 13px; color: #f8f8f2;">
            <div style="color: #50fa7b;">$</div> <span style="color: #8be9fd;">npm test -- --coverage --watchAll=false</span>
          </div>
          <button style="background: #4caf50; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px;">🚀 Executar Comando</button>
        </div>
      `,
      include: `
        <div class="custom-block include-block" style="border: 2px solid #fff3e0; border-radius: 12px; padding: 20px; margin: 16px 0; background: linear-gradient(135deg, #fffbf0 0%, #fff8e1 100%); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <span style="font-size: 24px;">📦</span>
            <strong style="color: #f57c00; font-size: 18px;">Include Sub-Roteiro</strong>
          </div>
          <h4 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">Importar Configuração de Database</h4>
          <p style="margin: 0 0 12px 0; color: #666; line-height: 1.5;">Inclui configurações padrão do banco de dados PostgreSQL com conexões e migrations.</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 12px; margin: 12px 0; font-family: 'Courier New', monospace; font-size: 13px; border-left: 4px solid #f57c00;">
            <span style="color: #666;">📁</span> roteiros/database/postgres-setup.md
          </div>
          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button style="background: #ff9800; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">📂 Selecionar Arquivo</button>
            <button style="background: #2196f3; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">👁️ Preview</button>
          </div>
        </div>
      `
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
      // Convert markdown-style line breaks to HTML paragraphs for proper rendering
      const processedContent = this.processMarkdownContent(content);
      this.editor.commands.setContent(processedContent);
    }
  }

  // Helper method to convert markdown content to HTML for proper paragraph handling
  private processMarkdownContent(markdown: string): string {
    if (!markdown || typeof markdown !== 'string') {
      return '<p></p>';
    }

    // Simple and reliable conversion: handle basic markdown and paragraphs
    let html = markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');

    // Handle headings first
    html = html
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Split into paragraphs based on double line breaks
    const paragraphs = html.split('\n\n').filter(p => p.trim().length > 0);

    if (paragraphs.length === 0) {
      return '<p></p>';
    }

    // Wrap content that isn't already wrapped in block elements
    const processedParagraphs = paragraphs.map(paragraph => {
      const trimmed = paragraph.trim();
      if (trimmed.startsWith('<h') || trimmed.startsWith('<div') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    });

    return processedParagraphs.join('\n');
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

  // Improved method to get Markdown content with better line break handling
  getMarkdown(): string {
    if (!this.editor) return '';

    const html = this.editor.getHTML();

    // Basic HTML to Markdown conversion with improved line break handling
    let markdown = html
      // Handle paragraphs with proper double line breaks
      .replace(/<p[^>]*>/g, '')
      .replace(/<\/p>/g, '\n\n')
      // Handle line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      // Handle headings
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      // Handle formatting
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      // Handle lists
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      // Handle blockquotes
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
      // Handle code blocks
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      // Clean up remaining HTML tags (preserve comments for our anchors)
      .replace(/<(?!(!--|\/!--))[^>]*>/g, '')
      // Clean up excessive whitespace but preserve intentional line breaks
      .replace(/\n\n\n+/g, '\n\n')
      .trim();

    return markdown;
  }
}