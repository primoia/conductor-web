import { Component, Input, Output, EventEmitter, HostListener, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ScreenplayStorage, ScreenplayListItem, Screenplay } from '../../services/screenplay-storage';

export interface ScreenplayManagerEvent {
  action: 'open' | 'create' | 'rename' | 'delete' | 'import';
  screenplay?: Screenplay;
  newName?: string;
}

@Component({
  selector: 'app-screenplay-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './screenplay-manager.html',
  styleUrl: './screenplay-manager.scss'
})
export class ScreenplayManager implements OnInit, OnDestroy, OnChanges {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();
  @Output() action = new EventEmitter<ScreenplayManagerEvent>();

  // State
  screenplays: ScreenplayListItem[] = [];
  loading = false;
  error: string | null = null;
  searchQuery = '';
  currentPage = 1;
  totalPages = 1;
  hasMore = false;

  // UI state
  showCreateDialog = false;
  showRenameDialog = false;
  showDeleteConfirm = false;
  selectedScreenplay: ScreenplayListItem | null = null;
  newScreenplayName = '';
  renameScreenplayName = '';

  // Search debounce
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  constructor(
    private screenplayStorage: ScreenplayStorage,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // Setup search debounce (300ms)
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchQuery = query;
      this.currentPage = 1;
      this.screenplays = [];
      this.loadScreenplays();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Detect when modal becomes visible
    if (changes['isVisible'] && changes['isVisible'].currentValue === true) {
      this.onModalOpen();
    }
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  /**
   * Called when modal is opened
   */
  onModalOpen(): void {
    this.loadScreenplays();
  }

  /**
   * Load screenplays from API
   */
  loadScreenplays(): void {
    if (this.loading) {
      console.log('[ScreenplayManager] Already loading, skipping...');
      return;
    }

    console.log('[ScreenplayManager] Starting to load screenplays...', {
      searchQuery: this.searchQuery,
      currentPage: this.currentPage
    });

    this.loading = true;
    this.error = null;

    this.screenplayStorage.getScreenplays(this.searchQuery, this.currentPage, 20).subscribe({
      next: (response) => {
        console.log('[ScreenplayManager] Received response:', response);
        
        // Append to existing list for infinite scroll
        if (this.currentPage === 1) {
          this.screenplays = response.items;
        } else {
          this.screenplays = [...this.screenplays, ...response.items];
        }

        this.totalPages = response.pages;
        this.hasMore = this.currentPage < response.pages;
        this.loading = false;

        console.log(`[ScreenplayManager] Loaded ${response.items.length} screenplays (page ${this.currentPage}/${response.pages})`);
        console.log('[ScreenplayManager] Current screenplays list:', this.screenplays.map(s => s.name));
      },
      error: (error) => {
        this.error = 'Falha ao carregar roteiros. Verifique sua conexão.';
        this.loading = false;
        console.error('[ScreenplayManager] Error loading screenplays:', error);
        
        // Se for erro 422, tentar com limite menor
        if (error.message && error.message.includes('422')) {
          console.log('[ScreenplayManager] Retrying with smaller limit...');
          this.screenplayStorage.getScreenplays(this.searchQuery, 1, 10).subscribe({
            next: (response) => {
              this.screenplays = response.items;
              this.totalPages = response.pages;
              this.hasMore = this.currentPage < response.pages;
              this.loading = false;
              this.error = null;
              console.log('[ScreenplayManager] Retry successful with smaller limit');
            },
            error: (retryError) => {
              console.error('[ScreenplayManager] Retry also failed:', retryError);
            }
          });
        }
      }
    });
  }

  /**
   * Load next page (infinite scroll)
   */
  loadMore(): void {
    if (this.hasMore && !this.loading) {
      this.currentPage++;
      this.loadScreenplays();
    }
  }

  /**
   * Handle search input (triggers debounced search)
   */
  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  /**
   * Open screenplay - fetch full content and emit to parent
   */
  openScreenplay(screenplay: ScreenplayListItem): void {
    this.loading = true;
    this.screenplayStorage.getScreenplay(screenplay.id).subscribe({
      next: (fullScreenplay) => {
        this.loading = false;
        this.action.emit({
          action: 'open',
          screenplay: fullScreenplay
        });
        this.closeModal();
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Falha ao carregar o roteiro.';
        console.error('[ScreenplayManager] Error loading screenplay:', error);
      }
    });
  }

  /**
   * Show create dialog
   */
  showCreateScreen(): void {
    // Generate a unique default name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.newScreenplayName = `novo-roteiro-${timestamp}`;
    this.showCreateDialog = true;
  }

  /**
   * Create new screenplay
   */
  createScreenplay(): void {
    if (!this.newScreenplayName.trim()) {
      this.error = 'Nome do roteiro é obrigatório';
      return;
    }

    this.loading = true;
    this.error = null;

    this.screenplayStorage.createScreenplay({
      name: this.newScreenplayName.trim()
    }).subscribe({
      next: (newScreenplay) => {
        this.loading = false;
        this.showCreateDialog = false;
        this.action.emit({
          action: 'create',
          screenplay: newScreenplay
        });
        this.closeModal();
      },
      error: (error) => {
        this.loading = false;
        // Check if the error message contains information about duplicate name
        const errorMessage = error?.message || '';
        if (errorMessage.includes('already exists') || errorMessage.includes('Screenplay with name')) {
          this.error = `O roteiro "${this.newScreenplayName}" já existe. Escolha outro nome.`;
        } else {
          this.error = `Falha ao criar roteiro: ${errorMessage}`;
        }
        console.error('[ScreenplayManager] Error creating screenplay:', error);
      }
    });
  }

  /**
   * Show rename dialog
   */
  showRenameScreen(screenplay: ScreenplayListItem, event: Event): void {
    event.stopPropagation();
    this.selectedScreenplay = screenplay;
    this.renameScreenplayName = screenplay.name;
    this.showRenameDialog = true;
  }

  /**
   * Rename screenplay
   */
  renameScreenplay(): void {
    if (!this.selectedScreenplay || !this.renameScreenplayName.trim()) {
      this.error = 'Nome do roteiro é obrigatório';
      return;
    }

    this.loading = true;
    this.screenplayStorage.updateScreenplay(this.selectedScreenplay.id, {
      name: this.renameScreenplayName.trim()
    }).subscribe({
      next: () => {
        this.loading = false;
        this.showRenameDialog = false;
        this.selectedScreenplay = null;
        // Reload list to show updated name
        this.currentPage = 1;
        this.screenplays = [];
        this.loadScreenplays();
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Falha ao renomear roteiro. O nome pode já existir.';
        console.error('[ScreenplayManager] Error renaming screenplay:', error);
      }
    });
  }

  /**
   * Export screenplay to disk
   */
  exportScreenplay(screenplay: ScreenplayListItem, event: Event): void {
    event.stopPropagation();

    this.loading = true;
    this.error = null;

    // Load full screenplay content
    this.screenplayStorage.getScreenplay(screenplay.id).subscribe({
      next: async (fullScreenplay) => {
        this.loading = false;
        await this.exportScreenplayToDisk(fullScreenplay);
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Falha ao carregar o roteiro para exportação';
        console.error('[ScreenplayManager] Error loading screenplay for export:', error);
      }
    });
  }

  /**
   * Show delete confirmation
   */
  showDeleteConfirmation(screenplay: ScreenplayListItem, event: Event): void {
    event.stopPropagation();
    this.selectedScreenplay = screenplay;
    this.showDeleteConfirm = true;
  }

  /**
   * Delete screenplay (soft delete)
   */
  deleteScreenplay(): void {
    if (!this.selectedScreenplay) return;

    this.loading = true;
    this.screenplayStorage.deleteScreenplay(this.selectedScreenplay.id).subscribe({
      next: () => {
        this.loading = false;
        this.showDeleteConfirm = false;
        this.selectedScreenplay = null;
        // Reload list to remove deleted item
        this.currentPage = 1;
        this.screenplays = [];
        this.loadScreenplays();
        
        // Emit delete event to parent component
        this.action.emit({ action: 'delete' });
      },
      error: (error) => {
        this.loading = false;
        this.error = 'Falha ao deletar roteiro.';
        console.error('[ScreenplayManager] Error deleting screenplay:', error);
      }
    });
  }

  /**
   * Close modal and reset state
   */
  closeModal(): void {
    this.close.emit();
    this.showCreateDialog = false;
    this.showRenameDialog = false;
    this.showDeleteConfirm = false;
    this.selectedScreenplay = null;
    this.error = null;
  }

  /**
   * Cancel dialog
   */
  cancelDialog(): void {
    this.showCreateDialog = false;
    this.showRenameDialog = false;
    this.showDeleteConfirm = false;
    this.selectedScreenplay = null;
    this.error = null;
  }

  onDeleteModalKeydown(event: KeyboardEvent): void {
    if (!this.showDeleteConfirm) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        this.deleteScreenplay();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.cancelDialog();
        break;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * TrackBy function for screenplay list to improve Angular change detection
   */
  trackByScreenplayId(index: number, screenplay: ScreenplayListItem): string {
    return screenplay.id;
  }

  /**
   * Truncate path for display (show only last 50 characters)
   */
  truncatePath(path: string): string {
    if (!path) return '';
    if (path.length <= 50) return path;
    return '...' + path.slice(-47);
  }

  /**
   * Reload screenplay content from disk using File System Access API
   */
  async reloadFromDisk(screenplay: ScreenplayListItem, event: Event): Promise<void> {
    event.stopPropagation();

    if (!screenplay.importPath) {
      this.error = 'Caminho de importação não disponível para este roteiro';
      return;
    }

    try {
      // Check if File System Access API is supported
      if (!('showOpenFilePicker' in window)) {
        this.error = 'Seu navegador não suporta o acesso direto ao sistema de arquivos. Use um navegador moderno (Chrome, Edge).';
        return;
      }

      this.loading = true;
      this.error = null;

      // Show file picker starting at the import path directory
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'Markdown Files',
          accept: { 'text/markdown': ['.md'] }
        }],
        multiple: false
      });

