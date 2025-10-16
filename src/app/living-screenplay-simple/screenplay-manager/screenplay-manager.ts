import { Component, Input, Output, EventEmitter, HostListener, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ScreenplayStorage, ScreenplayListItem, Screenplay } from '../../services/screenplay-storage';

export interface ScreenplayManagerEvent {
  action: 'open' | 'create' | 'rename' | 'delete';
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

  constructor(private screenplayStorage: ScreenplayStorage) {}

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
    if (this.loading) return;

    this.loading = true;
    this.error = null;

    this.screenplayStorage.getScreenplays(this.searchQuery, this.currentPage, 20).subscribe({
      next: (response) => {
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
      },
      error: (error) => {
        this.error = 'Falha ao carregar roteiros. Verifique sua conexão.';
        this.loading = false;
        console.error('[ScreenplayManager] Error loading screenplays:', error);
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
    this.newScreenplayName = '';
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
}
