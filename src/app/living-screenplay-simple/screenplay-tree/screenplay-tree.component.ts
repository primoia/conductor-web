import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScreenplayListItem } from '../../services/screenplay-storage';

interface ScreenplayTreeNode {
  type: 'project' | 'file';
  name: string;
  path?: string; // Full path (para projetos)
  screenplay?: ScreenplayListItem; // Para arquivos
  children?: ScreenplayTreeNode[]; // Para projetos
  isExpanded: boolean; // Estado de expansão
}

@Component({
  selector: 'app-screenplay-tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './screenplay-tree.component.html',
  styleUrls: ['./screenplay-tree.component.css']
})
export class ScreenplayTreeComponent implements OnInit, OnChanges {
  @Input() screenplays: ScreenplayListItem[] = [];
  @Input() activeScreenplayId: string | null = null; // ID do roteiro atualmente ativo
  @Output() openScreenplay = new EventEmitter<ScreenplayListItem>();
  @Output() updateScreenplay = new EventEmitter<{screenplay: ScreenplayListItem, updates: Partial<ScreenplayListItem>}>();
  @Output() reloadFromDisk = new EventEmitter<ScreenplayListItem>();

  treeNodes: ScreenplayTreeNode[] = [];
  // Estado de expansão dos projetos (persiste entre reconstruções)
  private expansionState = new Map<string, boolean>();

  // Modal state
  showEditDialog = false;
  editingScreenplay: ScreenplayListItem | null = null;
  editingName = '';
  editingPath = '';

  ngOnInit(): void {
    this.buildTree();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['screenplays']) {
      this.buildTree();
    }
  }

  buildTree(): void {
    const projectMap = new Map<string, ScreenplayListItem[]>();

    // Group screenplays by project
    this.screenplays
      .filter(s => !s.isDeleted)
      .forEach(screenplay => {
        const projectName = this.extractProjectName(screenplay.importPath);
        if (!projectMap.has(projectName)) {
          projectMap.set(projectName, []);
        }
        projectMap.get(projectName)!.push(screenplay);
      });

    // Build tree structure
    this.treeNodes = Array.from(projectMap.entries())
      .sort(([a], [b]) => {
        // Sort: projects first, then "[Sem Projeto]" last
        if (a === '[Sem Projeto]') return 1;
        if (b === '[Sem Projeto]') return -1;
        return a.localeCompare(b);
      })
      .map(([project, screenplays]) => {
        // Restaurar estado de expansão salvo, ou expandir por padrão na primeira vez
        const isExpanded = this.expansionState.has(project)
          ? this.expansionState.get(project)!
          : true;

        return {
          type: 'project' as const,
          name: project,
          isExpanded,
          children: screenplays
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map(s => ({
              type: 'file' as const,
              name: s.name,
              screenplay: s,
              isExpanded: false
            }))
        };
      });
  }

  extractProjectName(importPath: string | undefined): string {
    if (!importPath) return '[Sem Projeto]';

    // Sanitize path before extracting project name
    const sanitized = this.sanitizePath(importPath);

    // Examples:
    // "conductor/README.md" → "conductor"
    // "conductor-community/src/conductor/README.md" → "conductor"
    // "README.md" → "[Sem Projeto]"

    const parts = sanitized.split('/');
    if (parts.length <= 1) return '[Sem Projeto]';

    // Get the second-to-last segment (project folder)
    // If path has multiple segments, use the first meaningful one
    // e.g., "conductor-community/src/conductor/README.md" → "conductor"
    const lastDir = parts[parts.length - 2];

    // If it's a common directory name, try to find a better project name
    if (['src', 'lib', 'app', 'components', 'services', 'docs'].includes(lastDir) && parts.length > 2) {
      return parts[parts.length - 3];
    }

    return lastDir;
  }

  sanitizePath(path: string): string {
    // Remove sensitive prefixes
    const sensitivePrefixes = [
      '/mnt/ramdisk/primoia-main/',
      '/home/',
      '/Users/',
      'C:\\Users\\',
      'C:\\',
    ];

    let sanitized = path;
    for (const prefix of sensitivePrefixes) {
      if (sanitized.startsWith(prefix)) {
        sanitized = sanitized.replace(prefix, '');
        break;
      }
    }

    return sanitized;
  }

  toggleProject(node: ScreenplayTreeNode): void {
    if (node.type === 'project') {
      node.isExpanded = !node.isExpanded;
      // Salvar o estado de expansão para persistir entre reconstruções
      this.expansionState.set(node.name, node.isExpanded);
    }
  }

  onFileClick(screenplay: ScreenplayListItem): void {
    this.openScreenplay.emit(screenplay);
  }

  onEditClick(screenplay: ScreenplayListItem, event: Event): void {
    event.stopPropagation();
    this.editingScreenplay = screenplay;
    this.editingName = screenplay.name;
    this.editingPath = screenplay.importPath || '';
    this.showEditDialog = true;
  }

  onReloadClick(screenplay: ScreenplayListItem, event: Event): void {
    event.stopPropagation();
    this.reloadFromDisk.emit(screenplay);
  }

  saveEdits(): void {
    console.log('💾 [TREE] saveEdits called');

    if (!this.editingScreenplay) {
      console.log('❌ [TREE] No screenplay being edited');
      return;
    }

    const updates: Partial<ScreenplayListItem> = {};

    console.log('📝 [TREE] Checking changes:', {
      originalName: this.editingScreenplay.name,
      newName: this.editingName.trim(),
      originalPath: this.editingScreenplay.importPath,
      newPath: this.editingPath.trim()
    });

    // Check if name changed
    if (this.editingName.trim() && this.editingName !== this.editingScreenplay.name) {
      updates.name = this.editingName.trim();
      console.log('✏️ [TREE] Name changed to:', updates.name);
    }

    // Check if path changed
    const newPath = this.editingPath.trim();
    const oldPath = this.editingScreenplay.importPath || '';
    if (newPath !== oldPath) {
      updates.importPath = newPath || undefined;
      console.log('✏️ [TREE] Path changed to:', updates.importPath);
    }

    console.log('📦 [TREE] Updates to send:', updates);

    // Only emit if there are changes
    if (Object.keys(updates).length > 0) {
      console.log('✅ [TREE] Emitting updateScreenplay event');
      this.updateScreenplay.emit({
        screenplay: this.editingScreenplay,
        updates
      });
      this.cancelDialog();
      this.buildTree(); // Rebuild tree with new data
    } else {
      console.log('⚠️ [TREE] No changes detected, closing dialog');
      this.cancelDialog();
    }
  }

  cancelDialog(): void {
    this.showEditDialog = false;
    this.editingScreenplay = null;
    this.editingName = '';
    this.editingPath = '';
  }

  // Close edit dialog with ESC key
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    if (this.showEditDialog) {
      this.cancelDialog();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Computed property - extraído automaticamente do path
  get currentProject(): string {
    return this.extractProjectName(this.editingPath);
  }

  getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''} atrás`;
    return date.toLocaleDateString();
  }

  getDisplayPath(screenplay: ScreenplayListItem): string {
    return screenplay.importPath ? this.sanitizePath(screenplay.importPath) : '(sem caminho)';
  }
}