      // Read file content
      const file = await fileHandle.getFile();
      const content = await file.text();

      // Update the screenplay with new content
      this.screenplayStorage.updateScreenplay(screenplay.id, {
        content: content,
        importPath: file.name, // Update path in case user selected different file
        fileKey: this.screenplayStorage.generateFileKey(file.name, file.name)
      }).subscribe({
        next: (updatedScreenplay) => {
          this.loading = false;
          console.log('✅ [RELOAD] Screenplay reloaded successfully from disk');

          // Update local list
          const index = this.screenplays.findIndex(s => s.id === screenplay.id);
          if (index !== -1) {
            this.screenplays[index] = {
              ...this.screenplays[index],
              updatedAt: updatedScreenplay.updatedAt,
              version: updatedScreenplay.version,
              importPath: updatedScreenplay.importPath
            };
          }

          // Emit action to parent to refresh current editor if this screenplay is open
          this.action.emit({
            action: 'import',
            screenplay: updatedScreenplay
          });
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Falha ao atualizar o roteiro com o conteúdo do disco';
          console.error('[RELOAD] Error updating screenplay:', error);
        }
      });

    } catch (error: any) {
      this.loading = false;
      if (error.name === 'AbortError') {
        console.log('Reload cancelled by user');
        return;
      }
      this.error = 'Erro ao recarregar do disco';
      console.error('[RELOAD] Error reloading from disk:', error);
    }
  }

  /**
   * Handle ESC key to close modals and dialogs
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    // Close delete confirmation dialog if open
    if (this.showDeleteConfirm) {
      this.cancelDialog();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Close rename dialog if open
    if (this.showRenameDialog) {
      this.cancelDialog();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Close create dialog if open
    if (this.showCreateDialog) {
      this.cancelDialog();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Close main modal if open
    if (this.isVisible) {
      this.closeModal();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }

  // === Disk Import/Export Methods ===

  /**
   * Trigger file input for disk import
   */
  importFromDisk(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * Export screenplay to disk using File System Access API
   */
  private async exportScreenplayToDisk(screenplay: Screenplay): Promise<void> {
    try {
      // Check if File System Access API is supported
      if ('showSaveFilePicker' in window) {
        // Use File System Access API to let user choose location
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: screenplay.filePath || `${screenplay.name}.md`,
          types: [{
            description: 'Markdown Files',
            accept: { 'text/markdown': ['.md'] }
          }]
        });

        // Write content to the selected file
        const writable = await handle.createWritable();
        await writable.write(screenplay.content);
        await writable.close();

        // Update the file path in the database
        const newFilePath = handle.name;
        this.screenplayStorage.updateScreenplay(screenplay.id, {
          filePath: newFilePath
        }).subscribe({
          next: () => {
            console.log('✅ [EXPORT] File path updated in database:', newFilePath);
            // Update the local list
            const updatedScreenplay = this.screenplays.find(s => s.id === screenplay.id);
            if (updatedScreenplay) {
              updatedScreenplay.filePath = newFilePath;
            }
          },
          error: (error) => {
            console.error('❌ [EXPORT] Error updating file path:', error);
          }
        });

        console.log('✅ [EXPORT] Screenplay exported successfully to:', newFilePath);
      } else {
        // Fallback: download file
        this.downloadScreenplayAsFile(screenplay);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Export cancelled by user');
        return;
      }
      console.error('❌ [EXPORT] Error exporting screenplay:', error);
      this.error = 'Erro ao exportar roteiro';
    }
  }

  /**
   * Fallback method to download screenplay as file
   */
  private downloadScreenplayAsFile(screenplay: Screenplay): void {
    const filename = screenplay.filePath || `${screenplay.name}.md`;
    const blob = new Blob([screenplay.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ [EXPORT] Screenplay downloaded as:', filename);
  }

  /**
   * Handle file selection from disk
   */
  handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.readFileAndImport(file);
    }
  }

  /**
   * Read file content and emit import action
   */
  private readFileAndImport(file: File): void {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

      // Create the screenplay in MongoDB first
      const newScreenplay = {
        name: fileName,
        content: content,
        description: '',
        tags: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDeleted: false,
        filePath: file.name, // Store the full file name with extension
        importPath: file.name, // Store the import path for reload functionality
        fileKey: this.screenplayStorage.generateFileKey(file.name, file.name) // Generate unique key
      };
      
      this.screenplayStorage.createScreenplay(newScreenplay).subscribe({
        next: (createdScreenplay) => {
          console.log('✅ [IMPORT] Screenplay created in MongoDB:', createdScreenplay);
          console.log('📊 [IMPORT] Before adding - Current list length:', this.screenplays.length);
          console.log('📊 [IMPORT] Before adding - Current list:', this.screenplays.map(s => `${s.name} (${s.id})`));

          // Run inside Angular zone to ensure change detection
          this.ngZone.run(() => {
            // Create screenplay item for the list
            const newScreenplayItem: ScreenplayListItem = {
              id: createdScreenplay.id,
              name: createdScreenplay.name,
              version: createdScreenplay.version,
              updatedAt: createdScreenplay.updatedAt,
              createdAt: createdScreenplay.createdAt,
              isDeleted: false,
              filePath: createdScreenplay.filePath,
              importPath: createdScreenplay.importPath, // Include import path
              fileKey: createdScreenplay.fileKey // Include file key
            };

            console.log('➕ [IMPORT] New item to add:', newScreenplayItem);

            // CRITICAL: Store old length for comparison
            const oldLength = this.screenplays.length;

            // Add new item at the beginning by creating a completely NEW array
            this.screenplays = [newScreenplayItem, ...this.screenplays];

            console.log('✅ [IMPORT] After adding - New list length:', this.screenplays.length);
            console.log('✅ [IMPORT] Length changed from', oldLength, 'to', this.screenplays.length);
            console.log('📋 [IMPORT] After adding - New list:', this.screenplays.map(s => `${s.name} (${s.id})`));
            console.log('🔍 [IMPORT] First item in list:', this.screenplays[0]?.name);

            // Emit action to parent component with the created screenplay
            this.action.emit({
              action: 'import',
              screenplay: createdScreenplay
            });

        // Close the manager modal after successful import
        this.closeModal();
          });
        },
        error: (error) => {
          console.error('❌ [IMPORT] Error creating screenplay:', error);
          // Fallback: emit with empty ID and let parent handle it
          this.action.emit({
            action: 'import',
            screenplay: {
              id: '',
              name: fileName,
              content: content,
              version: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            } as any
          });
        }
      });
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
    };
    
    reader.readAsText(file);
  }
}
